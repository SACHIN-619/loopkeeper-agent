"""
policy.py — Authority Boundary Engine for Controlled AI Autonomy.

=============================================================================
BUSINESS LOGIC & SAFETY ARCHITECTURE
=============================================================================
This module defines the 3-Tier Authority System for LoopKeeper:

  • Tier 1 (Autonomous):
    Small, routine, low-risk invoices ($0 - $4,999).
    The AI agent reasons over client history and automatically sends follow-ups.

  • Tier 2 (Human Approval Required):
    Medium-to-high risk invoices ($5,000+) or broken commitments.
    The AI agent drafts the follow-up message, but holds it in the Approval Queue
    until the user approves it with a single tap.

  • Tier 3 (Escalation / Human Only):
    High-value disputes ($10,000+) or full dispute exceptions.
    The AI agent refuses to draft or message autonomously. It escalates to the owner
    with a clear explanation ("Why you're seeing this").

CRITICAL DESIGN PRINCIPLE:
Deterministic execution rules are enforced in Python code BEFORE tool calls.
The AI model (Gemini) is NEVER trusted to police its own authority boundaries.
=============================================================================
"""

# --- Threshold Config ----------------------------------------------------

# Invoices at or above $5,000 require human approval before emailing
TIER2_AMOUNT_THRESHOLD = 5000       

# Disputes at or above $10,000 require manual human-only intervention
TIER3_DISPUTE_THRESHOLD = 10000     

# After 3 unanswered follow-up attempts, hold further messages for human review
SILENT_ATTEMPTS_FOR_TIER2 = 3       

# Human-readable label lookup map for UI rendering
TIER_NAMES = {
    1: "autonomous",
    2: "needs your approval",
    3: "human only — agent will not draft this",
}


def required_tier(loop: dict, action: str = "send_followup") -> int:
    """
    Deterministically evaluates the required authority tier (1, 2, or 3) for a given loop.

    Parameters:
      loop (dict): The invoice state dictionary (amount, exception_type, disputed_amount, etc.)
      action (str): The requested tool action (e.g. 'send_followup', 'save_draft')

    Returns:
      int: 1 (Autonomous), 2 (Approval Required), or 3 (Human Only Escalation)
    """
    exception_type = loop.get("exception_type", "")
    disputed = loop.get("disputed_amount", 0) or 0
    amount = loop.get("amount", 0) or 0
    contact_count = loop.get("contact_count", 0) or 0

    # Rule 1 (Tier 3): Full disputes or large disputes >= $10,000 are strictly human-only
    if exception_type == "dispute_full":
        return 3
    if disputed >= TIER3_DISPUTE_THRESHOLD:
        return 3

    # Rule 2 (Tier 2): Any partial dispute must be reviewed before sending
    if disputed > 0:
        return 2

    # Rule 3 (Tier 2): Broken payment promises require human sanity check before tone escalates
    if exception_type == "promise_broken":
        return 2

    # Rule 4 (Tier 2): Invoices exceeding the $5,000 threshold require approval
    if amount >= TIER2_AMOUNT_THRESHOLD:
        return 2

    # Rule 5 (Tier 2): Repeated unanswered contacts (>3) trigger approval check to prevent spamming
    if contact_count >= SILENT_ATTEMPTS_FOR_TIER2:
        return 2

    # Default (Tier 1): Routine overdue invoice within safe autonomous bounds
    return 1


def explain_tier(loop: dict, action: str = "send_followup") -> str:
    """
    Returns an auditable, human-readable justification for the assigned authority tier.

    Used in the Command Center, Decision Timeline, and Agent Activity log so users
    can verify exactly why an invoice was placed in Tier 1, 2, or 3.
    """
    tier = required_tier(loop, action)
    exception_type = loop.get("exception_type", "")
    disputed = loop.get("disputed_amount", 0) or 0
    amount = loop.get("amount", 0) or 0
    contact_count = loop.get("contact_count", 0) or 0

    if tier == 3:
        if exception_type == "dispute_full":
            return "Full amount disputed — escalated for direct human intervention"
        return f"Disputed amount (${disputed:,.0f}) exceeds the $10,000 human-only threshold"
    if tier == 2:
        if disputed > 0:
            return f"${disputed:,.0f} disputed — needs human approval before message release"
        if exception_type == "promise_broken":
            return "Client payment promise was broken — approval required before follow-up"
        if amount >= TIER2_AMOUNT_THRESHOLD:
            return f"${amount:,.0f} invoice exceeds the $5,000 auto-send threshold"
        if contact_count >= SILENT_ATTEMPTS_FOR_TIER2:
            return f"{contact_count} unanswered attempts — require approval before further follow-up"
    return "Within safe autonomous bounds — agent acts automatically"