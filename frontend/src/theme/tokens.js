/**
 * tokens.js — Design System Tokens
 * All values reference CSS custom properties from index.css.
 * No hardcoded colors here — pull from CSS vars at runtime.
 */

export const TIER2_AMOUNT_THRESHOLD = 5000;
export const TIER3_DISPUTE_THRESHOLD = 10000;
export const SILENT_ATTEMPTS_FOR_TIER2 = 3;

export const RISK_WEIGHT = {
  dispute_full:    1.5,
  promise_broken:  1.3,
  dispute_partial: 1.2,
  silent:          1.1,
  fresh_overdue:   1.0,
  info_issue:      0.9,
  promise_pending: 0.3,
  resolved:        0.0,
};

// CSS variable references (strings for use in style={{ color: c.tier1 }})
export const c = {
  bg:              "var(--c-bg)",
  surface:         "var(--c-surface)",
  surface2:        "var(--c-surface-2)",
  surface3:        "var(--c-surface-3)",
  border:          "var(--c-border)",
  borderBright:    "var(--c-border-bright)",
  teal:            "var(--c-teal)",
  tealDim:         "var(--c-teal-dim)",
  tealGlow:        "var(--c-teal-glow)",
  text:            "var(--c-text)",
  text2:           "var(--c-text-2)",
  text3:           "var(--c-text-3)",
  textInv:         "var(--c-text-inv)",
  tier1:           "var(--c-tier1)",
  tier1bg:         "var(--c-tier1-bg)",
  tier1border:     "var(--c-tier1-border)",
  tier2:           "var(--c-tier2)",
  tier2bg:         "var(--c-tier2-bg)",
  tier2border:     "var(--c-tier2-border)",
  tier3:           "var(--c-tier3)",
  tier3bg:         "var(--c-tier3-bg)",
  tier3border:     "var(--c-tier3-border)",
  resolved:        "var(--c-resolved)",
  resolvedBg:      "var(--c-resolved-bg)",
  resolvedBorder:  "var(--c-resolved-border)",
  watching:        "var(--c-watching)",
  watchingBg:      "var(--c-watching-bg)",
  watchingBorder:  "var(--c-watching-border)",
};

export const f = {
  display: "var(--font-display)",
  body:    "var(--font-body)",
  mono:    "var(--font-mono)",
};

/** Tier metadata — used by Stamp and ActionPanel */
export const TIER_META = {
  watching: { color: c.watching, bg: c.watchingBg, border: c.watchingBorder, label: "WATCHING" },
  1:        { color: c.tier1,    bg: c.tier1bg,    border: c.tier1border,    label: "AGENT HANDLING" },
  2:        { color: c.tier2,    bg: c.tier2bg,    border: c.tier2border,    label: "NEEDS YOUR OK" },
  3:        { color: c.tier3,    bg: c.tier3bg,    border: c.tier3border,    label: "NEEDS YOU" },
};

/** Derive display tier — watching overrides numeric tier */
export function displayTier(loop) {
  return loop?.exception_type === "promise_pending" ? "watching" : (loop?.tier ?? 1);
}

/** Exception type → human label */
export function exceptionLabel(exceptionType) {
  const MAP = {
    fresh_overdue:   "Fresh Overdue",
    silent:          "Gone Silent",
    promise_pending: "Promise Pending",
    promise_broken:  "Broken Promise",
    dispute_partial: "Partial Dispute",
    dispute_full:    "Full Dispute",
    info_issue:      "Info Issue",
    resolved:        "Resolved",
  };
  return MAP[exceptionType] || exceptionType || "Unknown";
}

/** Format currency */
export function formatCurrency(amount, currency = "USD") {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
