"""
agent_runner.py — Reusable agent execution core with multi-tenant user_id scope.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional


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


def _get_runner():
    from google.adk.runners import InMemoryRunner
    try:
        from agent import root_agent
    except ImportError:
        from loop_keeper.agent import root_agent
    return InMemoryRunner(agent=root_agent)


def run_agent_cycle(trigger: str = "manual", user_id: Optional[str] = None) -> dict:
    """
    Execute one full agent cycle: observe → reason → decide → act → record.

    trigger: 'scheduler' | 'manual' | 'gmail_event' | 'demo'
    user_id: optional tenant/owner UID for isolated execution context.
    """
    # 0. Set current user_id in thread context for ADK tools
    try:
        from agent import set_current_user_id
    except ImportError:
        from loop_keeper.agent import set_current_user_id

    set_current_user_id(user_id)

    store = _get_store()
    started_at = datetime.now(timezone.utc)
    run_id     = str(uuid.uuid4())[:8]

    # Deterministic broken-promise detection for target user_id
    broken_loops = store.check_broken_promises(user_id=user_id)

    # 0.5. Gmail ingestion — fetch new replies for target user_id
    gmail_replies_processed = 0
    gmail_error: Optional[str] = None

    if os.getenv("LOOPKEEPER_EMAIL_MODE") == "gmail":
        try:
            try:
                from gmail_client import list_new_replies
            except ImportError:
                from loop_keeper.gmail_client import list_new_replies

            new_replies = list_new_replies(query="newer_than:1d label:inbox", user_id=user_id)
            loops_by_email = {
                (store.get_loop(l["loop_id"], user_id=user_id) or {}).get("client_email", "").lower(): l["loop_id"]
                for l in store.list_loops(include_closed=False, user_id=user_id)
                if store.get_loop(l["loop_id"], user_id=user_id)
            }
            for reply in new_replies:
                sender = reply.get("from", "").lower()
                msg_id = reply.get("message_id", "")
                snippet = reply.get("snippet", "")
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
                        user_id=user_id,
                    )
                    if result and "error" not in result:
                        gmail_replies_processed += 1
        except Exception as e:
            gmail_error = str(e)
            print(f"[agent_runner] Gmail ingestion warning for user '{user_id}': {e}")

    # 1. Execute ADK Reasoning Agent
    loops_before = store.list_loops(include_closed=False, user_id=user_id)
    adk_result = None
    adk_error: Optional[str] = None

    try:
        runner = _get_runner()
        try:
            adk_result = runner.run(
                new_message=(
                    f"Run complete cycle for user_id='{user_id or 'default'}'. "
                    f"Check new replies, work all open loops in priority order, "
                    f"and report resolution summary."
                )
            )
        except TypeError:
            adk_result = runner.run(
                user_id=user_id or "system",
                session_id=run_id,
                new_message=(
                    f"Run complete cycle for user_id='{user_id or 'default'}'. "
                    f"Check new replies, work all open loops in priority order, "
                    f"and report resolution summary."
                )
            )
    except Exception as e:
        adk_error = str(e)
        print(f"[agent_runner] ADK Agent Execution Notice: {e}")

    # 2. Record run summary
    completed_at = datetime.now(timezone.utc)
    duration_s   = round((completed_at - started_at).total_seconds(), 2)
    loops_after  = store.list_loops(include_closed=False, user_id=user_id)

    run_record = {
        "run_id":                  run_id,
        "trigger":                 trigger,
        "user_id":                 user_id,
        "started_at":              started_at.isoformat(),
        "completed_at":            completed_at.isoformat(),
        "duration_seconds":        duration_s,
        "status":                  "failed" if adk_error else "completed",
        "loops_scanned":           len(loops_before),
        "broken_promises_found":  len(broken_loops),
        "gmail_replies_processed": gmail_replies_processed,
        "gmail_error":             gmail_error,
        "adk_error":               adk_error,
        "outcome": {
            "open_before": len(loops_before),
            "open_after":  len(loops_after),
            "resolved_this_run": max(0, len(loops_before) - len(loops_after)),
        },
    }

    store.save_run_log(run_record, user_id=user_id)
    return run_record
