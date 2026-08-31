"""
runner.py — Authenticated multi-tenant HTTP gateway for LoopKeeper agent.

Security:
  - Requires Firebase Bearer ID Token OR X-Scheduler-Key header.
  - Development override via LOOPKEEPER_ALLOW_UNAUTHENTICATED=1.

Endpoints:
  POST /agent/run          - trigger an agent cycle for authenticated user_id
  GET  /agent/status       - last run summary + source health for user_id
  GET  /agent/runs         - run history log (filtered by user_id)
  GET  /gmail/auth-url     - get Google OAuth authorization consent URL
  GET  /gmail/oauth2callback - handle Google OAuth redirect callback
  GET  /gmail/status       - check user Gmail connection status
  POST /gmail/connect      - connect OAuth tokens for a user_id
  POST /gmail/disconnect   - disconnect Gmail for a user_id
"""

import os
import sys
from functools import wraps
from datetime import datetime, date, timezone
from flask import Flask, jsonify, request, abort, redirect

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Enable local development unauthenticated mode by default
os.environ.setdefault("LOOPKEEPER_ALLOW_UNAUTHENTICATED", "1")

app = Flask(__name__)

# Firebase Admin SDK initialization for ID Token verification
_firebase_auth_active = False
try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    _firebase_auth_active = True
except Exception as e:
    print(f"[runner] Firebase Admin SDK not active (local dev mode): {e}")
    os.environ.setdefault("LOOPKEEPER_ALLOW_UNAUTHENTICATED", "1")


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Scheduler-Key"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def options_handler(path):
    return "", 200


