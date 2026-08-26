/**
 * mockData.js — Sandbox demo data.
 * All history entries use {date, event} format.
 * priority_why is computed at import time via annotateLoop().
 * No hardcoded display values.
 */
import { annotateLoop } from "./priorityLogic.js";

export const CLIENTS = {
  cl_brightpath: {
    client_id: "cl_brightpath",
    name: "Bright Path Design Co.",
    email: "accounts@brightpathdesign.example.com",
    avg_days_to_pay: 6,
    promises_made: 1,
    promises_kept: 1,
    relationship_tier: "long-standing, reliable",
    notes: "Usually pays within a week. First time they've been late.",
  },
  cl_haldenrue: {
    client_id: "cl_haldenrue",
    name: "Halden & Rue LLP",
    email: "billing@haldenrue.example.com",
    avg_days_to_pay: 10,
    promises_made: 3,
    promises_kept: 3,
    relationship_tier: "reliable",
    notes: "Always communicates before paying late. All promises held.",
  },
  cl_kestrel: {
    client_id: "cl_kestrel",
    name: "Kestrel Home Goods",
    email: "ap@kestrelhome.example.com",
    avg_days_to_pay: 35,
    promises_made: 2,
    promises_kept: 1,
    relationship_tier: "chronic slow payer",
    notes: "Consistently pays eventually, but needs firm follow-up. One broken promise on record.",
  },
  cl_norr: {
    client_id: "cl_norr",
    name: "Norr Studio",
    email: "hello@norrstudio.example.com",
    avg_days_to_pay: null,
    promises_made: 0,
    promises_kept: 0,
    relationship_tier: "new client",
    notes: "First invoice with this client. No payment history yet.",
  },
  cl_ambit: {
    client_id: "cl_ambit",
    name: "Ambit Robotics",
    email: "finance@ambitrobotics.example.com",
    avg_days_to_pay: 15,
    promises_made: 2,
    promises_kept: 1,
    relationship_tier: "mid-size, mixed track record",
    notes: "Broke one promise before but ultimately paid. Worth a personal touch.",
  },
  cl_torrey: {
    client_id: "cl_torrey",
    name: "Torrey & Vance Consulting",
    email: "payables@torreyvance.example.com",
    avg_days_to_pay: 20,
    promises_made: 1,
    promises_kept: 1,
    relationship_tier: "large account",
    notes: "High invoice values. Any dispute here needs human-reviewed response.",
  },
  cl_fernwood: {
    client_id: "cl_fernwood",
    name: "Fernwood Realty",
    email: "accounts@fernwoodrealty.example.com",
    avg_days_to_pay: 12,
    promises_made: 1,
    promises_kept: 1,
    relationship_tier: "reliable",
    notes: "Recently resolved a late invoice without issue.",
  },
};

