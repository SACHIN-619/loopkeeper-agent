"""
store_firestore.py — Firestore-backed Open Loop Registry + client relationship memory.

Drop-in replacement for store.py with multi-tenant user_id security rules and tenant isolation.

Every function here has the exact same name, signature, and docstrings as the JSON
version — that's the whole point. agent.py doesn't import this directly; it picks
whichever store module is active based on the LOOPKEEPER_BACKEND environment variable.
"""

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

try:
    from . import policy
except ImportError:
    import policy

LOOPS = "open_loops"
CLIENTS = "clients"
RUNS = "agent_runs"

# Lazy singleton: importing this module shouldn't itself require credentials to exist.
# Only actually invoking a database function will initialize the client.
_db: Optional[firestore.Client] = None


def _client() -> firestore.Client:
    """Return initialized Firestore client (lazy singleton)."""
    global _db
    if _db is None:
        _db = firestore.Client()
    return _db


# Risk weighting used by priority_score() — how much each situation type
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


# --- pure functions (no storage involved) ----------------------------------

def days_overdue(loop: dict) -> int:
    """Days past due_date, floored at 0 (0 if not yet due)."""
    due = date.fromisoformat(loop["due_date"])
    return max((date.today() - due).days, 0)


def priority_score(loop: dict) -> float:
    """Economic-prioritization score: amount x urgency x situation risk.

    Transparent formula designed for financial workflow auditing:
    Score = Amount * (1 + days_overdue / 30) * Risk_Weight
    Higher score = deserves attention sooner.
    """
    amount = loop.get("amount", 0) or 0
    urgency = 1 + (days_overdue(loop) / 30)
    risk = _RISK_WEIGHT.get(loop.get("exception_type", ""), 1.0)
    return round(amount * urgency * risk, 2)


