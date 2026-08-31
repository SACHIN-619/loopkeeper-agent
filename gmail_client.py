"""
gmail_client.py — Multi-tenant Gmail send + read with user-scoped credentials.

Supports per-user OAuth tokens stored securely in Firestore (`gmail_connections/{user_id}`)
with strict isolation (no cross-user fallback to local token.json unless explicitly in local dev mode).

Scope: https://www.googleapis.com/auth/gmail.modify
"""

import os
import json
import base64
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

_CREDS_PATH = Path(__file__).parent / "credentials.json"
_TOKEN_PATH = Path(__file__).parent / "token.json"


def _get_firestore_db():
    try:
        from google.cloud import firestore
        return firestore.Client()
    except Exception:
        return None


def get_service(user_id: Optional[str] = None):
    """Retrieve an authorized Gmail API service instance for a specific user_id.

    Strict Isolation Rules:
      1. If user_id is provided, fetch credentials from Firestore `gmail_connections/{user_id}` doc.
      2. If user_id is None AND LOOPKEEPER_LOCAL_DEV=1, fallback to local `token.json`.
      3. Otherwise raise RuntimeError requiring explicit user OAuth connection.
    """
    creds = None

    # 1. User-scoped credentials from Firestore
    if user_id and os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        db = _get_firestore_db()
        if db:
            doc = db.collection("gmail_connections").document(user_id).get()
            if doc.exists:
                data = doc.to_dict() or {}
                token_info = data.get("tokens_json") or data.get("token")
                if token_info:
                    info = json.loads(token_info) if isinstance(token_info, str) else token_info
                    creds = Credentials.from_authorized_user_info(info, SCOPES)
                    if creds and creds.expired and creds.refresh_token:
                        try:
                            creds.refresh(Request())
                            db.collection("gmail_connections").document(user_id).update({
                                "tokens_json": creds.to_json(),
                                "updated_at": firestore.SERVER_TIMESTAMP,
                            })
                        except Exception as e:
                            print(f"[gmail_client] Error refreshing token for user {user_id}: {e}")
                            creds = None

    # 2. Single-user local development fallback (ONLY when user_id is None and LOCAL_DEV mode active)
    if not creds and user_id is None and os.getenv("LOOPKEEPER_LOCAL_DEV") == "1":
        if _TOKEN_PATH.exists():
            try:
                creds = Credentials.from_authorized_user_file(str(_TOKEN_PATH), SCOPES)
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    _TOKEN_PATH.write_text(creds.to_json())
            except Exception as e:
                print(f"[gmail_client] Error loading local token.json: {e}")
                creds = None

    if not creds or not creds.valid:
        raise RuntimeError(
            f"No valid Gmail OAuth connection found for user_id='{user_id or 'default'}'. "
            f"Please click 'Connect Gmail' in Settings to authorize mailbox access."
        )

    return build("gmail", "v1", credentials=creds)


def _get_flow(redirect_uri: Optional[str] = None) -> Flow:
    default_redirect = redirect_uri or os.getenv("GMAIL_REDIRECT_URI") or "http://localhost:8080/gmail/oauth2callback"
    env_json = os.getenv("GMAIL_CREDENTIALS_JSON") or os.getenv("GOOGLE_OAUTH_CLIENT_JSON")
    if env_json:
        try:
            info = json.loads(env_json)
            return Flow.from_client_config(info, scopes=SCOPES, redirect_uri=default_redirect)
        except Exception as e:
            print(f"[gmail_client] Error loading GMAIL_CREDENTIALS_JSON env var: {e}")
    if _CREDS_PATH.exists():
        return Flow.from_client_secrets_file(str(_CREDS_PATH), scopes=SCOPES, redirect_uri=default_redirect)

    raise FileNotFoundError(
        "Missing Google OAuth 2.0 client credentials. "
        "Set GMAIL_CREDENTIALS_JSON environment variable or place credentials.json in the project root."
    )


