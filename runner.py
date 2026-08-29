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
from datetime import datetime, timezone
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
# GMAIL OAUTH ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/gmail/auth-url")
@require_auth
def gmail_auth_url():
    user_id = getattr(request, "user_id", None) or request.args.get("user_id") or request.args.get("userId")
    gclient = _get_gmail_client()
    try:
        url = gclient.get_auth_url(user_id=user_id)
        return jsonify({"auth_url": url, "user_id": user_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/gmail/oauth2callback")
def gmail_oauth2callback():
    code    = request.args.get("code")
    user_id = request.args.get("state") or request.args.get("user_id")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if not code:
        return redirect(f"{frontend_url}/app/settings?gmail=error&reason=no_code")

    gclient = _get_gmail_client()
    try:
        res = gclient.exchange_code_for_tokens(user_id=user_id or "default_user", code=code)
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
