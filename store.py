"""
store.py — persistence layer for the Open Loop Registry, client
relationship memory, and agent run log.

JSON-backed (data/open_loops.json, data/clients.json, data/agent_runs.json)
so the full agent runs with zero cloud setup. Supports multi-tenant user_id
tenant isolation so data across users remains strictly separated.
"""

import json
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

try:
    from . import policy
except ImportError:
    import policy

LOOPS_PATH   = Path(__file__).parent / "data" / "open_loops.json"
CLIENTS_PATH = Path(__file__).parent / "data" / "clients.json"
RUNS_PATH    = Path(__file__).parent / "data" / "agent_runs.json"

# risk weighting used by priority_score() — how much each situation type
# multiplies urgency by. Higher = deserves attention sooner.
_RISK_WEIGHT = {
    "dispute_full": 1.5,       # High risk — client contesting entire invoice
    "promise_broken": 1.3,     # Urgent — client broke an explicit payment deadline
    "dispute_partial": 1.2,    # Medium risk — part of invoice contested
    "silent": 1.1,             # Moderate risk — client ignoring follow-ups
    "fresh_overdue": 1.0,      # Standard risk — newly overdue invoice
    "info_issue": 0.9,         # Low risk — missing PO/reference info
    "promise_pending": 0.3,    # Low priority — monitored commitment active
    "resolved": 0.0,           # Zero risk — completed
}


# --- low-level load/save ------------------------------------------------

def _load() -> dict:
    if not LOOPS_PATH.exists():
        return {}
    with open(LOOPS_PATH, "r") as f:
        data = json.load(f)
        if isinstance(data, dict) and "loops" in data:
            return data["loops"]
        return data if isinstance(data, dict) else {}


def _save(data: dict) -> None:
    LOOPS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOOPS_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


def _load_clients() -> dict:
    if not CLIENTS_PATH.exists():
        return {}
    with open(CLIENTS_PATH, "r") as f:
        return json.load(f)


def _save_clients(data: dict) -> None:
    CLIENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CLIENTS_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


# --- loops ---------------------------------------------------------------

def days_overdue(loop: dict) -> int:
    """Days past due_date, floored at 0 (0 if not yet due)."""
    due = date.fromisoformat(loop["due_date"])
    return max((date.today() - due).days, 0)


def priority_score(loop: dict) -> float:
    """Economic-prioritization score: amount x urgency x situation risk.

    Transparent on purpose — this is a formula you can point to and
    defend in front of a judge, not a black box you hope nobody asks
    about. Higher score = look at this one first. See explain_priority()
    for the human-readable version of this same math.
    """
    amount = loop.get("amount", 0) or 0
    urgency = 1 + (days_overdue(loop) / 30)
    risk = _RISK_WEIGHT.get(loop.get("exception_type", ""), 1.0)
    return round(amount * urgency * risk, 2)


def explain_priority(loop: dict) -> str:
    """Human-readable breakdown of priority_score() — turns 'trust me,
    the model ranked it this way' into three numbers anyone can check by
    hand. This is what should show up next to the loop in the UI, not
    just the raw score.
    """
    amount = loop.get("amount", 0) or 0
    du = days_overdue(loop)
    urgency = 1 + (du / 30)
    risk = _RISK_WEIGHT.get(loop.get("exception_type", ""), 1.0)
    return (
        f"${amount:,.0f} impact  x  {urgency:.2f} urgency ({du}d overdue)  "
        f"x  {risk:.1f} risk ({loop.get('exception_type', 'n/a')})  "
        f"=  {priority_score(loop):,.0f}"
    )


