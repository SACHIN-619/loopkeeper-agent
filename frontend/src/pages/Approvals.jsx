/**
 * Approvals.jsx — Dedicated Tier-2 approval queue.
 * Only shows loops that have a draft held for review.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useApp } from "../contexts/AppContext.js";
import ActionPanel from "../components/ActionPanel.jsx";
import EvidenceInjector from "../components/EvidenceInjector.jsx";
import Stamp from "../components/Stamp.jsx";
import { f, formatCurrency } from "../theme/tokens.js";
import { CLIENTS } from "../data/mockData.js";


function EmptyApprovals() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 16 }}
    >
      <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle2 size={30} color="var(--c-teal)" strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: f.display, fontSize: 20, fontWeight: 500, color: "var(--c-text)", marginBottom: 8 }}>No pending approvals</div>
        <div style={{ fontFamily: f.body, fontSize: 14, color: "var(--c-text-2)" }}>The agent is handling everything within its authority.</div>
      </div>
    </motion.div>
  );
}

export default function Approvals() {
  const { loops, isFallback, localApprovals = {}, onActionCompleted } = useApp();

  // Only Tier-2 loops with a draft that aren't approved
  const pending = loops.filter((l) => {
    if (l.tier !== 2 || !l.draft || l.approved) return false;
    if (localApprovals[l.loop_id]) return false;
    if (sessionStorage.getItem(`approved_${l.loop_id}`) === "true") return false;
    return true;
  });

  return (
    <div style={{ padding: "32px 32px 60px", maxWidth: 900, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>APPROVALS</div>
        <h1 style={{ fontFamily: f.display, fontSize: 28, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Held for your OK
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 14, color: "var(--c-text-2)", marginTop: 6 }}>
          These emails are drafted and ready — the agent is waiting on you.
        </p>
      </motion.div>

      {pending.length === 0 ? (
        <EmptyApprovals />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AnimatePresence>
            {pending.map((loop, i) => {
              const client = CLIENTS[loop.client_id] || { name: loop.client_name || "Unknown" };
              return (
                <motion.div
                  key={loop.loop_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-tier2-border)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {/* Loop header */}
                  <div style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--c-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}>
                    <div>
                      <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 15, color: "var(--c-text)" }}>{client.name}</div>
                      <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                        {loop.invoice_number} · {loop.days_overdue > 0 ? `${loop.days_overdue}d overdue` : "due today"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: f.display, fontSize: 18, fontWeight: 500, color: "var(--c-text)" }}>
                        {formatCurrency(loop.amount)}
                      </span>
                      <Stamp loop={loop} />
                    </div>
                  </div>

                  {/* Action panel */}
                  <div style={{ padding: "16px 20px" }}>
                    <ActionPanel loop={loop} isFallback={isFallback} onActionCompleted={onActionCompleted} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Evidence Injector (Sandbox / Fallback Mode) */}
      {isFallback && <EvidenceInjector loops={loops} />}
    </div>
  );
}
