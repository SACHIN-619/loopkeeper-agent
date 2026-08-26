/**
 * LoopTreeView.jsx — Interactive Tree / Flow Node Diagram for Open Loops.
 * Renders invoices as visual node cards connected with flowing pipeline threads:
 * Overdue Invoice ──> Agent Reasoning ──> Authority Action ──> Evidence & Promise ──> Verified Resolution
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Bot, CheckCircle2, ShieldCheck,
  Clock, Sparkles, ChevronRight, ArrowRight
} from "lucide-react";
import { f, formatCurrency, displayTier, TIER_META } from "../theme/tokens.js";
import { CLIENTS } from "../data/mockData.js";
import Stamp from "./Stamp.jsx";

const STAGES = [
  { id: "detected",  title: "1. INVOICES",           subtitle: "Overdue & Ingested",  icon: FileText,    color: "var(--c-tier2)" },
  { id: "reasoning", title: "2. REASONING",          subtitle: "Priority & Policy",   icon: Bot,         color: "var(--c-teal)" },
  { id: "action",    title: "3. AUTHORITY ACTION",   subtitle: "Tier 1/2/3 Decision", icon: Clock,       color: "var(--c-tier1)" },
  { id: "evidence",  title: "4. EVIDENCE & PROMISE", subtitle: "Monitoring Replies",  icon: Sparkles,    color: "var(--c-tier2)" },
  { id: "resolved",  title: "5. VERIFIED CLOSED",    subtitle: "Closed Loops",        icon: ShieldCheck, color: "var(--c-resolved)" },
];

export default function LoopTreeView({ loops = [], resolvedLoops = [], onSelectLoop }) {
  // Group loops by their stage in the workflow tree
  const stageMap = {
    detected:  loops.filter(l => l.days_overdue > 0 && !l.draft && l.tier === 1),
    reasoning: loops.filter(l => l.priority_score > 0),
    action:    loops.filter(l => l.draft || l.tier === 2 || l.tier === 3),
    evidence:  loops.filter(l => l.exception_type === "promise_pending" || l.unread_reply),
    resolved:  resolvedLoops,
  };

  return (
    <div style={{ position: "relative", overflowX: "auto", paddingBottom: 20 }}>

      {/* SVG Connecting Thread Lines Header */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        {/* Stages Header Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(200px, 1fr))", gap: 20, position: "relative", zIndex: 2 }}>
          {STAGES.map((st, idx) => {
            const count = (stageMap[st.id] || []).length;
            return (
              <div
                key={st.id}
                style={{
                  background: "var(--c-surface)",
                  border: `1px solid ${count > 0 ? st.color : "var(--c-border)"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  boxShadow: count > 0 ? `0 0 16px ${st.color}20` : "none",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: `${st.color}18`, border: `1px solid ${st.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <st.icon size={14} color={st.color} />
                  </div>
                  <div>
                    <div style={{ fontFamily: f.mono, fontSize: 10, fontWeight: 700, color: "var(--c-text)", letterSpacing: "0.06em" }}>
                      {st.title}
                    </div>
                    <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-text-3)" }}>
                      {st.subtitle}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontFamily: f.mono, fontSize: 12, fontWeight: 700, color: st.color,
                    background: "var(--c-surface-2)", borderRadius: 10, padding: "2px 8px",
                  }}>
                    {count}
                  </span>
                  {idx < STAGES.length - 1 && (
                    <ChevronRight size={14} color="var(--c-teal)" style={{ marginLeft: 2 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connecting Flow Thread Line Bar */}
      <div style={{
        height: 4,
        background: "linear-gradient(90deg, var(--c-tier2) 0%, var(--c-teal) 25%, var(--c-tier1) 50%, var(--c-tier2) 75%, var(--c-resolved) 100%)",
        borderRadius: 2,
        marginBottom: 20,
        opacity: 0.8,
        boxShadow: "0 0 12px rgba(0,212,170,0.4)",
      }} />

      {/* Tree Flow Columns Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(200px, 1fr))", gap: 20, alignItems: "start" }}>
        {STAGES.map((st, colIdx) => {
          const items = stageMap[st.id] || [];

          return (
            <div
              key={st.id}
              style={{
                background: "var(--c-surface-2)",
                border: "1px solid var(--c-border)",
                borderRadius: 12,
                padding: 12,
                minHeight: 300,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "relative",
              }}
            >
              {items.length === 0 ? (
                <div style={{
                  padding: "60px 12px", textAlign: "center",
                  color: "var(--c-text-3)", fontFamily: f.mono, fontSize: 11,
                }}>
                  Empty stage
                </div>
              ) : (
                items.map((loop, i) => {
                  const client = CLIENTS[loop.client_id] || { name: loop.client_name || "Unknown" };
                  const tier = displayTier(loop);
                  const meta = TIER_META[tier] ?? TIER_META.watching;

                  return (
                    <motion.div
                      key={loop.loop_id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => onSelectLoop && onSelectLoop(loop.loop_id)}
                      title={`Click to inspect ${loop.invoice_number} · Priority Score: ${loop.priority_score || 0}`}
                      style={{
                        background: "var(--c-surface)",
                        border: `1px solid ${meta.border}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Top Checkmark / Status badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: meta.bg, border: `1px solid ${meta.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <CheckCircle2 size={12} color={meta.color} />
                        </div>
                        <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-teal)", fontWeight: 600 }}>
                          Score: {loop.priority_score || 0}
                        </span>
                      </div>

                      {/* Client + Invoice */}
                      <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {client.name}
                      </div>
                      <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
                        {loop.invoice_number}
                        {loop.days_overdue > 0 && <span style={{ color: "var(--c-tier3)", marginLeft: 4 }}>· {loop.days_overdue}d</span>}
                      </div>

                      {/* Amount & Stamp */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--c-border)" }}>
                        <span style={{ fontFamily: f.display, fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
                          {formatCurrency(loop.amount)}
                        </span>
                        <Stamp loop={loop} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