def get_auth_url(user_id: Optional[str] = None, redirect_uri: Optional[str] = None) -> str:
    """Generate Google OAuth authorization URL for the user consent screen."""
    flow = _get_flow(redirect_uri=redirect_uri)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        state=user_id or ""
    )
    return auth_url


def exchange_code_for_tokens(user_id: str, code: str, redirect_uri: Optional[str] = None) -> dict:
    """Exchange authorization code for OAuth credentials and save to user's Firestore doc."""
    if not user_id:
        raise ValueError("user_id is required for OAuth token exchange.")

    flow = _get_flow(redirect_uri=redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    email_addr = profile.get("emailAddress")

    db = _get_firestore_db()
    if db:
        from google.cloud import firestore
        db.collection("gmail_connections").document(user_id).set({
            "user_id": user_id,
            "connected_email": email_addr,
            "tokens_json": creds.to_json(),
            "updated_at": firestore.SERVER_TIMESTAMP,
        }, merge=True)
    else:
        # Save locally if in local dev mode
        _TOKEN_PATH.write_text(creds.to_json())

    return {
        "status": "connected",
        "user_id": user_id,
        "email": email_addr,
    }


def get_connected_gmail(user_id: Optional[str] = None) -> Optional[str]:
    """Return authorized email address for a given user_id or None if disconnected."""
    try:
        service = get_service(user_id)
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress")
    except Exception:
        return None


def connect_gmail(user_id: str, tokens_or_code: dict | str) -> dict:
    """Store direct token dictionary or JSON string for user_id."""
    if not user_id:
        raise ValueError("user_id is required to connect Gmail.")

    if isinstance(tokens_or_code, str):
        info = json.loads(tokens_or_code)
    else:
        info = tokens_or_code

    creds = Credentials.from_authorized_user_info(info, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    email_addr = profile.get("emailAddress")

    db = _get_firestore_db()
    if db:
        from google.cloud import firestore
        db.collection("gmail_connections").document(user_id).set({
            "user_id": user_id,
            "connected_email": email_addr,
            "tokens_json": creds.to_json(),
            "updated_at": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return {
        "status": "connected",
        "user_id": user_id,
        "email": email_addr,
    }


def disconnect_gmail(user_id: str) -> dict:
    """Disconnect Gmail integration for a given user_id."""
    db = _get_firestore_db()
    if db:
        db.collection("gmail_connections").document(user_id).delete()
    if _TOKEN_PATH.exists() and os.getenv("LOOPKEEPER_LOCAL_DEV") == "1":
        try:
            _TOKEN_PATH.unlink()
        except Exception:
            pass
    return {"status": "disconnected", "user_id": user_id}


def send_email(to: str, subject: str, body: str, user_id: Optional[str] = None) -> dict:
    """Send an email using user_id's connected Gmail account."""
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    service = get_service(user_id)
    return service.users().messages().send(userId="me", body={"raw": raw}).execute()


def list_new_replies(query: str = "newer_than:1d", user_id: Optional[str] = None) -> list[dict]:
    """Search user's inbox for matching incoming email summaries."""
    try:
        service = get_service(user_id)
    except Exception as e:
        print(f"[gmail_client] Skipping inbox check for user '{user_id}': {e}")
        return []

    results = service.users().messages().list(userId="me", q=query, maxResults=25).execute()
    message_stubs = results.get("messages", [])

    replies = []
    for stub in message_stubs:
        try:
            full = service.users().messages().get(
                userId="me", id=stub["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            ).execute()
            headers = {h["name"]: h["value"] for h in full.get("payload", {}).get("headers", [])}
            replies.append({
                "message_id": stub["id"],
                "from": headers.get("From", ""),
                "subject": headers.get("Subject", ""),
                "snippet": full.get("snippet", ""),
                "date": headers.get("Date", ""),
            })
        except Exception:
            continue
    return replies