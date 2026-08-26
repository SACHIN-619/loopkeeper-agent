/**
 * priorityLogic.js — Transparent Economic Prioritization & Authority Tier Logic.
 *
 * =============================================================================
 * FORMULA & ALGORITHM EXPLANATION
 * =============================================================================
 * LoopKeeper ranks every open invoice using a transparent economic score:
 *
 *   Priority Score = Amount ($)  x  Urgency Multiplier  x  Situation Risk Weight
 *
 *   • Amount ($): Monetary value of the invoice.
 *   • Urgency Multiplier: 1.0 + (Days Overdue / 30). Increases steadily as time passes.
 *   • Situation Risk Weight:
 *       - Full Dispute: 1.5 (highest risk — immediate resolution needed)
 *       - Broken Promise: 1.3 (client broke a date commitment)
 *       - Partial Dispute: 1.2 (unclear invoice line items)
 *       - Silent: 1.1 (unanswered follow-ups accumulating)
 *       - Fresh Overdue: 1.0 (standard overdue)
 *       - Promise Pending: 0.3 (monitored active commitment — low risk)
 *       - Resolved: 0.0 (closed invoice)
 *
 * This math is 100% transparent and auditable — shown directly in the UI.
 * =============================================================================
 */

const RISK_WEIGHT = {
  dispute_full: 1.5,
  promise_broken: 1.3,
  dispute_partial: 1.2,
  silent: 1.1,
  fresh_overdue: 1.0,
  info_issue: 0.9,
  promise_pending: 0.3,
  resolved: 0.0,
};

const TIER2_AMOUNT_THRESHOLD = 5000;
const TIER3_DISPUTE_THRESHOLD = 10000;
const SILENT_ATTEMPTS_FOR_TIER2 = 3;

/** Calculates days past due_date (floored at 0) */
export function daysOverdue(loop) {
  if (!loop?.due_date) return 0;
  const diff = Math.floor((new Date() - new Date(loop.due_date)) / 86400000);
  return Math.max(diff, 0);
}

/** Calculates the economic priority score: Amount x Urgency x Risk */
export function priorityScore(loop) {
  const amount = loop.amount || 0;
  const urgency = 1 + daysOverdue(loop) / 30;
  const risk = RISK_WEIGHT[loop.exception_type] ?? 1.0;
  return Math.round(amount * urgency * risk * 100) / 100;
}

/** Generates a human-readable formula breakdown for UI tooltips and details */
export function explainPriority(loop) {
  const amount = loop.amount || 0;
  const du = daysOverdue(loop);
  const urgency = 1 + du / 30;
  const risk = RISK_WEIGHT[loop.exception_type] ?? 1.0;
  const score = priorityScore(loop);
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} impact  x  ${urgency.toFixed(2)} urgency (${du}d overdue)  x  ${risk.toFixed(1)} risk (${loop.exception_type || 'n/a'})  =  ${score.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Evaluates the required authority tier (1: Autonomous, 2: Approval, 3: Human Only) */
export function requiredTier(loop) {
  const disputed = loop.disputed_amount || 0;

  // Rule 1: Full disputes or large disputes >= $10,000 -> Tier 3
  if (loop.exception_type === "dispute_full" || disputed >= TIER3_DISPUTE_THRESHOLD) {
    return 3;
  }

  // Rule 2: Partial disputes, broken promises, amount >= $5,000, or 3+ silent attempts -> Tier 2
  if (disputed > 0 || loop.exception_type === "promise_broken" || (loop.amount || 0) >= TIER2_AMOUNT_THRESHOLD || (loop.contact_count || 0) >= SILENT_ATTEMPTS_FOR_TIER2) {
    return 2;
  }

  // Default: Tier 1 (Autonomous)
  return 1;
}

/** Annotates a raw loop object with computed priority scores, explanation, and tier */
export function annotateLoop(rawLoop) {
  const score = priorityScore(rawLoop);
  return {
    ...rawLoop,
    tier: requiredTier(rawLoop),
    priority_why: explainPriority(rawLoop),
    days_overdue: daysOverdue(rawLoop),
    priority_score: score,
  };
}