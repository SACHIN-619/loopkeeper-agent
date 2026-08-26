








# LoopKeeper — Product Spec v2 (locked before more code)

Everything below is a decision, not a discussion point. If you want to
reopen one, say so explicitly — otherwise this is what we build.

## 1. Who this is for

**Primary buyer/persona for the pitch:** the owner of a small service
agency (2-10 people) — design, dev, marketing, consulting shops juggling
10-40+ active clients on different terms, with no dedicated finance or
collections person.

**Why this over freelancer/solo consultant/50-person business:** enough
invoice volume and variety for a rich, honest demo (a freelancer's 3
invoices won't show the agent reasoning differently case-by-case); real
relationship stakes (losing a client actually hurts); still clearly
underserved (too small for HighRadius/Billtrust/Daylit's sales motion,
too complex for a plain reminder tool).

**Important build note:** this does NOT mean multi-user/team permissions.
The software stays single-owner — one Google account, one person
watching the registry. "Small agency" is the flavor of the *data*
(many clients, varied relationships), not a requirement on the *software*.
Keep it that way — team accounts are exactly the kind of scope-creep that
eats your two weeks for zero demo value.

**Demo data note:** if you personally have real freelance/consulting
invoices in your own inbox, using that for the actual demo — even while
the pitch talks about agencies — is the stronger BYOF play. Decide this
when we get to Day 2 (real vs. synthetic data), not now.

## 2. The job we take away

Not "remind me to follow up." It's: notice every invoice going stale,
work out *why* it's stuck, take the right next step without being asked,
and only interrupt the owner for the calls that actually need a human —
so getting paid doesn't cost the relationship or the owner's attention
every single day.

## 3. The moat — why this isn't "just automated reminders"

A fixed-cadence reminder tool cannot do any of these:

1. **Root-cause branching.** Classifies *why* an invoice is stuck — from
   the client's own words — and takes a different action per cause
   instead of "day 7 → reminder #2."
2. **Partial-dispute splitting.** If a client disputes part of an
   invoice, the agent separates disputed and undisputed amounts into two
   threads instead of freezing the whole invoice.
3. **Relationship memory.** Each client carries their own payment
   history and promise-keeping record, which shapes tone and urgency — a
   normally-fast payer who's 5 days late reads differently than a
   chronic 45-day payer at day 5.
4. **Autonomy tiers with real teeth.** The agent doesn't have blanket
   permission to say anything to a client — see §6 — which is what would
   let an actual owner trust it enough to leave running unattended.

## 4. Why Gemini / ADK specifically

A cron job or Zapier rule can do "day 7 → send template." It cannot read
*"there's an issue with the GST details, can you check?"* and correctly
recognize that's a dispute, not a promise, not silence — and switch from
collection mode to investigation mode. That requires judgment over
unstructured language, which is an agent problem, not an automation
problem. ADK gives that judgment real tools to act with, not just a chat
window — which is the actual "beyond standard chat loops" bar the
hackathon is asking for.

## 5. Exception taxonomy — final, 6 states

| State | Trigger | Typical action | Tier |
|---|---|---|---|
| Fresh overdue | No contact yet | First gentle reminder | 1 |
| Silent | 2nd/3rd touch, no reply | Firmer follow-up, tone escalates with contact count | 1, crosses to 2 past N attempts or $ threshold |
| Promise made | Client gives a date | Log commitment, do nothing until that date | 1 — waiting is a valid decision |
| Promise broken | Date passed, no payment | Reassess history, firmer message or escalate | 1 or 2, depending on history/amount |
| Dispute (full/partial) | Client contests amount | Switch to investigate mode; if partial, split into two threads, keep collecting the undisputed part | 2 (small) / 3 (large or repeat) |
| Invoice/reference issue | Wrong PO, "never received it," missing doc | Resend corrected info, verify receipt | 1 |

## 6. Autonomy tiers

- **Tier 1 — fully autonomous:** gentle/direct reminders, promise
  check-ins, resending corrected info, closing a loop on verified
  payment.
- **Tier 2 — drafted, held for one-tap approval:** firmer messages after
  a broken promise, anything above a configurable $ threshold, first
  response to a dispute.
- **Tier 3 — human-only, agent never drafts:** disputes above a
  configurable size, any relationship-ending language from the client,
  anything the agent isn't confident about.

## 7. The "killer screen" — Resolution Report

End of every run: loops checked, $ total outstanding, $ resolved or
progressed autonomously this run, $ awaiting approval, $ escalated (with
why), loops still validly waiting on a promise. Pure aggregation over
state that already exists — no new infrastructure needed.

## 8. Demo script — practical version of the "evolving client" idea

There's no live client to cooperate on camera, so it's shot in beats
using a small `simulate_reply.py` utility that appends a reply into a
loop's history exactly like a real Gmail reply would — the agent picks
it up on its next run, same as it will once Gmail is real.

1. **Run 1:** portfolio of 8-10 loops, several clients. Show the
   Resolution Report first for breadth, then focus on one client. Agent
   sends a warm first reminder that references relationship history.
2. Simulate reply: *"we'll pay Friday."*
3. **Run 2:** agent logs the commitment and correctly does nothing
   else — a good "smart because it holds back" beat.
4. Simulate Friday passing, no payment.
5. **Run 3:** agent detects the broken promise, tone shifts, drafts a
   firmer message — shown going through Tier 2 approval.
6. Simulate reply: disputes one line item, not the rest.
7. **Run 4:** agent splits the invoice, keeps collecting the undisputed
   part, escalates the disputed part with full context (Tier 3).
8. Close on the Resolution Report, now showing the whole portfolio.

## 9. Explicitly NOT building (pruned from the bigger brainstorm)

- A cross-system "Outcome Agent" spanning finance / procurement /
  logistics / compliance / sales. Too big for solo + 2 weeks, dilutes
  the demo down to nothing working end-to-end.
- Real PO/ERP or payment-reconciliation integration. "PO mismatch" and
  "payment not matched" are modeled with fields on the invoice record
  plus the agent's own reasoning over a client's reply — not a live
  system integration.
- A self-learning/ML pattern-recognition system. The agent can reference
  its own stored history in its reasoning (genuinely useful, honest to
  demo) — we are not claiming it "learns" in the ML sense.
- Multi-department, multi-user/team permissions. Single-owner account is
  enough. See §1.

## 10. Tech stack — confirmed, verified working

- Python + Google ADK 2.7.0 (installed and smoke-tested already)
- Gemini 3.5 Flash for all reasoning by default; Pro only as a later
  swap if one specific step needs it
- Firestore for the Open Loop Registry — Day 2 swap from the current
  JSON store, same interface
- Cloud Run via `adk deploy cloud_run` — command verified
- Cloud Scheduler → HTTP trigger on Cloud Run, for real autonomous
  background runs (this is what makes it "runs while you sleep" instead
  of "tool you have to remember to open")
- Gmail API (direct, OAuth) — deferred, not touching yet, per your call

## 11. File plan for the next coding pass (not written yet)

- `store.py` — add `exception_type`, `disputed_amount` /
  `undisputed_amount`, `client_profile` (avg days to pay, promise-keep
  rate). Extends what exists, doesn't replace it.
- `policy.py` — **new.** Tier thresholds as plain config values, not
  buried in prompt text, so they're easy to point to and defend in Q&A.
- `agent.py` — add `split_disputed_amount`, `draft_for_approval` (Tier
  2), `get_resolution_report`; tighten `escalate_to_human` to Tier 3
  only.
- `simulate_reply.py` — **new.** The demo utility from §8.
- `data/open_loops.json` — replace the 5 generic loops with the 8-10
  loop portfolio plus the one narrative-arc client.
- `README.md` — update the roadmap section to match this spec.

Nothing here touches Gmail, Firestore, or Cloud Run — still Day 2+, as
you called it.














