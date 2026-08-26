# LoopKeeper Codebase Audit Report

This report evaluates the current implementation of LoopKeeper against the product specification and hackathon judging criteria.

---

## SECTION 1 — Executive Verdict

**Rating:** **DEMO READY** (Fully functional backend and modularized frontend, with minor logical gaps in Gmail de-duplication, state transition triggers, and UI controls for loop closure).

---

## SECTION 2 — Critical Blockers

1. **Missing Root Git Ignore (`.gitignore`):**
   - **Severity:** CRITICAL
   - **Files:** `/` (Project Root)
   - **Behavior:** No `.gitignore` exists at the root. Running `git init` and pushing to GitHub will accidentally leak `credentials.json`, `token.json`, and `.env` files.
   - **Fix:** Create a root `.gitignore` that explicitly excludes secrets, environment variables, local databases, and temporary directories.
   - **Timeline:** MUST FIX BEFORE GITHUB

2. **Inability to Verify & Close Invoices:**
   - **Severity:** CRITICAL
   - **Files:** `frontend/src/components/ActionPanel.jsx`, `frontend/src/CommandCenter.jsx`, `agent.py`
   - **Behavior:** `verify_and_close()` exists in `store.py`/`store_firestore.py` but is not exposed to the Agent as a tool, and there is no "Mark as Paid & Close" button in the frontend. Paid invoices can never actually be closed/stamp-resolved by the user or agent.
   - **Fix:** Add a "Verify Payment & Resolve" action button in `ActionPanel` for appropriate cases (such as those with status "promised" or "overdue") and expose `verify_and_close` to the backend ADK agent.
   - **Timeline:** MUST FIX BEFORE FINAL VIDEO

---

## SECTION 3 — Backend Gaps

1. **Gmail Message De-duplication (A. Problem-statement / J. Duplicate-event):**
   - **Severity:** HIGH
   - **Files:** `agent.py` -> `check_for_new_replies()`
   - **Current Behavior:** Searches Gmail using `newer_than:1d` on every run. If the agent runs every hour, it will retrieve the same message multiple times and append duplicate `[INCOMING REPLY]` entries to the loop history indefinitely.
   - **Expected Behavior:** The agent should check if a message has already been processed (e.g., by matching message ID or checking history for identical text) before logging the reply.
   - **Fix:** Store a list of processed Gmail message IDs in the loop metadata, or check history events before logging a duplicate.
   - **Timeline:** MUST FIX BEFORE CLOUD DEPLOY

2. **Verify and Close Tool Missing from Agent (B. Agent Autonomy / T. Resolution Verification):**
   - **Severity:** HIGH
   - **Files:** `agent.py` -> `root_agent`
   - **Current Behavior:** The agent has tools for follow-ups and disputes but does not have `verify_and_close` in its tool list.
   - **Expected Behavior:** If the client explicitly confirms payment in a reply, the agent should autonomously close the loop.
   - **Fix:** Add `verify_and_close` to the `root_agent` tools list.
   - **Timeline:** MUST FIX BEFORE REHEARSAL

---

## SECTION 4 — Frontend Gaps

1. **Glowing "NEW INFORMATION" Badge Never Displayed (O. Scheduler/Autonomous / V. Demo Reliability):**
   - **Severity:** HIGH
   - **Files:** `frontend/src/CommandCenter.jsx`, `frontend/src/components/LoopRow.jsx`
   - **Current Behavior:** `LoopRow` supports a `justChanged` animation, but `CommandCenter.jsx` never passes this prop. The glowing badge is never rendered.
   - **Expected Behavior:** The dashboard should flag rows where the last history item occurred in the last run (or check for a boolean flag on the loop model) and highlight them.
   - **Fix:** Check if the last history event contains `"[INCOMING REPLY]"` or `"[email] client replied"` or happened in the last session, and set `justChanged={true}`.
   - **Timeline:** MUST FIX BEFORE REHEARSAL

2. **Tier-1 Proposed Draft Preview (F. Priority / P. Frontend Data Parity):**
   - **Severity:** MEDIUM
   - **Files:** `frontend/src/components/ActionPanel.jsx`
   - **Current Behavior:** For Tier-1 loops, it simply says: *"Within the agent's own authority — it acts on this without waiting on you."*
   - **Expected Behavior:** The user should see the exact email body the agent is preparing to send on its next run, reinforcing transparency.
   - **Fix:** Expand the Tier-1 panel representation to optionally show the last sent or scheduled email draft.
   - **Timeline:** OPTIONAL

