"""
runner.py — HTTP gateway for the LoopKeeper agent.

Thin layer only. Zero business logic here.
All logic lives in agent_runner.py → agent.py → store.py → policy.py.

Endpoints:
  POST /agent/run          - trigger a full agent cycle
  GET  /agent/status       - last run summary + source health
  POST /agent/inject-evidence - inject simulated evidence (sandbox only)

Run locally:
  python -m loop_keeper.runner

Cloud Run / any WSGI host:
  gunicorn loop_keeper.runner:app

Cloud Scheduler calls:
  POST https://<your-run-url>/agent/run
  (no body needed — trigger defaults to 'scheduler')
"""

import os
from datetime import datetime, timezone
from flask import Flask, jsonify, request, abort

app = Flask(__name__)

# Add CORS headers so frontend dev server (http://localhost:5173) can reach Flask runner without CORS errors
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.options("/<path:path>")
def options_handler(path):
    return "", 200

# ---------------------------------------------------------------------------
# Root info route
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    """Friendly root endpoint for development & service checks."""
    return jsonify({
        "service": "LoopKeeper Automation Service",
        "status": "running",
        "health_endpoint": "/health",
        "endpoints": ["/agent/run", "/agent/status", "/agent/runs", "/agent/inject-evidence", "/health"]
    }), 200

@app.post("/agent/run")
def agent_run():
    """Trigger a full agent cycle. Returns the run log record as JSON."""
    trigger = request.json.get("trigger", "scheduler") if request.is_json else "scheduler"
    if trigger not in ("scheduler", "manual", "gmail_event", "demo"):
        trigger = "manual"

    from loop_keeper.agent_runner import run_agent_cycle
    result = run_agent_cycle(trigger=trigger)
    status_code = 200 if result["status"] == "completed" else 500
    return jsonify(result), status_code


# ---------------------------------------------------------------------------
# GET /agent/status
# ---------------------------------------------------------------------------

