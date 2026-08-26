"""
agent.py — LoopKeeper's root agent.

Owns every unpaid invoice for a small agency until it's resolved:
detects, investigates the cause, decides the next move, acts within its
authority, and only pulls the human in for the calls that need one.

Run it locally with: adk web   (from the folder above loop_keeper/)
"""

import os
from google.adk import Agent
from . import policy

# Dynamically route backend storage based on environment configuration
if os.getenv("LOOPKEEPER_BACKEND") == "firestore":
    from . import store_firestore as store
else:
    from . import store

# ---------------------------------------------------------------------------
# TOOLS
# Docstrings matter as much as the code — ADK hands these to the model
# as-is, so they're written for the agent, not just for you.
# ---------------------------------------------------------------------------


def check_for_new_replies() -> dict:
    """Poll Gmail, match to open loops by sender email. Call FIRST,
    before list_open_loops() — a no-op unless Gmail is connected."""
    if os.getenv("LOOPKEEPER_EMAIL_MODE") != "gmail":
        return {"checked": False, "reason": "LOOPKEEPER_EMAIL_MODE is not 'gmail'"}
    from . import gmail_client
    replies = gmail_client.list_new_replies()
    open_loops = store.list_loops(include_closed=False)
    matched = []
    for reply in replies:
        sender_email = reply["from"].split("<")[-1].strip(">").strip().lower()
        for loop in open_loops:
            if loop["client_email"].lower() == sender_email:
                store.log_incoming_reply(loop["loop_id"], reply["message_id"], f"{reply['subject']}: {reply['snippet']}")
                matched.append({"loop_id": loop["loop_id"], "from": sender_email})
    return {"checked": True, "messages_seen": len(replies), "matched_to_loops": matched}


def _deliver_email(to: str, subject: str, body: str) -> None:
    """The one place a message actually leaves the building, or doesn't.
    Defaults to print-only — flip LOOPKEEPER_EMAIL_MODE=gmail in .env
    when ready to go live."""
    if os.getenv("LOOPKEEPER_EMAIL_MODE") == "gmail":
        from . import gmail_client
        gmail_client.send_email(to, subject, body)
        print(f"[GMAIL — ACTUALLY SENT] to {to} | {subject}")
    else:
        print(f"[SENT — print mode] to {to} | {subject}\n{body}")


def list_open_loops(sort_by_priority: bool = True) -> list[dict]:
    """Return every open (unresolved) invoice-chasing loop.

    Call this after checking for new replies. With sort_by_priority=True (the default)
    loops come back ranked highest financial-impact-and-urgency first —
    work through them in that order, not oldest-first.
    """
    return store.list_loops(include_closed=False, sort_by_priority=sort_by_priority)


def get_loop_detail(loop_id: str) -> dict:
    """Full detail and history for one loop, including its client_id."""
    loop = store.get_loop(loop_id)
    return loop if loop else {"error": f"no loop found with id {loop_id}"}


def get_client_profile(client_id: str) -> dict:
    """Relationship memory for a client: average days-to-pay, promises
    made vs kept, relationship tier, and notes. Check this before
    deciding tone — a chronic slow payer at day 5 is not the same
    situation as a normally-fast payer at day 5.
    """
    client = store.get_client(client_id)
    return client if client else {"error": f"no client found with id {client_id}"}


def check_action_tier(loop_id: str) -> dict:
    """Check what you're allowed to do for this loop before acting.

    Returns {"tier": 1|2|3, "meaning": ..., "reason": ...}. ALWAYS call
    this before send_followup on anything that isn't obviously routine —
    it tells you whether you can send directly, need to draft-and-wait,
    or shouldn't act at all.
    """
    loop = store.get_loop(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}
    tier = policy.required_tier(loop)
    return {
        "tier": tier,
        "meaning": policy.TIER_NAMES[tier],
        "reason": policy.explain_tier(loop),
    }


def send_followup(loop_id: str, subject: str, body: str) -> dict:
    """Send (or draft) a follow-up email for this loop.

    This tool enforces the authority tier itself — it does not trust
    your judgment alone:
      - Tier 1: sends immediately via _deliver_email, logs it.
      - Tier 2: does NOT send. Saves it as a draft awaiting the owner's
        one-tap approval, and tells you that's what happened.
      - Tier 3: refuses outright. Call escalate_to_human() instead.
    """
    loop = store.get_loop(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}

    tier = policy.required_tier(loop)

    if tier == 3:
        return {
            "blocked": True,
            "tier": 3,
            "message": (
                f"Policy blocks autonomous or drafted messages here "
                f"({policy.explain_tier(loop)}). Call escalate_to_human() instead."
            ),
        }

    if tier == 2:
        result = store.save_draft(loop_id, subject, body)
        print(f"\n{'=' * 60}\n[DRAFTED — AWAITING YOUR APPROVAL] {loop['client_email']}")
        print(f"Subject: {subject}\nReason held: {policy.explain_tier(loop)}")
        print(f"---\n{body}\n{'=' * 60}\n")
        return {"drafted": True, "tier": 2, "loop": result}

    # Tier 1 - dispatch email via delivery helper
    _deliver_email(loop['client_email'], subject, body)
    return {"sent": True, "tier": 1, "loop": store.record_contact(loop_id, "email", f"sent: {subject}")}