// Raw loops — annotateLoop() computes tier, priority_why, days_overdue
const RAW_LOOPS = [
  {
    loop_id: "inv_1006",
    client_id: "cl_torrey",
    client_email: "payables@torreyvance.example.com",
    invoice_number: "INV-1006",
    amount: 18500,
    disputed_amount: 18500,
    undisputed_amount: 0,
    status: "disputed",
    exception_type: "dispute_full",
    contact_count: 1,
    due_date: "2026-07-04",
    history: [
      { date: "2026-06-15", event: "Invoice sent" },
      { date: "2026-07-04", event: "Became overdue — no payment received" },
      { date: "2026-07-10", event: "[email] Reminder sent — no reply" },
      { date: "2026-07-20", event: "[INCOMING REPLY] Client disputes the entire scope of work — says project was never formally approved" },
    ],
    escalation_reason: "Full amount disputed on a large account — this needs your judgment on the underlying scope disagreement, not an automated email.",
    unread_reply: true,
  },
  {
    loop_id: "inv_1005",
    client_id: "cl_ambit",
    client_email: "finance@ambitrobotics.example.com",
    invoice_number: "INV-1005",
    amount: 7300,
    disputed_amount: 0,
    undisputed_amount: 7300,
    status: "overdue",
    exception_type: "fresh_overdue",
    contact_count: 0,
    due_date: "2026-08-17",
    history: [
      { date: "2026-08-03", event: "Invoice sent" },
      { date: "2026-08-17", event: "Became overdue — no contact yet" },
    ],
    draft: {
      subject: "INV-1005 — Payment now overdue",
      body: "Hi Ambit team,\n\nJust flagging that INV-1005 ($7,300) came due today and we haven't received payment yet. No rush if it's already in motion — let us know if anything's needed from our side.\n\nThanks,\nThe team",
      held_reason: "Amount exceeds the $5,000 auto-send threshold",
    },
  },
  {
    loop_id: "inv_1004",
    client_id: "cl_norr",
    client_email: "hello@norrstudio.example.com",
    invoice_number: "INV-1004",
    amount: 2600,
    disputed_amount: 600,
    undisputed_amount: 2000,
    status: "disputed",
    exception_type: "dispute_partial",
    contact_count: 1,
    due_date: "2026-07-15",
    history: [
      { date: "2026-07-01", event: "Invoice sent" },
      { date: "2026-07-15", event: "Became overdue" },
      { date: "2026-07-18", event: "[INCOMING REPLY] Client disputes the $600 revision line item — no objection to remaining $2,000" },
      { date: "2026-07-18", event: "Split applied: $600 moved to disputed thread, $2,000 continues as undisputed" },
    ],
    draft: {
      subject: "INV-1004 — Following up on the $2,000 we agree on",
      body: "Hi Norr team,\n\nThanks for flagging the revision line — we've set the $600 aside to discuss separately. For the $2,000 that isn't in question, could you confirm timing on that portion?\n\nThanks,\nThe team",
      held_reason: "Any disputed amount holds for review before going out",
    },
  },
  {
    loop_id: "inv_1001",
    client_id: "cl_brightpath",
    client_email: "accounts@brightpathdesign.example.com",
    invoice_number: "INV-1001",
    amount: 4200,
    disputed_amount: 0,
    undisputed_amount: 4200,
    status: "overdue",
    exception_type: "fresh_overdue",
    contact_count: 0,
    due_date: "2026-07-24",
    history: [
      { date: "2026-07-10", event: "Invoice sent" },
      { date: "2026-07-24", event: "Became overdue — no contact yet" },
    ],
  },
  {
    loop_id: "inv_1003",
    client_id: "cl_kestrel",
    client_email: "ap@kestrelhome.example.com",
    invoice_number: "INV-1003",
    amount: 950,
    disputed_amount: 0,
    undisputed_amount: 950,
    status: "overdue",
    exception_type: "silent",
    contact_count: 3,
    due_date: "2026-06-03",
    history: [
      { date: "2026-05-20", event: "Invoice sent" },
      { date: "2026-06-03", event: "Became overdue" },
      { date: "2026-06-10", event: "[email] Reminder #1 sent — no reply" },
      { date: "2026-06-24", event: "[email] Reminder #2 sent — no reply" },
      { date: "2026-07-08", event: "[email] Firmer reminder #3 sent — no reply" },
    ],
    draft: {
      subject: "INV-1003 — Fourth follow-up",
      body: "Hi Kestrel team,\n\nThis is the fourth time we're reaching out about INV-1003 ($950), now 69 days past due. Could you let us know what's happening and when we can expect payment?\n\nThanks,\nThe team",
      held_reason: "3rd unanswered attempt — approve before tone escalates further",
    },
  },
  {
    loop_id: "inv_1002",
    client_id: "cl_haldenrue",
    client_email: "billing@haldenrue.example.com",
    invoice_number: "INV-1002",
    amount: 1800,
    disputed_amount: 0,
    undisputed_amount: 1800,
    status: "promised",
    exception_type: "promise_pending",
    contact_count: 1,
    due_date: "2026-06-29",
    history: [
      { date: "2026-06-15", event: "Invoice sent" },
      { date: "2026-06-29", event: "Became overdue" },
      { date: "2026-07-05", event: "[email] Reminder #1 sent" },
      { date: "2026-08-10", event: "[INCOMING REPLY] Client replied: will pay by Friday Aug 21" },
    ],
    unread_reply: false,
  },
];

// Annotate all loops: computes tier, priority_why, days_overdue from real logic
export const LOOPS = RAW_LOOPS.map(annotateLoop);