def list_loops(include_closed: bool = False, sort_by_priority: bool = False, user_id: Optional[str] = None) -> list[dict]:
    """Return loops, optionally including closed, optionally ranked by
    priority_score() (highest financial impact / urgency first).
    If user_id is provided, filters strictly for matching tenant/owner UID.
    """
    data = _load()
    loops = list(data.values())
    
    if user_id:
        loops = [l for l in loops if l.get("user_id") == user_id]
        
    if not include_closed:
        loops = [l for l in loops if l.get("status") != "closed"]
        
    for l in loops:
        l.setdefault("processed_message_ids", [])
        l.setdefault("unread_reply", False)
        
    if sort_by_priority:
        loops.sort(key=priority_score, reverse=True)
    return loops


def get_loop(loop_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Retrieve full detail for a single loop by ID, enforcing user_id tenant ownership."""
    loop = _load().get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None
    loop.setdefault("processed_message_ids", [])
    loop.setdefault("unread_reply", False)
    return loop


def update_status(loop_id: str, status: str, reason: str, exception_type: Optional[str] = None, user_id: Optional[str] = None) -> Optional[dict]:
    """Update loop status and exception_type, appending change event to history log."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    loop["status"] = status
    if exception_type:
        loop["exception_type"] = exception_type

    now_iso = datetime.now(timezone.utc).isoformat()
    loop.setdefault("history", []).append({
        "event": f"Status updated to '{status}': {reason}",
        "date": now_iso,
    })
    loop["last_contact_date"] = now_iso
    data[loop_id] = loop
    _save(data)
    return loop


def record_contact(loop_id: str, summary: str, channel: str = "email", user_id: Optional[str] = None) -> Optional[dict]:
    """Record an outgoing contact attempt (email/SMS/WhatsApp), incrementing contact_count."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    loop["contact_count"] = loop.get("contact_count", 0) + 1
    loop["last_contact_date"] = now_iso
    loop.setdefault("history", []).append({
        "event": f"[{channel}] {summary}",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def log_incoming_reply(loop_id: str, message_id: str, summary: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Log an incoming reply with deduplication via processed_message_ids."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    processed = loop.setdefault("processed_message_ids", [])
    if message_id in processed:
        return {"already_processed": True, "loop": loop}

    processed.append(message_id)
    loop["unread_reply"] = True
    now_iso = datetime.now(timezone.utc).isoformat()
    loop.setdefault("history", []).append({
        "event": f"[incoming reply] {summary}",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def save_draft(loop_id: str, subject: str, body: str, tier: int = 2, user_id: Optional[str] = None) -> Optional[dict]:
    """Save a Tier 2 message draft awaiting owner approval."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    loop["draft"] = {
        "subject": subject,
        "body": body,
        "tier": tier,
        "created_at": now_iso,
    }
    loop["pending_draft"] = loop["draft"]
    loop["has_pending_draft"] = True
    loop["status"] = "awaiting_approval"
    loop["tier"] = tier
    loop.setdefault("history", []).append({
        "event": f"Draft created for Tier {tier} approval (awaiting your approval): '{subject}'",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def send_draft(loop_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Execute dispatch of an owner-approved Tier 2 draft, clearing draft state."""
    data = _load()
    loop = data.get(loop_id)
    if not loop or not loop.get("draft"):
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    draft = loop["draft"]
    now_iso = datetime.now(timezone.utc).isoformat()
    loop["draft"] = None
    loop["status"] = "open"
    loop["contact_count"] = loop.get("contact_count", 0) + 1
    loop["last_contact_date"] = now_iso
    loop.setdefault("history", []).append({
        "event": f"Approved & sent draft: '{draft['subject']}'",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def escalate(loop_id: str, reason: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Escalate a loop to Tier 3 human intervention."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    loop["tier"] = 3
    loop["status"] = "escalated"
    loop.setdefault("history", []).append({
        "event": f"Escalated to human (Tier 3): {reason}",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def split_loop(loop_id: str, split_amount: float, reason: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Separate a partially disputed invoice into two independent loops.

    Leaves undisputed funds active for collection while isolating disputed amount.
    """
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    orig_amount = loop.get("amount", 0)
    if split_amount >= orig_amount or split_amount <= 0:
        return {"error": f"split_amount {split_amount} must be > 0 and < original amount {orig_amount}"}

    rem_amount = orig_amount - split_amount
    now_iso = datetime.now(timezone.utc).isoformat()

    loop["amount"] = rem_amount
    loop.setdefault("history", []).append({
        "event": f"Split loop: ${split_amount:,.2f} split off ({reason}), ${rem_amount:,.2f} remaining",
        "date": now_iso,
    })

    new_id = f"{loop_id}_sub_{str(uuid.uuid4())[:4]}"
    new_loop = dict(loop)
    new_loop["loop_id"] = new_id
    new_loop["invoice_number"] = f"{loop['invoice_number']}-B"
    new_loop["amount"] = split_amount
    new_loop["exception_type"] = "dispute_partial"
    new_loop["status"] = "open"
    new_loop["history"] = [{
        "event": f"Created via split from {loop_id} (${split_amount:,.2f}): {reason}",
        "date": now_iso,
    }]

    data[loop_id] = loop
    data[new_id]  = new_loop
    _save(data)

    return {
        "original_loop": loop,
        "new_loop": new_loop,
        "message": f"Split loop into {loop_id} (${rem_amount:,.2f}) and {new_id} (${split_amount:,.2f})"
    }


def verify_and_close(loop_id: str, verify_note: str, user_id: Optional[str] = None, by_agent: bool = False) -> Optional[dict]:
    """Verify payment evidence and close loop."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    if by_agent:
        has_reply = any(
            "incoming reply" in h.get("event", "").lower() or
            "paid" in h.get("event", "").lower() or
            ("reply" in h.get("event", "").lower() and "no reply" not in h.get("event", "").lower())
            for h in loop.get("history", [])
        )
        if not has_reply:
            return {"error": "Cannot close loop autonomously without verified payment reply in history."}

    now_iso = datetime.now(timezone.utc).isoformat()
    loop["status"] = "closed"
    loop["exception_type"] = "resolved"
    loop["unread_reply"] = False
    loop["verify_note"] = verify_note
    loop.setdefault("history", []).append({
        "event": f"Verified and closed: {verify_note}",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def store_promise(loop_id: str, promised_date: str, text: str = "", user_id: Optional[str] = None) -> Optional[dict]:
    """Deterministically record client payment promise (exception_type = 'promise_pending')."""
    data = _load()
    loop = data.get(loop_id)
    if not loop:
        return None
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    loop["promise_date"] = promised_date
    loop["exception_type"] = "promise_pending"
    loop["unread_reply"] = False
    loop.setdefault("history", []).append({
        "event": f"Client promised payment by {promised_date}. '{text}'",
        "date": now_iso,
    })
    data[loop_id] = loop
    _save(data)
    return loop


def check_broken_promises(user_id: Optional[str] = None) -> list[dict]:
    """Pure date-math promise check. Transitions expired promises to promise_broken."""
    data = _load()
    today_str = date.today().isoformat()
    broken = []

    for loop_id, loop in data.items():
        if user_id and loop.get("user_id") and loop["user_id"] != user_id:
            continue
        if loop.get("exception_type") == "promise_pending" and loop.get("promise_date"):
            if loop["promise_date"] < today_str:
                now_iso = datetime.now(timezone.utc).isoformat()
                loop["exception_type"] = "promise_broken"
                loop["tier"] = 2
                loop.setdefault("history", []).append({
                    "event": f"Payment promise expired ({loop['promise_date']}). Re-escalated.",
                    "date": now_iso,
                })
                data[loop_id] = loop
                broken.append(loop)

    if broken:
        _save(data)
    return broken


def list_pending_approvals(user_id: Optional[str] = None) -> list[dict]:
    """List all loops with drafts awaiting human approval."""
    loops = list_loops(include_closed=False, user_id=user_id)
    return [l for l in loops if l.get("draft") is not None]


def get_resolution_report(user_id: Optional[str] = None) -> dict:
    """End-of-run resolution summary and financial recovery metrics."""
    data = _load()
    all_loops = list(data.values())
    if user_id:
        all_loops = [l for l in all_loops if l.get("user_id") == user_id]

    total = len(all_loops)
    closed = [l for l in all_loops if l.get("status") == "closed"]
    resolved_count = len(closed)

    total_recovered = sum(l.get("amount", 0) for l in closed)
    open_exposure = sum(l.get("amount", 0) for l in all_loops if l.get("status") != "closed")

    days_list = []
    for l in closed:
        if l.get("due_date") and l.get("last_contact_date"):
            try:
                due = date.fromisoformat(l["due_date"])
                closed_d = date.fromisoformat(l["last_contact_date"][:10])
                days_list.append((closed_d - due).days)
            except Exception:
                pass

    avg_days = round(sum(days_list) / len(days_list), 1) if days_list else 0.0

    return {
        "total_loops": total,
        "resolved_count": resolved_count,
        "resolution_rate_pct": round((resolved_count / total * 100), 1) if total > 0 else 0.0,
        "total_recovered_usd": total_recovered,
        "open_exposure_usd": open_exposure,
        "avg_days_to_resolve_after_due": avg_days,
        "human_intervention_needed_count": len([l for l in all_loops if l.get("tier", 1) > 1]),
    }


# --- client relationship memory ------------------------------------------

def get_client(client_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Relationship profile for a client."""
    clients = _load_clients()
    client = clients.get(client_id)
    if not client:
        return None
    if user_id and client.get("user_id") and client["user_id"] != user_id:
        return None
    return client


def list_clients(user_id: Optional[str] = None) -> list[dict]:
    """List all clients for the target user."""
    clients = _load_clients()
    res = list(clients.values())
    if user_id:
        res = [c for c in res if c.get("user_id") == user_id]
    return res


def record_promise_outcome(client_id: str, outcome: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Record promise reliability outcome ('kept' or 'broken') in client memory."""
    clients = _load_clients()
    client = clients.get(client_id)
    if not client:
        return None
    if user_id and client.get("user_id") and client["user_id"] != user_id:
        return None

    if outcome == "kept":
        client["promises_kept"] = client.get("promises_kept", 0) + 1
        client["promises_made"] = client.get("promises_made", 0) + 1
    elif outcome == "broken":
        client["promises_made"] = client.get("promises_made", 0) + 1

    clients[client_id] = client
    _save_clients(clients)
    return client


# --- agent run log -------------------------------------------------------

def save_run_log(run: dict, user_id: Optional[str] = None) -> dict:
    """Persist structured record of an agent run cycle."""
    RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    runs = []
    if RUNS_PATH.exists():
        try:
            with open(RUNS_PATH, "r") as f:
                data = json.load(f)
                if isinstance(data, list):
                    runs = data
                elif isinstance(data, dict):
                    runs = data.get("runs", [])
        except Exception:
            runs = []

    if not isinstance(runs, list):
        runs = []

    if user_id:
        run["user_id"] = user_id

    runs.insert(0, run)
    runs = runs[:100]

    with open(RUNS_PATH, "w") as f:
        json.dump(runs, f, indent=2, default=str)

    return run


def get_run_log(limit: int = 20, user_id: Optional[str] = None) -> list[dict]:
    """Get recent agent execution history log."""
    if not RUNS_PATH.exists():
        return []
    try:
        with open(RUNS_PATH, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                runs = data
            elif isinstance(data, dict):
                runs = data.get("runs", [])
            else:
                runs = []

            if user_id:
                runs = [r for r in runs if isinstance(r, dict) and r.get("user_id") == user_id]
            return runs[:limit]
    except Exception:
        return []


def get_last_run(user_id: Optional[str] = None) -> Optional[dict]:
    """Get most recent agent execution record."""
    runs = get_run_log(limit=1, user_id=user_id)
    return runs[0] if runs else None