def list_pending_approvals() -> list[dict]:
    """Everything currently drafted and waiting on the owner's OK."""
    return store.list_pending_approvals()


def send_pending_draft(loop_id: str) -> dict:
    """The human just approved a Tier-2 draft — send it now."""
    result = store.send_draft(loop_id)
    if "error" in result:
        return result
    _deliver_email(result['client_email'], result['subject'], result['body'])
    return result


def split_disputed_amount(loop_id: str, disputed_amount: float, reason: str) -> dict:
    """Separate a partially disputed invoice into two independent loops
    instead of freezing the whole amount.
    """
    return store.split_loop(loop_id, disputed_amount, reason)


def update_loop_status(loop_id: str, new_status: str, exception_type: str, note: str) -> dict:
    """Update a loop's status and exception_type after new information."""
    return store.update_status(loop_id, new_status, note, exception_type)


def escalate_to_human(loop_id: str, reason: str) -> dict:
    """Flag a loop for the owner's direct attention — no draft, no send."""
    loop = store.get_loop(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}
    print(f"\n🚨 ESCALATION NEEDED — {loop['client_name']} ({loop_id})\n   Reason: {reason}\n")
    return store.escalate(loop_id, reason)


def verify_and_close(loop_id: str, verification_note: str) -> dict:
    """Verify that payment has been completed and close the loop.
    
    Call this ONLY when a client's reply explicitly confirms payment
    (e.g., 'invoice has been paid', 'wire transfer sent', 'check is in the mail')
    and payment details have been verified in history. The tool enforces
    strict verification rules to ensure pay confirmation actually exists.
    """
    return store.verify_and_close(loop_id, verification_note, by_agent=True)


def detect_and_store_promise(loop_id: str, promised_date: str, source_text: str) -> dict:
    """Call this when a client reply contains a clear payment promise.

    LLM interprets the reply and extracts the promised_date (ISO format:
    YYYY-MM-DD). This function deterministically stores that promise in the
    state machine: sets exception_type = 'promise_pending', stores
    promise_date, and logs the transition.

    The agent MUST NOT follow up on this loop while the promise is still
    valid (i.e., today <= promise_date). Call check_promise_status() on
    subsequent runs to see if the deadline has passed without payment.

    Examples of when to call:
      - "We'll pay by Friday."
      - "Payment goes out on the 28th."
      - "Our accounting will process this next week."
    """
    return store.store_promise(loop_id, promised_date, source_text)


def check_promise_status(loop_id: str) -> dict:
    """Check whether a pending promise has been kept, broken, or is still valid.

    Returns:
      { "status": "pending" | "broken" | "kept" | "no_promise",
        "promise_date": "...", "days_remaining": N }

    - "pending"   → promise date hasn't arrived yet. Do nothing.
    - "broken"    → date passed with no payment evidence. Recalculate tier
                    and act accordingly (policy.required_tier() will now
                    return tier 2 for promise_broken).
    - "kept"      → payment evidence found. Call verify_and_close().
    - "no_promise" → loop has no recorded promise.

    This is deterministic — no LLM call. The date comparison and payment
    evidence check are pure logic in store.py.
    """
    from datetime import date as _date
    loop = store.get_loop(loop_id)
    if not loop:
        return {"error": f"no loop found with id {loop_id}"}

    promise_raw = loop.get("promise_date")
    if not promise_raw:
        return {"status": "no_promise", "loop_id": loop_id}

    try:
        promise_date = _date.fromisoformat(promise_raw)
    except ValueError:
        return {"status": "no_promise", "error": f"invalid promise_date: {promise_raw}"}

    today = _date.today()
    days_remaining = (promise_date - today).days

    # Check for payment evidence
    payment_kw = ["paid", "pay", "sent", "wire", "transfer", "check", "receipt", "confirm"]
    has_payment = any(
        any(kw in h["event"].lower() for kw in payment_kw)
        for h in loop.get("history", [])
        if "[INCOMING REPLY]" in h.get("event", "") or "[email] client replied" in h.get("event", "")
    )

    if has_payment:
        return {"status": "kept", "promise_date": promise_raw, "days_remaining": days_remaining}
    if today <= promise_date:
        return {"status": "pending", "promise_date": promise_raw, "days_remaining": days_remaining}
    # Date passed, no payment
    return {"status": "broken", "promise_date": promise_raw, "days_overdue": abs(days_remaining)}