@app.get("/agent/status")
def agent_status():
    """Return the last run summary and source health check."""
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        from loop_keeper import store_firestore as store
    else:
        from loop_keeper import store

    last_run = store.get_last_run()
    now_utc  = datetime.now(timezone.utc).isoformat()

    # Compute staleness
    stale = False
    stale_minutes = None
    if last_run and last_run.get("completed_at"):
        try:
            last_ts = datetime.fromisoformat(last_run["completed_at"])
            delta_m = (datetime.now(timezone.utc) - last_ts).seconds // 60
            stale_minutes = delta_m
            stale = delta_m > 120  # stale after 2 hours
        except Exception:
            pass

    return jsonify({
        "agent_status":  "stale" if stale else "healthy",
        "stale":         stale,
        "stale_minutes": stale_minutes,
        "last_run":      last_run,
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
def agent_runs():
    """Return the recent run history log."""
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        from loop_keeper import store_firestore as store
    else:
        from loop_keeper import store

    limit = request.args.get("limit", default=20, type=int)
    runs = store.get_run_log(limit=limit)
    return jsonify(runs)



# ---------------------------------------------------------------------------
# POST /agent/inject-evidence  (SANDBOX ONLY)
# ---------------------------------------------------------------------------

@app.post("/agent/inject-evidence")
def inject_evidence():
    """
    Inject simulated evidence into a loop — SANDBOX MODE ONLY.

    Body:
      {
        "loop_id":      "inv_1005",
        "type":         "promise" | "payment" | "dispute" | "advance_deadline",
        "text":         "We'll pay by Friday",        // for promise/payment/dispute
        "promised_date": "2026-08-29"                 // for promise (ISO date)
      }

    This enters the SAME store.py path as real Gmail evidence.
    No frontend fake state. If this server isn't running, the
    frontend shows 'Agent backend unavailable' — no silent fallback.
    """
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        abort(403, description="Evidence injection is only available in sandbox mode (LOOPKEEPER_BACKEND=json).")

    from loop_keeper import store

    body = request.get_json(force=True, silent=True) or {}
    loop_id      = body.get("loop_id")
    ev_type      = body.get("type")
    text         = body.get("text", "")
    promised_date = body.get("promised_date")

    if not loop_id or not ev_type:
        abort(400, description="loop_id and type are required.")

    valid_types = ("promise", "payment", "dispute", "advance_deadline")
    if ev_type not in valid_types:
        abort(400, description=f"type must be one of {valid_types}")

    loop = store.get_loop(loop_id)
    if not loop:
        abort(404, description=f"No loop found: {loop_id}")

    # Route to the correct store mutation
    if ev_type == "promise":
        if not promised_date:
            abort(400, description="promised_date (ISO date) required for type=promise")
        result = store.store_promise(loop_id, promised_date, text)

    elif ev_type == "payment":
        result = store.log_incoming_reply(
            loop_id,
            message_id=f"sim_{loop_id}_payment",
            summary=f"[email] client replied: {text or 'Payment has been sent.'}"
        )

    elif ev_type == "dispute":
        result = store.log_incoming_reply(
            loop_id,
            message_id=f"sim_{loop_id}_dispute",
            summary=f"[email] client replied: {text or 'We dispute this invoice.'}"
        )
        store.update_status(loop_id, "disputed", "Dispute raised via injected evidence.", "dispute_partial")

    elif ev_type == "advance_deadline":
        # Set promise_date to yesterday so the deterministic checker fires
        from datetime import date, timedelta
        yesterday = str(date.today() - timedelta(days=1))
        result = store.store_promise(loop_id, yesterday, "demo: deadline advanced for demonstration")
        broken = store.check_broken_promises()
        return jsonify({
            "injected": True,
            "type": ev_type,
            "broken_now": [l.get("loop_id") for l in broken],
            "loop": result,
        })

    if isinstance(result, dict) and "error" in result:
        abort(422, description=result["error"])

    return jsonify({"injected": True, "type": ev_type, "loop": result})



# ---------------------------------------------------------------------------
# POST /webhooks/sms  — Twilio / any SMS gateway
# ---------------------------------------------------------------------------

@app.post("/webhooks/sms")
def sms_webhook():
    """
    Receives an incoming SMS via Twilio webhook (or any compatible gateway).
    Normalizes payload → log_incoming_reply() → same agent state machine.

    Twilio sends form-encoded POST with fields:
      From, Body, MessageSid, SmsSid, To

    Set in Twilio Console:
      Messaging → Active Numbers → <your number> → Incoming Message URL
      → https://<your-cloud-run-url>/webhooks/sms
    """
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        from loop_keeper import store_firestore as store
    else:
        from loop_keeper import store

    # Twilio sends form-encoded data
    sender  = request.form.get("From", "").strip()
    body    = request.form.get("Body", "").strip()
    msg_id  = request.form.get("MessageSid") or request.form.get("SmsSid", "")

    if not sender or not body:
        # Accept silently — Twilio expects 200 even for ignored messages
        return "", 204

    # Match sender phone to a known client loop
    matched_loop_id = None
    for loop in store.list_loops(include_closed=False):
        client = store.get_loop(loop["loop_id"]) or {}
        client_phone = (client.get("client_phone") or "").replace(" ", "").replace("-", "")
        if client_phone and client_phone in sender.replace(" ", "").replace("-", ""):
            matched_loop_id = loop["loop_id"]
            break

    if matched_loop_id and msg_id:
        store.log_incoming_reply(
            matched_loop_id,
            message_id=f"sms_{msg_id}",
            summary=f"[sms] {sender} replied: {body[:300]}",
        )

    # Return empty TwiML — no auto-reply
    return "<Response></Response>", 200, {"Content-Type": "text/xml"}


# ---------------------------------------------------------------------------
# POST /webhooks/whatsapp  — Meta WhatsApp Business API
# ---------------------------------------------------------------------------

@app.post("/webhooks/whatsapp")
def whatsapp_webhook():
    """
    Receives Meta WhatsApp Business messages.
    Normalizes → log_incoming_reply() → same agent state machine.

    Meta sends JSON with structure:
      entry[].changes[].value.messages[].{from, body.text, id}

    Verify webhook in Meta Developer Console:
      GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
    """
    # Meta verification handshake
    if request.method == "GET":
        verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "loopkeeper")
        mode      = request.args.get("hub.mode")
        token     = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")
        if mode == "subscribe" and token == verify_token:
            return challenge, 200
        return "Forbidden", 403

    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        from loop_keeper import store_firestore as store
    else:
        from loop_keeper import store

    payload = request.get_json(force=True, silent=True) or {}
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                msgs = change.get("value", {}).get("messages", [])
                for msg in msgs:
                    sender = msg.get("from", "")
                    text   = msg.get("text", {}).get("body", "") or msg.get("caption", "")
                    msg_id = msg.get("id", "")
                    if not (sender and text and msg_id):
                        continue
                    # Match sender phone to a known client loop
                    for loop in store.list_loops(include_closed=False):
                        client = store.get_loop(loop["loop_id"]) or {}
                        client_phone = (client.get("client_phone") or "").replace(" ", "")
                        if client_phone and client_phone in sender.replace(" ", ""):
                            store.log_incoming_reply(
                                loop["loop_id"],
                                message_id=f"wa_{msg_id}",
                                summary=f"[whatsapp] {sender} replied: {text[:300]}",
                            )
                            break
    except Exception:
        pass  # Always return 200 so Meta doesn't retry

    return jsonify({"status": "received"}), 200


@app.get("/webhooks/whatsapp")
def whatsapp_verify():
    """Meta webhook verification GET handler."""
    return whatsapp_webhook()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    debug = os.getenv("FLASK_ENV") == "development"
    print(f"\n LoopKeeper Agent Runner")
    print(f" POST /agent/run               → trigger agent cycle")
    print(f" GET  /agent/status            → last run + health")
    print(f" GET  /agent/runs              → run history")
    print(f" POST /agent/inject-evidence   → sandbox evidence injection")
    print(f" POST /webhooks/sms            → Twilio SMS webhook")
    print(f" POST /webhooks/whatsapp       → Meta WhatsApp webhook")
    print(f" GET  /health                  → health check")
    print(f" http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