---

## SECTION 5 — Integration Gaps

1. **Sandbox Mode Action Persistence (H. Firestore / R. Refresh Persistence):**
   - **Severity:** HIGH
   - **Files:** `frontend/src/components/ActionPanel.jsx`
   - **Current Behavior:** Clicking "Approve & send" in Sandbox mode changes the React state to `sent` but does not write to the local database file (`open_loops.json`). Refreshing the browser resets the loop back to its unapproved state.
   - **Expected Behavior:** If a local mock server is running, the mock action should save so it survives refreshes.
   - **Fix:** If no Cloud Run URL is configured, display a clear warning: `Simulate Approval (Temporary)`. If mock data is active, update a local sessionStorage state to persist approvals across refreshes.
   - **Timeline:** MUST FIX BEFORE REHEARSAL

---

## SECTION 6 — Failure Handling Gaps

1. **Connection Errors and Fallback Clarity (K. Error handling / Q. Latency experience):**
   - **Severity:** MEDIUM
   - **Files:** `frontend/src/CommandCenter.jsx`
   - **Current Behavior:** If Firestore fails to load, the app quietly drops back to mock data. The user has no explicit notification that Firestore is down other than the small "Sandbox Mode" pill.
   - **Expected Behavior:** An explicit, readable banner explaining that Firestore/Cloud Run connection is offline, with a reload button.
   - **Fix:** Add a descriptive warning banner when `liveError` is active.
   - **Timeline:** OPTIONAL

---

## SECTION 7 — Demo/WOW Gaps

1. **Visualizing Plan Mutation (V. Demo Reliability):**
   - **Severity:** HIGH
   - **Files:** `frontend/src/components/LoopRow.jsx`
   - **Current Behavior:** The priority explanation is static text.
   - **Expected Behavior:** If the priority has mutated (e.g. from high to low because of a promise), show a visual diff or timeline.
   - **Fix:** Highlight the active row status transition (e.g. "Overdue" -> "Promised") with clean badges.
   - **Timeline:** MUST FIX BEFORE FINAL VIDEO

---

## SECTION 8 — Security Gaps

1. **Authoritative Backend Safeguards (M. Authentication/Security):**
   - **Severity:** MEDIUM
   - **Files:** `store_firestore.py`
   - **Current Behavior:** `update_status` rejects closed states to enforce `verify_and_close`, but other direct writes could bypass it.
   - **Expected Behavior:** Database rules should enforce schema validations.
   - **Fix:** Add security comments and Firestore rules schema in the project instructions.
   - **Timeline:** OPTIONAL

---

## SECTION 9 — Test Matrix

| Test Case ID | Description | Input/Trigger | Expected Backend Result | Expected Frontend Result | Status |
|---|---|---|---|---|---|
| TC-001 | Fresh Overdue Invoice | Overdue invoice loaded | Assigned Tier 1, drafts email | Displays "Agent Handling", priority calculated | [VERIFIED] |
| TC-002 | Large Invoice Threshold | Invoice amount > $5,000 | Assigned Tier 2, drafts email | Displays "Needs your OK" badge, shows Approve button | [VERIFIED] |
| TC-003 | Full Dispute Escalation | Invoice exception = dispute_full | Assigned Tier 3, no email drafted | Displays "Needs You", shows escalation reason | [VERIFIED] |
| TC-004 | Gmail Duplicate Reply | Poll Gmail twice with same sender | Reply recorded only once in history | History ledger shows single message entry | [PARTIAL] |
| TC-005 | Sandbox Refresh | Approve Tier 2 draft in sandbox | Saves state locally | Row remains approved after browser refresh | [PARTIAL] |

---

## SECTION 10 — FINAL RELEASE GATE

### MUST FIX BEFORE GITHUB
- Create root `.gitignore` file mapping secrets and environments.

### MUST FIX BEFORE CLOUD DEPLOY
- Implement Gmail message ID de-duplication inside `agent.py`.

### MUST FIX BEFORE REHEARSAL
- Enable the glowing "NEW INFORMATION" badge dynamically in `CommandCenter.jsx`.
- Implement a sessionStorage check in `CommandCenter.jsx` to persist sandbox approvals across refreshes.
- Add `verify_and_close` to the `root_agent` tools list.

### MUST FIX BEFORE FINAL VIDEO
- Add the "Verify & Close" button in the frontend `ActionPanel.jsx` to complete the full invoice resolution demonstration.

### OPTIONAL
- Add connection error banners.
- Preview Tier-1 drafts.
