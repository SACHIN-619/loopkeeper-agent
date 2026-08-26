"""
gmail_client.py — real Gmail send + read. Everything in here is gated
behind LOOPKEEPER_EMAIL_MODE=gmail (see agent.py) — nothing here runs
unless you've deliberately turned it on, so local testing never needs
real credentials in hand.

One-time setup (on your own machine — OAuth needs a real browser, this
can't run in a sandbox):
  1. console.cloud.google.com -> APIs & Services -> enable "Gmail API"
  2. Same place -> Credentials -> Create OAuth client ID -> Desktop app
     -> download the JSON -> save it as loop_keeper/credentials.json
  3. The first time anything here actually runs, a browser window opens
     asking you to log in and approve access. A token.json gets cached
     next to credentials.json after that — you won't see the browser
     again until the token expires, and even then it refreshes silently.

credentials.json and token.json are both secrets. Check they're in
.gitignore before you ever commit — they are not the same file as
.env and neither should end up in your repo.
"""

import base64
from email.mime.text import MIMEText
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# "modify" covers both reading and sending, which is everything this
# file does — no reason to request a broader scope than that.
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

_CREDS_PATH = Path(__file__).parent / "credentials.json"
_TOKEN_PATH = Path(__file__).parent / "token.json"

# Lazy singleton, same pattern as store_firestore.py's _client(): importing
# this module should never itself trigger a login prompt — only actually
# calling send_email() or list_new_replies() should.
_service = None


def _get_service():
    global _service
    if _service is not None:
        return _service

    creds = None
    if _TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(_TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())  # silent — no browser needed for a refresh
        else:
            if not _CREDS_PATH.exists():
                raise FileNotFoundError(
                    f"No {_CREDS_PATH.name} found next to gmail_client.py. "
                    f"Download an OAuth client ID (type: Desktop app) from "
                    f"Google Cloud Console and save it there first."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(_CREDS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)  # opens a browser — one time only
        _TOKEN_PATH.write_text(creds.to_json())  # cache so next run skips the browser

    _service = build("gmail", "v1", credentials=creds)
    return _service


def send_email(to: str, subject: str, body: str) -> dict:
    """Send a real email. Returns Gmail's own response dict (has an "id")
    so a caller could later check delivery status if it mattered — for
    now we just trust a non-error return means it was accepted.
    """
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return _get_service().users().messages().send(userId="me", body={"raw": raw}).execute()


def list_new_replies(query: str = "newer_than:1d") -> list[dict]:
    """Search the inbox and return a lightweight summary of each match —
    from, subject, snippet, date — not the full message body. That's
    all the agent needs to decide whether something's worth pulling in;
    it doesn't need the entire raw email just to notice one arrived.

    `query` uses Gmail's own search syntax, e.g. "from:x@y.com newer_than:2d".
    Default catches anything from the last day, which is enough for a
    scheduler that wakes up every few hours (see the Cloud Scheduler note
    in README.md).
    """
    service = _get_service()
    results = service.users().messages().list(userId="me", q=query, maxResults=25).execute()
    message_stubs = results.get("messages", [])

    replies = []
    for stub in message_stubs:
        full = service.users().messages().get(
            userId="me", id=stub["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"],
        ).execute()
        headers = {h["name"]: h["value"] for h in full["payload"]["headers"]}
        replies.append({
            "message_id": stub["id"],
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", ""),
            "snippet": full.get("snippet", ""),
            "date": headers.get("Date", ""),
        })
    return replies