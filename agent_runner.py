"""
agent_runner.py — Reusable agent execution core.

ONE function: run_agent_cycle(trigger)

Called by:
  - runner.py HTTP endpoint (POST /agent/run)
  - Cloud Scheduler (via that same HTTP endpoint)
  - Local testing / curl
  - Future webhook

The HTTP layer never contains business logic. This file never knows
who called it — it only knows how to run the agent and record what happened.

Usage:
    from loop_keeper.agent_runner import run_agent_cycle
    result = run_agent_cycle(trigger="scheduler")
"""

import os
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Lazy ADK import — only needed when the agent actually runs.
# This lets the module import safely even without google-adk installed
# (e.g., in pure frontend-only local dev).
# ---------------------------------------------------------------------------

def _get_runner():
    """Return a fresh ADK InMemoryRunner for the root agent."""
    from google.adk.runners import InMemoryRunner
    from loop_keeper.agent import root_agent
    return InMemoryRunner(agent=root_agent)


def run_agent_cycle(trigger: str = "manual") -> dict:
    """
    Execute one full agent cycle: observe → reason → decide → act → record.

    trigger: one of 'scheduler' | 'manual' | 'gmail_event' | 'demo'
             stored in the run log so every execution is traceable.

    Returns a structured RunResult dict that runner.py can return as JSON
    and store.save_run_log() can persist.
    """
    # -----------------------------------------------------------------
    # 0. Pre-run: deterministic promise check (no LLM involved).
    #    This runs BEFORE the agent so broken promises are already
    #    surfaced when the agent reads loop state.
    # -----------------------------------------------------------------
    # Import store dynamically so LOOPKEEPER_BACKEND is already set
    if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
        from loop_keeper import store_firestore as store
    else:
        from loop_keeper import store

    started_at = datetime.now(timezone.utc)
    run_id     = str(uuid.uuid4())[:8]

    # Deterministic broken-promise detection (pure date math, no LLM)
    broken_loops = store.check_broken_promises()

    # -----------------------------------------------------------------
    # 0.5. Gmail ingestion — fetch new replies and log them into loops
    #      BEFORE the agent reasons, so it sees the latest evidence.
    #      Gated behind LOOPKEEPER_EMAIL_MODE=gmail — silently skipped
    #      in sandbox mode so local dev never needs real credentials.
    # -----------------------------------------------------------------
    gmail_replies_processed = 0
    gmail_error: str | None = None

    if os.getenv("LOOPKEEPER_EMAIL_MODE") == "gmail":
        try:
            from loop_keeper.gmail_client import list_new_replies
            new_replies = list_new_replies(query="newer_than:1d label:inbox")
            loops_by_email = {
                store.get_loop(l["loop_id"]).get("client_email", "").lower(): l["loop_id"]
                for l in store.list_loops(include_closed=False)
                if store.get_loop(l["loop_id"])
            }
            for reply in new_replies:
                sender = reply.get("from", "").lower()
                msg_id = reply.get("message_id", "")
                snippet = reply.get("snippet", "")
                # Match sender email to a known client loop
                matched_loop_id = None
                for email_addr, loop_id in loops_by_email.items():
                    if email_addr and email_addr in sender:
                        matched_loop_id = loop_id
                        break
                if matched_loop_id and msg_id:
                    result = store.log_incoming_reply(
                        matched_loop_id,
                        message_id=msg_id,
                        summary=f"[gmail] {reply.get('from','')} replied: {snippet[:200]}",
                    )
                    if result and "error" not in result:
                        gmail_replies_processed += 1
        except Exception as e:
            gmail_error = str(e)

    # -----------------------------------------------------------------
    # 1. Run the ADK agent — this is where observe/reason/decide/act happens
    # -----------------------------------------------------------------
    decisions: list[dict] = []
    agent_error: str | None = None

    try:
        runner  = _get_runner()
        session = runner.create_session(user_id="system", session_id=run_id)
        
        # Kick off the agent with a standard prompt — the agent's own
        # instruction in agent.py defines the full protocol; we just start it.
        events = runner.run(
            user_id="system",
            session_id=run_id,
            new_message="Run your full cycle now. Check for new replies, process every open loop in priority order, and call get_resolution_report() at the end.",
        )

        # Collect tool-call decisions from the event stream
        for event in events:
            if hasattr(event, "actions") and event.actions:
                for action in event.actions:
                    if hasattr(action, "tool_use"):
                        tu = action.tool_use
                        decisions.append({
                            "tool":    tu.name if hasattr(tu, "name") else str(tu),
                            "loop_id": _extract_loop_id(tu),
                        })
            # Also capture final text response as run summary
            if hasattr(event, "text") and event.text:
                decisions.append({"summary": event.text[:400]})

    except Exception as e:
        agent_error = str(e)

    # -----------------------------------------------------------------
    # 2. Build the structured run log entry
    # -----------------------------------------------------------------
    completed_at  = datetime.now(timezone.utc)
    duration_ms   = int((completed_at - started_at).total_seconds() * 1000)

    # Count outcomes from decisions list
    emails_sent        = sum(1 for d in decisions if d.get("tool") == "send_followup")
    approvals_created  = sum(1 for d in decisions if d.get("tool") == "save_draft")
    resolved           = sum(1 for d in decisions if d.get("tool") == "verify_and_close")
    plans_changed      = len(broken_loops)  # deterministic re-plans

    run_record = {
        "run_id":                run_id,
        "trigger":               trigger,
        "started_at":            started_at.isoformat(),
        "completed_at":          completed_at.isoformat(),
        "duration_ms":           duration_ms,
        "status":                "failed" if agent_error else "completed",
        "error":                 agent_error,
        "loops_scanned":         len(store.list_loops(include_closed=False)),
        "broken_promises":       len(broken_loops),
        "plans_changed":         plans_changed,
        "emails_sent":           emails_sent,
        "approvals_created":     approvals_created,
        "resolved":              resolved,
        "failures":              1 if agent_error else 0,
        "decisions":             decisions[:50],  # cap at 50 for storage
        "broken_promise_loops":  [l.get("loop_id") for l in broken_loops],
        "gmail_replies_ingested": gmail_replies_processed,
        "gmail_error":           gmail_error,
        "sources": {
            "gmail":     os.getenv("LOOPKEEPER_EMAIL_MODE") == "gmail",
            "firestore": os.getenv("LOOPKEEPER_BACKEND") == "firestore",
            "policy":    True,
        },
    }

    # Persist the run log
    try:
        store.save_run_log(run_record)
    except Exception as e:
        run_record["log_save_error"] = str(e)

    return run_record


def _extract_loop_id(tool_use) -> str | None:
    """Best-effort extraction of loop_id from a tool call's input."""
    try:
        inp = tool_use.input if hasattr(tool_use, "input") else {}
        return inp.get("loop_id")
    except Exception:
        return None