def get_resolution_report() -> dict:
    """The end-of-run summary: total outstanding, what's resolved,
    what's broken down by cause, and what's broken down by authority tier.
    Call this last, every run.
    """
    return store.get_resolution_report()


# ---------------------------------------------------------------------------
# ROOT AGENT
# ---------------------------------------------------------------------------

root_agent = Agent(
    name="loop_keeper_agent",
    model="gemini-3.5-flash",
    description=(
        "Owns every unpaid invoice for a small agency until it's resolved — "
        "investigates why each one is stuck, acts within a defined authority "
        "tier, and only interrupts the owner for real judgment calls."
    ),
    instruction="""
You are LoopKeeper. Every run, you work through the ENTIRE open loop
registry, ranked by financial impact and urgency — not one invoice at a
time on request, and not oldest-first.

For each run:

0. Call check_for_new_replies() FIRST, always. This polls Gmail for new
   client responses and logs them to active loops.

1. Call list_open_loops() second (sort_by_priority=True). That ranked
   list is your worklist, in order.

2. For EACH loop, in that order:
   a. Call get_loop_detail(loop_id) for full history.
   b. Call get_client_profile(client_id) — relationship memory changes
      how you should read the situation. A chronic slow payer at day 5
      is not the same as a normally-fast payer at day 5.
   c. Decide what's actually going on: fresh overdue, gone silent,
      waiting on a promise that hasn't come due, a broken promise, a
      dispute (full or partial), or an invoice/reference problem.

   NEW EVIDENCE — promises:
   d. If a client reply contains a clear payment promise ('will pay by
      Friday', 'payment on the 28th'), call detect_and_store_promise()
      with the loop_id, the extracted ISO date (YYYY-MM-DD), and the
      relevant part of their message. Do NOT guess the date — only call
      this when the reply contains an explicit date or clear timeframe.
   e. If a loop already has exception_type='promise_pending', call
      check_promise_status() first. If status is 'pending', do nothing
      more for this loop — the promise is still valid. If 'broken',
      recalculate priority, re-read the tier, and act accordingly.
      If 'kept', call verify_and_close().

   f. If the invoice is only PARTIALLY disputed — client contests some
      of it but not all — call split_disputed_amount() immediately.
      Don't leave the undisputed portion frozen behind the dispute.
   g. Before any client-facing message, call check_action_tier() and
      obey what it says. send_followup() enforces this itself, but
      check first so your reasoning matches what will actually happen.
   h. If action is needed: send_followup() with a specific, honest
      message — invoice number, amount, days overdue, and a tone that
      matches the relationship history, not a generic template. If it
      comes back 'drafted' (Tier 2), that's expected — say so in your
      summary, don't try to force it through.
   i. If it's Tier 3, or you're genuinely unsure: escalate_to_human()
      with a clear, specific reason. Don't guess on a large or full
      dispute, relationship-ending language, or legal language.
   j. If a client's reply explicitly confirms payment, call verify_and_close()
      to resolve the loop. Do NOT call update_loop_status() to close it.
   k. A valid decision can be "do nothing yet" — e.g. a promise was
      just made and its date hasn't passed. Only skip a loop after
      you've actually looked at it, never by default.

3. If the owner has approved a pending draft (they'll say so directly,
   e.g. "send the draft for inv_1003" or "approve it"), call
   send_pending_draft() for that loop — don't re-draft from scratch.

4. End every run by calling get_resolution_report() and summarizing it
   in plain English: total outstanding, what moved forward, what's
   waiting on the owner's approval, what's escalated and why, and what's
   validly just waiting on a promise.

You are not answering one question about one invoice. You are working
the whole registry, autonomously, in priority order, every time you run.
""",
    tools=[
        check_for_new_replies,
        list_open_loops,
        get_loop_detail,
        get_client_profile,
        check_action_tier,
        send_followup,
        list_pending_approvals,
        send_pending_draft,
        split_disputed_amount,
        update_loop_status,
        escalate_to_human,
        verify_and_close,
        detect_and_store_promise,
        check_promise_status,
        get_resolution_report,
    ],
)