def explain_priority(loop: dict) -> str:
    """Human-readable breakdown of priority_score() for UI auditing.

    Turns 'trust me' into three numbers anyone can verify by hand.
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


# --- Firestore Loop Operations ----------------------------------------------

def list_loops(include_closed: bool = False, sort_by_priority: bool = False, user_id: Optional[str] = None) -> list[dict]:
    """Return open loops from Firestore.

    Optional Filters:
    - include_closed: include closed loops if True.
    - sort_by_priority: sort results by priority_score() descending.
    - user_id: filter strictly by tenant/owner user_id.
    """
    col = _client().collection(LOOPS)
    if user_id:
        col = col.where(filter=FieldFilter("user_id", "==", user_id))
    if not include_closed:
        col = col.where(filter=FieldFilter("status", "!=", "closed"))
    loops = [doc.to_dict() for doc in col.stream()]
    for l in loops:
        l.setdefault("processed_message_ids", [])
        l.setdefault("unread_reply", False)
    if sort_by_priority:
        loops.sort(key=priority_score, reverse=True)
    return loops


def get_loop(loop_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Retrieve full detail for a single loop by ID, enforcing user_id tenant ownership."""
    doc = _client().collection(LOOPS).document(loop_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    if user_id and data.get("user_id") and data["user_id"] != user_id:
        return None
    data.setdefault("processed_message_ids", [])
    data.setdefault("unread_reply", False)
    return data


def update_status(loop_id: str, status: str, reason: str, exception_type: Optional[str] = None, user_id: Optional[str] = None) -> Optional[dict]:
    """Update loop status and exception_type, appending change event to history log."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"Status updated to '{status}': {reason}", "date": now_iso})

    update = {
        "status": status,
        "history": history,
        "last_contact_date": now_iso,
    }
    if exception_type:
        update["exception_type"] = exception_type

    ref.update(update)
    loop.update(update)
    return loop


def record_contact(loop_id: str, summary: str, channel: str = "email", user_id: Optional[str] = None) -> Optional[dict]:
    """Record an outgoing contact attempt (email/SMS/WhatsApp), incrementing contact_count."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"[{channel}] {summary}", "date": now_iso})

    ref.update({
        "contact_count": firestore.Increment(1),
        "last_contact_date": now_iso,
        "history": history,
    })

    loop["contact_count"] = loop.get("contact_count", 0) + 1
    loop["last_contact_date"] = now_iso
    loop["history"] = history
    return loop


def log_incoming_reply(loop_id: str, message_id: str, summary: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Log an incoming reply with deduplication via processed_message_ids."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    processed = loop.get("processed_message_ids", [])
    if message_id in processed:
        return {"already_processed": True, "loop": loop}

    processed.append(message_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"[incoming reply] {summary}", "date": now_iso})

    ref.update({
        "processed_message_ids": processed,
        "unread_reply": True,
        "history": history,
    })

    loop["processed_message_ids"] = processed
    loop["unread_reply"] = True
    loop["history"] = history
    return loop


def save_draft(loop_id: str, subject: str, body: str, tier: int = 2, user_id: Optional[str] = None) -> Optional[dict]:
    """Save a Tier 2 message draft awaiting owner approval."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    draft = {
        "subject": subject,
        "body": body,
        "tier": tier,
        "created_at": now_iso,
    }
    history = loop.get("history", [])
    history.append({"event": f"Draft created for Tier {tier} approval (awaiting your approval): '{subject}'", "date": now_iso})

    update = {
        "draft": draft,
        "pending_draft": draft,
        "has_pending_draft": True,
        "status": "awaiting_approval",
        "tier": tier,
        "history": history,
    }
    ref.update(update)
    loop.update(update)
    return loop


def send_draft(loop_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Execute dispatch of an owner-approved Tier 2 draft, clearing draft state."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    draft = loop.get("draft")
    if not draft:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"Approved & sent draft: '{draft['subject']}'", "date": now_iso})

    update = {
        "draft": firestore.DELETE_FIELD,
        "status": "open",
        "contact_count": firestore.Increment(1),
        "last_contact_date": now_iso,
        "history": history,
    }
    ref.update(update)
    loop["draft"] = None
    loop["status"] = "open"
    loop["history"] = history
    return loop


def escalate(loop_id: str, reason: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Escalate a loop to Tier 3 human intervention."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"Escalated to human (Tier 3): {reason}", "date": now_iso})

    update = {
        "tier": 3,
        "status": "escalated",
        "history": history,
    }
    ref.update(update)
    loop.update(update)
    return loop


def split_loop(loop_id: str, split_amount: float, reason: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Separate a partially disputed invoice into two independent loops.

    Leaves undisputed funds active for collection while isolating disputed amount.
    """
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    orig_amount = loop.get("amount", 0)
    if split_amount >= orig_amount or split_amount <= 0:
        return {"error": f"split_amount {split_amount} must be > 0 and < original amount {orig_amount}"}

    rem_amount = orig_amount - split_amount
    now_iso = datetime.now(timezone.utc).isoformat()

    history = loop.get("history", [])
    history.append({
        "event": f"Split loop: ${split_amount:,.2f} split off ({reason}), ${rem_amount:,.2f} remaining",
        "date": now_iso,
    })

    ref.update({
        "amount": rem_amount,
        "history": history,
    })
    loop["amount"] = rem_amount
    loop["history"] = history

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

    _client().collection(LOOPS).document(new_id).set(new_loop)

    return {
        "original_loop": loop,
        "new_loop": new_loop,
        "message": f"Split loop into {loop_id} (${rem_amount:,.2f}) and {new_id} (${split_amount:,.2f})"
    }


def verify_and_close(loop_id: str, verify_note: str, user_id: Optional[str] = None, by_agent: bool = False) -> Optional[dict]:
    """Verify payment evidence and close loop."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
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
    history = loop.get("history", [])
    history.append({"event": f"Verified and closed: {verify_note}", "date": now_iso})

    update = {
        "status": "closed",
        "exception_type": "resolved",
        "unread_reply": False,
        "verify_note": verify_note,
        "history": history,
    }
    ref.update(update)
    loop.update(update)

    _client().collection("resolved_loops").document(loop_id).set(loop)
    return loop


def store_promise(loop_id: str, promised_date: str, text: str = "", user_id: Optional[str] = None) -> Optional[dict]:
    """Deterministically record client payment promise (exception_type = 'promise_pending')."""
    ref = _client().collection(LOOPS).document(loop_id)
    snap = ref.get()
    if not snap.exists:
        return None
    loop = snap.to_dict() or {}
    if user_id and loop.get("user_id") and loop["user_id"] != user_id:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    history = loop.get("history", [])
    history.append({"event": f"Client promised payment by {promised_date}. '{text}'", "date": now_iso})

    update = {
        "promise_date": promised_date,
        "exception_type": "promise_pending",
        "unread_reply": False,
        "history": history,
    }
    ref.update(update)
    loop.update(update)
    return loop


def check_broken_promises(user_id: Optional[str] = None) -> list[dict]:
    """Pure date-math promise check. Transitions expired promises to promise_broken."""
    col = _client().collection(LOOPS).where(filter=FieldFilter("exception_type", "==", "promise_pending"))
    if user_id:
        col = col.where(filter=FieldFilter("user_id", "==", user_id))

    today_str = date.today().isoformat()
    broken = []

    for doc in col.stream():
        loop = doc.to_dict()
        promise_date = loop.get("promise_date")
        if promise_date and promise_date < today_str:
            now_iso = datetime.now(timezone.utc).isoformat()
            history = loop.get("history", [])
            history.append({
                "event": f"Payment promise expired ({promise_date}). Re-escalated.",
                "date": now_iso,
            })
            update = {
                "exception_type": "promise_broken",
                "tier": 2,
                "history": history,
            }
            doc.reference.update(update)
            loop.update(update)
            broken.append(loop)

    return broken


def list_pending_approvals(user_id: Optional[str] = None) -> list[dict]:
    """List all loops with drafts awaiting human approval."""
    loops = list_loops(include_closed=False, user_id=user_id)
    return [l for l in loops if l.get("draft") is not None]


def get_resolution_report(user_id: Optional[str] = None) -> dict:
    """End-of-run resolution summary and financial recovery metrics."""
    all_loops = list_loops(include_closed=True, user_id=user_id)
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


# --- Client Relationship Memory ---------------------------------------------

def get_client(client_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Relationship profile for a client."""
    doc = _client().collection(CLIENTS).document(client_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    if user_id and data.get("user_id") and data["user_id"] != user_id:
        return None
    return data


def list_clients(user_id: Optional[str] = None) -> list[dict]:
    """List all clients for the target user."""
    col = _client().collection(CLIENTS)
    if user_id:
        col = col.where(filter=FieldFilter("user_id", "==", user_id))
    return [doc.to_dict() for doc in col.stream()]


def record_promise_outcome(client_id: str, outcome: str, user_id: Optional[str] = None) -> Optional[dict]:
    """Record promise reliability outcome ('kept' or 'broken') in client memory."""
    ref = _client().collection(CLIENTS).document(client_id)
    snap = ref.get()
    if not snap.exists:
        return None
    client = snap.to_dict() or {}
    if user_id and client.get("user_id") and client["user_id"] != user_id:
        return None

    if outcome == "kept":
        ref.update({
            "promises_kept": firestore.Increment(1),
            "promises_made": firestore.Increment(1),
        })
        client["promises_kept"] = client.get("promises_kept", 0) + 1
        client["promises_made"] = client.get("promises_made", 0) + 1
    elif outcome == "broken":
        ref.update({"promises_made": firestore.Increment(1)})
        client["promises_made"] = client.get("promises_made", 0) + 1

    return client


# --- Agent Run Log -----------------------------------------------------------

def save_run_log(run: dict, user_id: Optional[str] = None) -> dict:
    """Persist structured record of an agent run cycle."""
    if user_id:
        run["user_id"] = user_id
    run_id = run.get("run_id") or str(uuid.uuid4())[:8]
    _client().collection(RUNS).document(run_id).set(run)
    return run


def get_run_log(limit: int = 20, user_id: Optional[str] = None) -> list[dict]:
    """Get recent agent execution history log."""
    col = _client().collection(RUNS)
    if user_id:
        col = col.where(filter=FieldFilter("user_id", "==", user_id))
    col = col.order_by("started_at", direction=firestore.Query.DESCENDING).limit(limit)
    return [doc.to_dict() for doc in col.stream()]


def get_last_run(user_id: Optional[str] = None) -> Optional[dict]:
    """Get most recent agent execution record."""
    runs = get_run_log(limit=1, user_id=user_id)
    return runs[0] if runs else None