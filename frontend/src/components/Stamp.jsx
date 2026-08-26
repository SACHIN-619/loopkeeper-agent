/**
 * Stamp.jsx — Authority badge shown on each loop row.
 * Includes hover tooltips explaining the tier authority level.
 */
import React from "react";
import { displayTier, TIER_META, f } from "../theme/tokens.js";

const TIER_TOOLTIPS = {
  1: "Tier 1 — Autonomous: Agent acts on its own without user intervention",
  2: "Tier 2 — Hold for Approval: Email drafted; held for your review & approval",
  3: "Tier 3 — Escalation: High value or dispute; requires human judgment",
  watching: "Watching: Monitoring active promise; follow-ups paused until date passes",
  resolved: "Resolved: Invoice payment verified and loop officially closed",
};

export default function Stamp({ loop, tier }) {
  const resolvedTier = loop ? displayTier(loop) : tier;
  const meta = TIER_META[resolvedTier] ?? TIER_META.watching;
  const tooltipText = TIER_TOOLTIPS[resolvedTier] || meta.label;

  return (
    <span
      title={tooltipText}
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.color,
        fontFamily: f.mono,
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.1em",
        padding: "4px 9px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
        transform: "rotate(-1deg)",
        transition: "all 0.2s ease",
        cursor: "help",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "rotate(0deg) scale(1.05)";
        e.currentTarget.style.boxShadow = `0 0 10px ${meta.color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "rotate(-1deg) scale(1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {meta.label}
    </span>
  );
}