// Mock resolved loops for Sandbox Mode
export const RESOLVED_LOOPS = [
  {
    loop_id: "inv_r001",
    client_id: "cl_fernwood",
    invoice_number: "INV-0998",
    amount: 3100,
    resolved_date: "2026-08-20",
    history: [
      { date: "2026-08-18", event: "Payment received via bank transfer" },
      { date: "2026-08-20", event: "VERIFIED & CLOSED: Wire transfer confirmed by agency owner" },
    ],
  },
];

/** Agent run log — shown in Activity → Agent Runs tab.
 *  Mirrors the schema written by store.save_run_log() on the backend.
 *  In sandbox mode this is the display source.
 *  In live mode, Activity fetches from GET /agent/status.
 */
export const AGENT_RUNS = [
  {
    run_id: "run_003",
    trigger: "scheduler",
    started_at: "2026-08-25T08:00:03Z",
    completed_at: "2026-08-25T08:00:08Z",
    duration_ms: 4821,
    status: "completed",
    loops_scanned: 6,
    broken_promises: 1,
    plans_changed: 1,
    emails_sent: 1,
    approvals_created: 2,
    resolved: 0,
    failures: 0,
    broken_promise_loops: ["inv_1002"],
    decisions: [
      { loop_id: "inv_1006", tool: "escalate_to_human",    authority: "tier_3", action: "escalated",             reasoning_summary: "Full dispute $18,500 — exceeds human-only threshold. Agent refuses to draft." },
      { loop_id: "inv_1005", tool: "send_followup",        authority: "tier_2", action: "draft_created",         reasoning_summary: "$7,300 exceeds $5,000 auto-send threshold. Draft held for your approval." },
      { loop_id: "inv_1002", tool: "check_promise_status", authority: "tier_2", action: "promise_broken_detected",reasoning_summary: "Promise deadline Aug 21 passed. No payment evidence. Plan changed: escalating." },
      { loop_id: "inv_1004", tool: "send_followup",        authority: "tier_2", action: "draft_created",         reasoning_summary: "Partial dispute present. Draft held pending your review." },
      { loop_id: "inv_1001", tool: "verify_and_close",     authority: "tier_1", action: "loop_closed",           reasoning_summary: "Reply 'Paid!' contains payment keyword. Evidence verified. Loop resolved." },
    ],
    sources: { gmail: false, firestore: false, policy: true },
  },
  {
    run_id: "run_002",
    trigger: "scheduler",
    started_at: "2026-08-24T12:00:01Z",
    completed_at: "2026-08-24T12:00:06Z",
    duration_ms: 5102,
    status: "completed",
    loops_scanned: 6,
    broken_promises: 0,
    plans_changed: 1,
    emails_sent: 1,
    approvals_created: 1,
    resolved: 0,
    failures: 0,
    broken_promise_loops: [],
    decisions: [
      { loop_id: "inv_1002", tool: "detect_and_store_promise", authority: "tier_1", action: "promise_stored",   reasoning_summary: "Reply from Aug 5 contains explicit promise: 'will pay by Friday Aug 21'. Date extracted. Monitoring." },
      { loop_id: "inv_1003", tool: "send_followup",            authority: "tier_2", action: "draft_created",   reasoning_summary: "3 unanswered attempts — Tier 2. Draft prepared, not sent without approval." },
    ],
    sources: { gmail: false, firestore: false, policy: true },
  },
  {
    run_id: "run_001",
    trigger: "manual",
    started_at: "2026-08-24T08:00:00Z",
    completed_at: "2026-08-24T08:00:05Z",
    duration_ms: 4633,
    status: "completed",
    loops_scanned: 6,
    broken_promises: 0,
    plans_changed: 0,
    emails_sent: 2,
    approvals_created: 0,
    resolved: 0,
    failures: 0,
    broken_promise_loops: [],
    decisions: [
      { loop_id: null, summary: "First run. 6 loops scanned. Tier-1 follow-ups sent for INV-1001 ($4,200) and INV-1003 ($950). INV-1005 ($7,300) held — exceeds threshold. INV-1006 ($18,500) escalated — full dispute." },
    ],
    sources: { gmail: false, firestore: false, policy: true },
  },
];

/** Last run summary for the Agent Status Panel.
 *  In sandbox, derived from AGENT_RUNS[0]. In live mode, from GET /agent/status.
 */
export const AGENT_STATUS = {
  agent_status: "healthy",
  stale: false,
  last_run: AGENT_RUNS[0],
  sources: { gmail: false, firestore: false, policy: true },
};

