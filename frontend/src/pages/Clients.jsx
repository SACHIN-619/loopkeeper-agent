/**
 * Clients.jsx — Client relationship memory page.
 * Data-driven from CLIENTS object — no hardcoded display strings.
 * Fixed: no text overflow, proper card layout, tier chip doesn't wrap.
 */
import React from "react";
import { motion } from "framer-motion";
import { useApp } from "../contexts/AppContext.js";
import { CLIENTS } from "../data/mockData.js";
import { f, formatCurrency } from "../theme/tokens.js";

// Color lookup driven by tier string — no hardcoded per-value colors in JSX
const TIER_COLOR_MAP = {
  "long-standing, reliable":        "var(--c-tier1)",
  "reliable":                       "var(--c-tier1)",
  "new client":                     "var(--c-text-2)",
  "chronic slow payer":             "var(--c-tier3)",
  "mid-size, mixed track record":   "var(--c-tier2)",
  "large account":                  "var(--c-teal)",
};

function tierColor(tier) {
  return TIER_COLOR_MAP[tier] ?? "var(--c-text-3)";
}

function TierChip({ tier }) {
  const color = tierColor(tier);
  return (
    <span style={{
      fontFamily: f.mono, fontSize: 9, letterSpacing: "0.07em", fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}30`,
      borderRadius: 4, padding: "3px 7px", textTransform: "uppercase",
      whiteSpace: "nowrap", flexShrink: 0, display: "inline-block",
      maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {tier}
    </span>
  );
}

function PromiseBar({ made, kept }) {
  if (!made || made === 0) {
    return <span style={{ fontFamily: f.mono, fontSize: 12, color: "var(--c-text-3)" }}>No history</span>;
  }
  const pct = Math.round((kept / made) * 100);
  const color = pct === 100 ? "var(--c-tier1)" : pct >= 50 ? "var(--c-tier2)" : "var(--c-tier3)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, color }}>
          {kept}/{made} kept
        </span>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, background: "var(--c-surface-3)", borderRadius: 2, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: "100%", background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

export default function Clients() {
  const { loops } = useApp();

  const clientList = Object.values(CLIENTS).map((client) => {
    const openLoops = loops.filter((l) => l.client_id === client.client_id);
    const totalOpen = openLoops.reduce((s, l) => s + (l.amount || 0), 0);
    return { ...client, openLoops, totalOpen };
  });

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.12em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>
          CLIENTS
        </div>
        <h1 style={{ fontFamily: f.display, fontSize: 26, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Relationship Memory
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 5, lineHeight: 1.5 }}>
          What the agent knows about each client's payment behaviour, reliability, and current exposure.
        </p>
      </motion.div>

      {/* Client grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
        {clientList.map((client, i) => (
          <motion.div
            key={client.client_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "var(--c-surface)",
              border: `1px solid ${client.openLoops.length > 0 ? "var(--c-border-bright)" : "var(--c-border)"}`,
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Card header */}
            <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--c-border)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: f.body, fontWeight: 700, fontSize: 14, color: "var(--c-text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3,
                  }}>
                    {client.name}
                  </div>
                  <div style={{
                    fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2,
                  }}>
                    {client.email}
                  </div>
                  {/* Phone — optional */}
                  {client.phone && (
                    <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)" }}>
                      {client.phone}
                    </div>
                  )}
                </div>
                <TierChip tier={client.relationship_tier} />
              </div>
              {/* Location + currency row */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {client.city && (
                  <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.05em" }}>
                    📍 {client.city}{client.country ? `, ${client.country}` : ""}
                  </span>
                )}
                {client.currency && (
                  <span style={{
                    fontFamily: f.mono, fontSize: 9, color: "var(--c-teal)",
                    background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.15)",
                    borderRadius: 4, padding: "1px 5px", letterSpacing: "0.06em",
                  }}>
                    {client.currency}
                  </span>
                )}
                {client.preferred_channel && (
                  <span style={{
                    fontFamily: f.mono, fontSize: 9, color: "var(--c-text-2)",
                    background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                    borderRadius: 4, padding: "1px 5px", letterSpacing: "0.05em",
                  }}>
                    via {client.preferred_channel}
                  </span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                {/* Promise rate */}
                <div>
                  <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>
                    Promise Rate
                  </div>
                  <PromiseBar made={client.promises_made} kept={client.promises_kept} />
                </div>
                {/* Avg days */}
                <div>
                  <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>
                    Avg Days to Pay
                  </div>
                  <span style={{ fontFamily: f.mono, fontSize: 16, fontWeight: 700, color: client.avg_days_to_pay ? "var(--c-text)" : "var(--c-text-3)" }}>
                    {client.avg_days_to_pay ? `${client.avg_days_to_pay}d` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {client.notes && (
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--c-border)", flex: 1 }}>
                <div style={{
                  fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.6,
                  fontStyle: "italic",
                }}>
                  "{client.notes}"
                </div>
              </div>
            )}

            {/* Open invoices */}
            <div style={{ padding: "12px 18px" }}>
              {client.openLoops.length > 0 ? (
                <div>
                  <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
                    Open Invoices — {formatCurrency(client.totalOpen)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {client.openLoops.map((l) => (
                      <div key={l.loop_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-2)" }}>{l.invoice_number}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text)" }}>{formatCurrency(l.amount)}</span>
                          {l.days_overdue > 0 && (
                            <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-tier3)", background: "var(--c-tier3-bg)", border: "1px solid var(--c-tier3-border)", borderRadius: 4, padding: "2px 5px" }}>
                              {l.days_overdue}d
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-tier1)", display: "inline-block" }} />
                  <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-tier1)" }}>No open invoices</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
