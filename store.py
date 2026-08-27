"""
store.py — persistence layer for the Open Loop Registry, client
relationship memory, and agent run log.

JSON-backed (data/open_loops.json, data/clients.json, data/agent_runs.json)
so the full agent runs with zero cloud setup. Firestore upgrade path is at
the bottom — only this file changes, nothing else.
"""

import json
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

from . import policy

LOOPS_PATH   = Path(__file__).parent / "data" / "open_loops.json"
CLIENTS_PATH = Path(__file__).parent / "data" / "clients.json"
RUNS_PATH    = Path(__file__).parent / "data" / "agent_runs.json"

# risk weighting used by priority_score() — how much each situation type
# multiplies urgency by. Higher = deserves attention sooner.
_RISK_WEIGHT = {
    "dispute_full": 1.5,
    "promise_broken": 1.3,
    "dispute_partial": 1.2,
    "silent": 1.1,
    "fresh_overdue": 1.0,
    "info_issue": 0.9,
    "promise_pending": 0.3,   # already has a monitored commitment — low priority
    "resolved": 0.0,
}


# --- low-level load/save ------------------------------------------------

def _load() -> dict:
    with open(LOOPS_PATH, "r") as f:
        return json.load(f)


def _save(data: dict) -> None:
    with open(LOOPS_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


def _load_clients() -> dict:
    with open(CLIENTS_PATH, "r") as f:
        return json.load(f)


def _save_clients(data: dict) -> None:
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
    If user_id is provided, filters for matching tenant/owner UID."""
    data = _load()
    loops = list(data.get("loops", {}).values())
    if user_id:
        loops = [l for l in loops if l.get("user_id") == user_id or l.get("userId") == user_id]
    for l in loops:
        l.setdefault("processed_message_ids", [])
        l.setdefault("unread_reply", False)
    if not include_closed:
        loops = [l for l in loops if l.get("status") != "closed"]
    if sort_by_priority:
        loops.sort(key=priority_score, reverse=True)
    return loops


def get_loop(loop_id: str) -> Optional[dict]:
    data = _load()
    loop = data["loops"].get(loop_id)
    if loop:
        loop.setdefault("processed_message_ids", [])
        loop.setdefault("unread_reply", False)
    return loop


def update_status(loop_id: str, new_status: str, note: str, exception_type: str = None) -> dict:
    """Update status/exception_type after new information changes the
    picture — NOT for closing a loop. Sending a message is an action,
    not a resolution; a loop only closes once payment is actually
    verified, which is what verify_and_close() is for. Enforced here,
    not left to the model to remember: "closed" is rejected outright.
    """
    if new_status == "closed":
        return {
            "error": (
                "update_status() cannot close a loop — that would let sending "
                "a message count as resolving it. Call verify_and_close() once "
                "payment is actually confirmed."
            )
        }
    data = _load()
    loop = data["loops"][loop_id]
    loop["status"] = new_status
    if exception_type:
        loop["exception_type"] = exception_type
    loop["history"].append(
        {"date": str(date.today()), "event": f"status -> {new_status}: {note}"}
    )
    _save(data)
    return loop


def verify_and_close(loop_id: str, verification_note: str, by_agent: bool = False) -> dict:
    """The ONLY path to closing a loop. Action is not resolution — a
    sent email doesn't close anything; a verified payment does.
    """
    data = _load()
    loop = data["loops"].get(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}

    if by_agent:
        # Check loop history for payment evidence
        has_reply = any(
            "[INCOMING REPLY]" in h["event"] or "[email] client replied" in h["event"]
            for h in loop.get("history", [])
        )
        payment_keywords = ["paid", "pay", "sent", "wire", "transfer", "check", "receipt", "confirm"]
        has_keywords = any(
            any(kw in h["event"].lower() for kw in payment_keywords)
            for h in loop.get("history", [])
            if "[INCOMING REPLY]" in h["event"] or "[email] client replied" in h["event"]
        )
        if not (has_reply and has_keywords):
            return {
                "error": "No payment confirmation evidence found in client replies. Cannot close autonomously."
            }

    loop["status"] = "closed"
    loop["exception_type"] = "resolved"
    loop["unread_reply"] = False
    loop["history"].append(
        {"date": str(date.today()), "event": f"VERIFIED & CLOSED: {verification_note}"}
    )
    _save(data)
    return loop


def record_contact(loop_id: str, channel: str, summary: str) -> dict:
    data = _load()
    loop = data["loops"][loop_id]
    loop["contact_count"] = loop.get("contact_count", 0) + 1
    loop["last_contact_date"] = str(date.today())
    loop["history"].append(
        {"date": str(date.today()), "event": f"[{channel}] {summary}"}
    )
    _save(data)
    return loop


def log_incoming_reply(loop_id: str, message_id: str, summary: str) -> dict:
    """Record an incoming client message in local JSON history.
    
    Kept separate from record_contact(), which tracks OUTGOING follow-ups.
    Does not increment contact_count so it doesn't skew silent-tier logic.
    """
    data = _load()
    loop = data["loops"].get(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}
    
    processed = loop.setdefault("processed_message_ids", [])
    if message_id in processed:
        return loop
    
    processed.append(message_id)
    loop["unread_reply"] = True
    loop["history"].append(
        {"date": str(date.today()), "event": f"[INCOMING REPLY] {summary}"}
    )
    _save(data)
    return loop

def save_draft(loop_id: str, subject: str, body: str) -> dict:
    """Tier 2: store a drafted-but-not-sent follow-up for human approval."""
    data = _load()
    loop = data["loops"][loop_id]
    loop["pending_draft"] = {"subject": subject, "body": body, "drafted_date": str(date.today())}
    loop["history"].append(
        {"date": str(date.today()), "event": f"drafted, awaiting your approval: {subject}"}
    )
    _save(data)
    return loop


def list_pending_approvals() -> list[dict]:
    """Every loop currently holding a Tier-2 draft waiting on the owner."""
    data = _load()
    return [l for l in data["loops"].values() if l.get("pending_draft")]


def send_draft(loop_id: str) -> dict:
    """Human approved a Tier-2 draft — send it and record the contact."""
    data = _load()
    loop = data["loops"][loop_id]
    draft = loop.get("pending_draft")
    if not draft:
        return {"error": f"no pending draft for {loop_id}"}
    loop["pending_draft"] = None
    loop["contact_count"] = loop.get("contact_count", 0) + 1
    loop["last_contact_date"] = str(date.today())
    loop["history"].append(
        {"date": str(date.today()), "event": f"approved & sent: {draft['subject']}"}
    )
    _save(data)
    return {"loop": loop, "subject": draft["subject"], "body": draft["body"]}


def escalate(loop_id: str, reason: str) -> dict:
    data = _load()
    loop = data["loops"][loop_id]
    loop["status"] = "escalated"
    loop["escalation_level"] = loop.get("escalation_level", 0) + 1
    loop["history"].append(
        {"date": str(date.today()), "event": f"ESCALATED TO HUMAN: {reason}"}
    )
    _save(data)
    return loop


def split_loop(loop_id: str, disputed_amount: float, reason: str) -> dict:
    """Partial-dispute split: carve the disputed amount into its own
    loop so the undisputed remainder can keep moving through normal
    collection instead of the whole invoice freezing.

    Returns {"undisputed_loop": ..., "disputed_loop": ...}.
    """
    data = _load()
    parent = data["loops"][loop_id]

    if disputed_amount <= 0 or disputed_amount > parent["amount"]:
        return {"error": f"disputed_amount must be between 0 and {parent['amount']}"}

    undisputed_amount = round(parent["amount"] - disputed_amount, 2)
    child_id = f"{loop_id}_disputed"

    child = {
        **parent,
        "loop_id": child_id,
        "parent_loop_id": loop_id,
        "amount": disputed_amount,
        "disputed_amount": disputed_amount,
        "undisputed_amount": 0.0,
        "status": "disputed",
        "exception_type": "dispute_partial",
        "history": [
            {"date": str(date.today()),
             "event": f"split from {loop_id}: ${disputed_amount:,.2f} disputed — {reason}"}
        ],
    }

    parent["amount"] = undisputed_amount
    parent["disputed_amount"] = 0.0
    parent["undisputed_amount"] = undisputed_amount
    parent["exception_type"] = "silent" if parent.get("contact_count", 0) > 0 else "fresh_overdue"
    parent["history"].append(
        {"date": str(date.today()),
         "event": f"split: ${disputed_amount:,.2f} moved to {child_id} as disputed; "
                  f"${undisputed_amount:,.2f} continues as undisputed"}
    )

    data["loops"][child_id] = child
    data["loops"][loop_id] = parent
    _save(data)
    return {"undisputed_loop": parent, "disputed_loop": child}


# Rough, clearly-labeled estimate — not a measurement — of how long a
# human would spend per open loop doing what LoopKeeper just did:
# opening the invoice, reading the history, deciding on a response,
# writing it, and logging it somewhere. Tune this to your own agency's
# real pace; the point is to be honest that it's an assumption, not to
# pretend it's precise.
ESTIMATED_MINUTES_PER_MANUAL_TOUCH = 8


def get_resolution_report() -> dict:
    """The killer screen: aggregated view of the whole registry, broken
    down by what's actually blocking each dollar. Pure aggregation over
    state that already exists — no new infrastructure.
    """
    data = _load()
    loops = list(data["loops"].values())

    open_loops = [l for l in loops if l["status"] != "closed"]
    closed_loops = [l for l in loops if l["status"] == "closed"]

    by_type: dict = {}
    for l in open_loops:
        et = l.get("exception_type", "unknown")
        bucket = by_type.setdefault(et, {"count": 0, "amount": 0.0})
        bucket["count"] += 1
        bucket["amount"] += l["amount"]

    by_tier: dict = {1: {"count": 0, "amount": 0.0}, 2: {"count": 0, "amount": 0.0}, 3: {"count": 0, "amount": 0.0}}
    for l in open_loops:
        tier = policy.required_tier(l)
        by_tier[tier]["count"] += 1
        by_tier[tier]["amount"] += l["amount"]

    return {
        "total_open_loops": len(open_loops),
        "total_outstanding": round(sum(l["amount"] for l in open_loops), 2),
        "total_resolved": round(sum(l["amount"] for l in closed_loops), 2),
        "by_exception_type": {
            k: {"count": v["count"], "amount": round(v["amount"], 2)} for k, v in by_type.items()
        },
        "by_tier": {
            policy.TIER_NAMES[k]: {"count": v["count"], "amount": round(v["amount"], 2)}
            for k, v in by_tier.items()
        },
        # explicit estimate, not a measurement — see the constant above
        "estimated_manual_minutes_if_done_by_hand": len(open_loops) * ESTIMATED_MINUTES_PER_MANUAL_TOUCH,
    }


# --- promise state machine -----------------------------------------------

def store_promise(loop_id: str, promised_date: str, source_text: str) -> dict:
    """Record a client payment promise. Sets exception_type to
    'promise_pending' and stores the promise_date for later evaluation.
    Idempotent: calling again with the same date is safe.
    """
    data = _load()
    loop = data["loops"].get(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}
    loop["promise_date"]   = promised_date
    loop["promise_broken"] = False
    loop["status"]         = "promised"
    loop["exception_type"] = "promise_pending"
    loop["history"].append({
        "date":  str(date.today()),
        "event": f"[PROMISE RECORDED] Client committed to pay by {promised_date}. Source: {source_text}"
    })
    _save(data)
    return loop


def check_broken_promises() -> list[dict]:
    """Scan all loops with promise_pending. If today > promise_date and no
    payment evidence exists, mark as promise_broken and update
    exception_type. Returns list of loops that transitioned to broken.
    Called by run_agent_cycle() every run.
    """
    today = date.today()
    data  = _load()
    broken = []
    for loop in data["loops"].values():
        if loop.get("exception_type") != "promise_pending":
            continue
        promise_raw = loop.get("promise_date")
        if not promise_raw:
            continue
        try:
            promise_date_obj = date.fromisoformat(promise_raw)
        except ValueError:
            continue
        if today <= promise_date_obj:
            continue  # promise still valid
        # Check for payment evidence in history
        payment_kw = ["paid", "pay", "sent", "wire", "transfer", "check", "receipt", "confirm"]
        has_payment = any(
            any(kw in h["event"].lower() for kw in payment_kw)
            for h in loop.get("history", [])
            if "[INCOMING REPLY]" in h["event"] or "[email] client replied" in h["event"]
        )
        if has_payment:
            continue  # promise was kept
        # Promise is broken
        loop["promise_broken"] = True
        loop["exception_type"] = "promise_broken"
        loop["status"]         = "overdue"
        loop["history"].append({
            "date":  str(today),
            "event": f"[PROMISE BROKEN] Deadline {promise_raw} passed with no payment evidence detected. Auto-escalating."
        })
        broken.append(loop)
    if broken:
        _save(data)
    return broken


# --- agent run log -------------------------------------------------------

def _load_runs() -> dict:
    if not RUNS_PATH.exists():
        return {"runs": []}
    with open(RUNS_PATH, "r") as f:
        return json.load(f)


def _save_runs(data: dict) -> None:
    with open(RUNS_PATH, "w") as f:
        json.dump(data, f, indent=2, default=str)


def save_run_log(run: dict) -> dict:
    """Append a completed agent run record to data/agent_runs.json.
    Each run has a unique run_id, trigger, timestamps, aggregate counts,
    and per-loop decisions. Returns the saved run.
    """
    data = _load_runs()
    if "run_id" not in run:
        run["run_id"] = str(uuid.uuid4())[:8]
    data["runs"].insert(0, run)  # newest first
    data["runs"] = data["runs"][:100]  # keep last 100 runs
    _save_runs(data)
    return run


def get_run_log(limit: int = 20) -> list[dict]:
    """Return the last N agent runs, newest first."""
    data = _load_runs()
    return data["runs"][:limit]


def get_last_run() -> Optional[dict]:
    """Return the most recent agent run, or None."""
    runs = get_run_log(limit=1)
    return runs[0] if runs else None


# --- clients (relationship memory) ---------------------------------------

def get_client(client_id: str) -> Optional[dict]:
    data = _load_clients()
    return data["clients"].get(client_id)


def list_clients() -> list[dict]:
    data = _load_clients()
    return list(data["clients"].values())


def record_promise_outcome(client_id: str, kept: bool) -> dict:
    """Update client relationship memory after a promise resolves."""
    data = _load_clients()
    client = data["clients"][client_id]
    client["promises_made"] = client.get("promises_made", 0) + 1
    if kept:
        client["promises_kept"] = client.get("promises_kept", 0) + 1
    _save_clients(data)
    return client


# ---------------------------------------------------------------------------
# FIRESTORE UPGRADE SKETCH (Day 2-3 — do not need this to run today)
# ---------------------------------------------------------------------------
# from google.cloud import firestore
# db = firestore.Client()
# LOOPS, CLIENTS = "open_loops", "clients"
#
# def list_loops(include_closed=False, sort_by_priority=False):
#     query = db.collection(LOOPS)
#     if not include_closed:
#         query = query.where("status", "!=", "closed")
#     loops = [doc.to_dict() for doc in query.stream()]
#     if sort_by_priority:
#         loops.sort(key=priority_score, reverse=True)
#     return loops
#
# ...same read-then-.update({...}) pattern for the rest. priority_score(),
# split_loop()'s math, and get_resolution_report()'s aggregation logic
# don't change at all — only how records are fetched/written does.