/**
 * Clients.jsx — Client relationship memory page.
 * Dynamically derives clients from active loops for real users.
 * In Demo Mode, uses MOCK CLIENTS. In Real Mode, shows true user client memory or clean empty state.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useApp } from "../contexts/AppContext.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { CLIENTS } from "../data/mockData.js";
import { f, formatCurrency } from "../theme/tokens.js";
import { Plus, Users, ArrowRight, ShieldCheck } from "lucide-react";

// Color lookup driven by tier string
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
  const color = tierColor(tier || "new client");
  return (
    <span style={{
      fontFamily: f.mono, fontSize: 9, letterSpacing: "0.07em", fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}30`,
      borderRadius: 4, padding: "3px 7px", textTransform: "uppercase",
      whiteSpace: "nowrap", flexShrink: 0, display: "inline-block",
      maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {tier || "NEW CLIENT"}
    </span>
  );
}

function PromiseBar({ made, kept }) {
  if (!made || made === 0) {
    return <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>No promise history yet</span>;
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
  const { loops, resolvedLoops, loadSampleDataset } = useApp();
  const { isDemoMode } = useAuth();

  // Determine client list source
  const clientList = (() => {
    if (isDemoMode) {
      return Object.values(CLIENTS).map((client) => {
        const openLoops = loops.filter((l) => l.client_id === client.client_id);
        const totalOpen = openLoops.reduce((s, l) => s + (l.amount || 0), 0);
        return { ...client, openLoops, totalOpen };
      });
    }

    // Real Authenticated User: Extract client profiles from actual user loops
    const map = {};
    [...loops, ...resolvedLoops].forEach((loop) => {
      const cid = loop.client_id || loop.client_name || "unknown";
      if (!map[cid]) {
        map[cid] = {
          client_id: cid,
          name: loop.client_name || CLIENTS[cid]?.name || "Client",
          tier: CLIENTS[cid]?.tier || "new client",
          currency: loop.currency || "USD",
          promises_made: loop.promises_made || 0,
          promises_kept: loop.promises_kept || 0,
          contact_email: loop.contact_email || loop.client_email || "",
          contact_phone: loop.contact_phone || "",
        };
      }
    });

    return Object.values(map).map((client) => {
      const openLoops = loops.filter((l) => (l.client_id === client.client_id || l.client_name === client.name));
      const totalOpen = openLoops.reduce((s, l) => s + (l.amount || 0), 0);
      return { ...client, openLoops, totalOpen };
    });
  })();

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

      {/* Client list or empty state */}
      {clientList.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14,
            padding: "60px 24px", textAlign: "center", maxWidth: 520, margin: "20px auto 0",
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Users size={26} color="var(--c-teal)" />
          </div>
          <div style={{ fontFamily: f.display, fontSize: 20, fontWeight: 600, color: "var(--c-text)", marginBottom: 8 }}>
            No Clients Tracked Yet
          </div>
          <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.6, marginBottom: 24 }}>
            Client relationship profiles are automatically created and tracked in memory as soon as you add your first invoice.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              to="/app/add"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: 8,
                background: "var(--c-teal)", color: "var(--c-text-inv)",
                fontFamily: f.body, fontWeight: 600, fontSize: 13, textDecoration: "none",
              }}
            >
              <Plus size={14} /> Add First Invoice
            </Link>
            <button
              onClick={loadSampleDataset}
              style={{
                padding: "10px 18px", borderRadius: 8,
                background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                color: "var(--c-text-2)", fontFamily: f.mono, fontSize: 11, cursor: "pointer",
              }}
            >
              Load Demo Scenarios
            </button>
          </div>
        </motion.div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
          {clientList.map((client, i) => (
            <motion.div
              key={client.client_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: 12, padding: "18px 20px",
                display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 16, color: "var(--c-text)" }}>
                    {client.name}
                  </div>
                  <TierChip tier={client.tier} />
                </div>

                <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginBottom: 14 }}>
                  {client.contact_email || "No email listed"}
                  {client.contact_phone && <span> · {client.contact_phone}</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 12px", background: "var(--c-surface-2)", borderRadius: 8, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.06em", marginBottom: 2 }}>OPEN LOOPS</div>
                    <div style={{ fontFamily: f.display, fontSize: 15, fontWeight: 600, color: "var(--c-text)" }}>{client.openLoops.length}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.06em", marginBottom: 2 }}>TOTAL EXPOSURE</div>
                    <div style={{ fontFamily: f.display, fontSize: 15, fontWeight: 600, color: client.totalOpen > 0 ? "var(--c-teal)" : "var(--c-text-3)" }}>
                      {formatCurrency(client.totalOpen, client.currency)}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.06em", marginBottom: 6 }}>PROMISE RELIABILITY</div>
                  <PromiseBar made={client.promises_made} kept={client.promises_kept} />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <Link
                  to="/app/loops"
                  style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                >
                  View open loops <ArrowRight size={11} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