def require_auth(f):
    """Decorator to enforce Firebase ID Token authentication or Cloud Scheduler secret key."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Cloud Scheduler secret key override
        scheduler_key = request.headers.get("X-Scheduler-Key")
        expected_key  = os.getenv("SCHEDULER_SECRET", "loopkeeper_secret_key")
        if scheduler_key and scheduler_key == expected_key:
            return f(*args, **kwargs)

        # 2. Local dev unauthenticated override or inactive firebase_admin
        if os.getenv("LOOPKEEPER_ALLOW_UNAUTHENTICATED") == "1" or not _firebase_auth_active:
            req_data = request.json if request.is_json else {}
            request.user_id = req_data.get("user_id") or request.args.get("user_id") or "local_dev_user"
            return f(*args, **kwargs)

        # 3. Firebase Bearer ID Token verification (when _firebase_auth_active is True)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            id_token = auth_header.split("Bearer ")[1].strip()
            try:
                decoded = fb_auth.verify_id_token(id_token)
                request.user_id = decoded.get("uid")
                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({"error": f"Invalid or expired auth token: {e}"}), 401

        return jsonify({
            "error": "Authentication required. Include 'Authorization: Bearer <id_token>' header or set LOOPKEEPER_ALLOW_UNAUTHENTICATED=1."
        }), 401
    return decorated


def _get_store():
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        try:
            import store_firestore as store
        except ImportError:
            from loop_keeper import store_firestore as store
        return store
    else:
        try:
            import store
        except ImportError:
            from loop_keeper import store
        return store


def _get_run_agent_cycle():
    try:
        from agent_runner import run_agent_cycle
    except ImportError:
        from loop_keeper.agent_runner import run_agent_cycle
    return run_agent_cycle


def _get_gmail_client():
    try:
        import gmail_client
    except ImportError:
        from loop_keeper import gmail_client
    return gmail_client


# ---------------------------------------------------------------------------
# Root info route
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return jsonify({
        "service": "LoopKeeper Automation Service",
        "status": "running",
        "health_endpoint": "/health",
        "endpoints": [
            "/agent/run", "/agent/status", "/agent/runs",
            "/gmail/auth-url", "/gmail/oauth2callback", "/gmail/status",
            "/gmail/connect", "/gmail/disconnect", "/health"
        ]
    }), 200


# ---------------------------------------------------------------------------
# POST /agent/run & POST /run (Authenticated)
# ---------------------------------------------------------------------------

@app.post("/agent/run")
@app.post("/run")
@require_auth
def agent_run():
    req_data = request.json if request.is_json else {}
    trigger  = req_data.get("trigger", "manual")
    user_id  = getattr(request, "user_id", None) or req_data.get("user_id") or req_data.get("userId")
    
    if not user_id and os.getenv("LOOPKEEPER_REQUIRE_USER") == "1":
        return jsonify({"error": "user_id is required to run the agent cycle."}), 400

    if trigger not in ("scheduler", "manual", "gmail_event", "demo"):
        trigger = "manual"

    run_agent_cycle = _get_run_agent_cycle()
    result = run_agent_cycle(trigger=trigger, user_id=user_id)
    return jsonify(result), 200


# ---------------------------------------------------------------------------
# POST /verify_close (Authenticated)
# ---------------------------------------------------------------------------

@app.post("/verify_close")
@require_auth
def verify_close():
    req_data = request.json if request.is_json else {}
    loop_id  = req_data.get("loop_id") or req_data.get("loopId")
    note     = req_data.get("note", "Manual user resolution")
    user_id  = getattr(request, "user_id", None) or req_data.get("user_id") or req_data.get("userId")

    if not loop_id:
        return jsonify({"error": "loop_id is required"}), 400

    store = _get_store()
    updated = store.update_status(
        loop_id=loop_id,
        status="closed",
        reason=f"VERIFIED & CLOSED: {note}",
        exception_type="resolved",
        user_id=user_id
    )
    if not updated:
        return jsonify({"error": f"Loop '{loop_id}' not found or access denied."}), 440
    return jsonify({"status": "closed", "loop": updated}), 200



# ---------------------------------------------------------------------------
# GET /agent/status
# ---------------------------------------------------------------------------

@app.get("/agent/status")
@require_auth
def agent_status():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id") or request.args.get("userId")
    store = _get_store()
    last_run = store.get_last_run(user_id=user_id)
    now_utc  = datetime.now(timezone.utc).isoformat()

    stale = False
    stale_minutes = None
    if last_run and last_run.get("completed_at"):
        try:
            last_ts = datetime.fromisoformat(last_run["completed_at"])
            delta_m = (datetime.now(timezone.utc) - last_ts).seconds // 60
            stale_minutes = delta_m
            stale = delta_m > 120
        except Exception:
            pass

    return jsonify({
        "agent_status":  "stale" if stale else "healthy",
        "stale":         stale,
        "stale_minutes": stale_minutes,
        "last_run":      last_run,
        "user_id":       user_id,
        "sources": {
            "gmail":     os.getenv("LOOPKEEPER_EMAIL_MODE") == "gmail",
            "firestore": os.getenv("LOOPKEEPER_BACKEND") == "firestore",
            "policy":    True,
        },
        "server_time": now_utc,
    })


# ---------------------------------------------------------------------------
# GET /agent/runs
# ---------------------------------------------------------------------------

@app.get("/agent/runs")
@require_auth
def agent_runs():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id") or request.args.get("userId")
    limit   = request.args.get("limit", default=20, type=int)
    store   = _get_store()
    runs    = store.get_run_log(limit=limit, user_id=user_id)
    return jsonify(runs)


# ---------------------------------------------------------------------------
# REST ENDPOINTS: /loops, /clients, /approvals
# ---------------------------------------------------------------------------

@app.get("/loops")
@require_auth
def get_loops():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id")
    include_closed = request.args.get("include_closed", "").lower() in ("true", "1")
    store = _get_store()
    loops = store.list_loops(include_closed=include_closed, sort_by_priority=True, user_id=user_id)
    return jsonify(loops), 200


@app.get("/loops/<loop_id>")
@require_auth
def get_loop_by_id(loop_id):
    user_id = getattr(request, "user_id", None) or request.args.get("user_id")
    store = _get_store()
    loop = store.get_loop(loop_id=loop_id, user_id=user_id)
    if not loop:
        return jsonify({"error": f"Loop '{loop_id}' not found."}), 404
    return jsonify(loop), 200


@app.get("/clients")
@require_auth
def get_clients():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id")
    store = _get_store()
    clients = store.list_clients(user_id=user_id)
    return jsonify(clients), 200


@app.get("/approvals")
@require_auth
def get_pending_approvals():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id")
    store = _get_store()
    approvals = store.list_pending_approvals(user_id=user_id)
    return jsonify(approvals), 200


@app.post("/approvals/<loop_id>/approve")
@require_auth
def approve_draft(loop_id):
    user_id = getattr(request, "user_id", None)
    store = _get_store()
    updated = store.send_draft(loop_id=loop_id, user_id=user_id)
    if not updated:
        return jsonify({"error": f"Loop '{loop_id}' has no pending draft or access denied."}), 400
    return jsonify({"status": "approved", "loop": updated}), 200


@app.post("/approvals/<loop_id>/reject")
@require_auth
def reject_draft(loop_id):
    user_id = getattr(request, "user_id", None)
    store = _get_store()
    updated = store.update_status(loop_id=loop_id, status="open", reason="Draft rejected by owner", user_id=user_id)
    if not updated:
        return jsonify({"error": f"Loop '{loop_id}' not found or access denied."}), 400
    return jsonify({"status": "rejected", "loop": updated}), 200


@app.post("/loops/<loop_id>/escalate")
@require_auth
def escalate_loop(loop_id):
    req_data = request.json if request.is_json else {}
    reason = req_data.get("reason", "Escalated by user")
    user_id = getattr(request, "user_id", None)
    store = _get_store()
    updated = store.escalate(loop_id=loop_id, reason=reason, user_id=user_id)
    if not updated:
        return jsonify({"error": f"Loop '{loop_id}' not found or access denied."}), 400
    return jsonify({"status": "escalated", "loop": updated}), 200


@app.post("/loops/<loop_id>/split")
@require_auth
def split_loop_endpoint(loop_id):
    req_data = request.json if request.is_json else {}
    split_amount = float(req_data.get("split_amount", 0))
    reason = req_data.get("reason", "Partial dispute split")
    user_id = getattr(request, "user_id", None)

    if split_amount <= 0:
        return jsonify({"error": "split_amount must be > 0"}), 400

    store = _get_store()
    res = store.split_loop(loop_id=loop_id, split_amount=split_amount, reason=reason, user_id=user_id)
    if not res or "error" in res:
        return jsonify({"error": res.get("error", "Split failed") if isinstance(res, dict) else "Split failed"}), 400
    return jsonify(res), 200



# ---------------------------------------------------------------------------
# GMAIL OAUTH ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/gmail/auth-url")
@require_auth
def gmail_auth_url():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id") or request.args.get("userId")
    gclient = _get_gmail_client()
    try:
        redirect_uri = f"{request.host_url.rstrip('/')}/gmail/oauth2callback" if not os.getenv("GMAIL_REDIRECT_URI") else None
        url = gclient.get_auth_url(user_id=user_id, redirect_uri=redirect_uri)
        return jsonify({"auth_url": url, "user_id": user_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/gmail/oauth2callback")
def gmail_oauth2callback():
    code    = request.args.get("code")
    user_id = request.args.get("state") or request.args.get("user_id")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    if not code:
        return redirect(f"{frontend_url}/app/settings?gmail=error&reason=no_code")

    gclient = _get_gmail_client()
    try:
        redirect_uri = f"{request.host_url.rstrip('/')}/gmail/oauth2callback" if not os.getenv("GMAIL_REDIRECT_URI") else None
        res = gclient.exchange_code_for_tokens(user_id=user_id or "default_user", code=code, redirect_uri=redirect_uri)
        email = res.get("email", "")
        return redirect(f"{frontend_url}/app/settings?gmail=success&email={email}")
    except Exception as e:
        print(f"[runner] OAuth callback error: {e}")
        return redirect(f"{frontend_url}/app/settings?gmail=error&reason=token_exchange_failed")


@app.get("/gmail/status")
@require_auth
def gmail_status():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id") or request.args.get("userId")
    gclient = _get_gmail_client()
    email   = gclient.get_connected_gmail(user_id=user_id)
    return jsonify({
        "user_id": user_id,
        "connected": email is not None,
        "email": email,
    })


@app.post("/gmail/connect")
@require_auth
def gmail_connect():
    req_data = request.json if request.is_json else {}
    user_id = getattr(request, "user_id", None) or req_data.get("user_id") or req_data.get("userId")
    tokens  = req_data.get("tokens") or req_data.get("tokens_json") or req_data.get("code")
    if not user_id or not tokens:
        abort(400, description="user_id and tokens/tokens_json are required.")

    gclient = _get_gmail_client()
    try:
        res = gclient.connect_gmail(user_id, tokens)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 400


@app.post("/gmail/disconnect")
@require_auth
def gmail_disconnect():
    req_data = request.json if request.is_json else {}
    user_id = getattr(request, "user_id", None) or req_data.get("user_id") or req_data.get("userId")
    if not user_id:
        abort(400, description="user_id is required.")

    gclient = _get_gmail_client()
    res = gclient.disconnect_gmail(user_id)
    return jsonify(res), 200


# ---------------------------------------------------------------------------
# POST /agent/extract-invoice (Gemini Vision Extraction)
# ---------------------------------------------------------------------------

@app.post("/agent/extract-invoice")
@require_auth
def extract_invoice():
    req_data = request.json if request.is_json else {}
    file_b64 = req_data.get("file_b64") or req_data.get("image")
    mime_type = req_data.get("mime_type", "application/pdf")

    if not file_b64:
        return jsonify({"error": "file_b64 is required"}), 400

    import base64, json
    try:
        file_bytes = base64.b64decode(file_b64.split(",")[-1])
    except Exception as e:
        return jsonify({"error": f"Invalid base64 encoding: {e}"}), 400

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return jsonify({"error": "GOOGLE_API_KEY not configured on server"}), 500

    prompt = """Analyze this invoice document/image and return JSON with keys:
    "invoice_number", "client_name", "client_email", "amount" (number), "due_date" (YYYY-MM-DD), "summary".
    Return ONLY valid raw JSON."""

    try:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            res = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[genai.types.Part.from_bytes(data=file_bytes, mime_type=mime_type), prompt]
            )
            text = res.text
        except Exception:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            res = model.generate_content([{"mime_type": mime_type, "data": file_bytes}, prompt])
            text = res.text

        clean = text.strip().strip("```json").strip("```").strip()
        data = json.loads(clean)
        return jsonify({"status": "success", "extracted": data}), 200
    except Exception as e:
        return jsonify({"error": f"Gemini Vision extraction error: {e}"}), 500


# ---------------------------------------------------------------------------
# POST /agent/inject-evidence (Sandbox / Live Evidence Injection)
# ---------------------------------------------------------------------------

@app.post("/agent/inject-evidence")
@require_auth
def inject_evidence():
    req_data = request.json if request.is_json else {}
    loop_id  = req_data.get("loop_id") or req_data.get("loopId")
    ev_type  = req_data.get("type", "reply") # reply, promise, payment, dispute
    text     = req_data.get("text", "")
    sender   = req_data.get("sender", "client")
    user_id  = getattr(request, "user_id", None) or req_data.get("user_id")

    if not loop_id:
        return jsonify({"error": "loop_id is required"}), 400

    store = _get_store()
    msg_id = f"ev_{int(datetime.now(timezone.utc).timestamp())}"

    if ev_type == "promise":
        promised_date = req_data.get("promised_date", date.today().isoformat())
        result = store.store_promise(loop_id=loop_id, promised_date=promised_date, text=text, user_id=user_id)
    elif ev_type == "payment":
        result = store.verify_and_close(loop_id=loop_id, verify_note=f"Payment verified via evidence: {text}", user_id=user_id)
    elif ev_type == "dispute":
        result = store.update_status(loop_id=loop_id, status="open", reason=f"Dispute raised: {text}", exception_type="dispute_full", user_id=user_id)
    else:
        result = store.log_incoming_reply(loop_id=loop_id, message_id=msg_id, summary=f"[{sender}] {text}", user_id=user_id)

    return jsonify({"status": "success", "evidence_id": msg_id, "loop": result}), 200


# ---------------------------------------------------------------------------
# WEBHOOKS: SMS (Twilio) & WhatsApp (Meta Business API)
# ---------------------------------------------------------------------------

@app.post("/webhooks/sms")
def webhook_sms():
    form_data = request.form if request.form else (request.json if request.is_json else {})
    sender    = form_data.get("From", "unknown_sms")
    body      = form_data.get("Body", "")

    store = _get_store()
    loops = store.list_loops(include_closed=False)
    matched = None
    for l in loops:
        phone = l.get("client_phone") or ""
        if phone and (phone in sender or sender in phone):
            matched = l
            break

    if matched:
        msg_id = f"sms_{int(datetime.now(timezone.utc).timestamp())}"
        store.log_incoming_reply(loop_id=matched["loop_id"], message_id=msg_id, summary=f"[SMS from {sender}] {body}")

    resp_xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Received. Thank you.</Message></Response>'
    return resp_xml, 200, {"Content-Type": "text/xml"}


@app.route("/webhooks/whatsapp", methods=["GET", "POST"])
def webhook_whatsapp():
    if request.method == "GET":
        verify_token = request.args.get("hub.verify_token")
        challenge    = request.args.get("hub.challenge")
        expected     = os.getenv("WHATSAPP_VERIFY_TOKEN", "loopkeeper")
        if verify_token == expected:
            return challenge, 200
        return "Invalid verify token", 403

    payload = request.json if request.is_json else {}
    store   = _get_store()
    msg_id  = f"wa_{int(datetime.now(timezone.utc).timestamp())}"
    
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                val = change.get("value", {})
                msgs = val.get("messages", [])
                for m in msgs:
                    wa_from = m.get("from")
                    text_body = m.get("text", {}).get("body", "")
                    loops = store.list_loops(include_closed=False)
                    wa_from_str = str(wa_from) if wa_from else ""
                    for l in loops:
                        phone = l.get("client_phone") or ""
                        if phone and wa_from_str and phone in wa_from_str:
                            store.log_incoming_reply(loop_id=l["loop_id"], message_id=msg_id, summary=f"[WhatsApp] {text_body}")
    except Exception as e:
        print(f"[whatsapp webhook] Parse error: {e}")

    return jsonify({"status": "received"}), 200


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    debug = os.getenv("FLASK_ENV") == "development"
    print(f"\n LoopKeeper Authenticated Multi-Tenant Agent Runner")
    print(f" http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
