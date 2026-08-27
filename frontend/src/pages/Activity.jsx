/**
 * Activity.jsx — Chronological event feed across all loops.
 * Aggregates history[] from every loop into a single timeline.
 * Supports segmented tabs to view timeline feed vs background Agent Runs logs.
 */
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, MessageSquare, AlertTriangle, ShieldCheck, Split, Bot, Circle, ChevronDown, ChevronUp, Clock, UserCheck, CheckCircle, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../contexts/AppContext.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { CLIENTS, AGENT_RUNS } from "../data/mockData.js";
import { f } from "../theme/tokens.js";

function getIcon(text) {
  const t = String(text).toLowerCase();
  if (t.includes("[email]") || t.includes("reminder") || t.includes("invoice sent")) return { icon: Mail, color: "var(--c-teal)" };
  if (t.includes("[incoming reply]") || t.includes("client replied")) return { icon: MessageSquare, color: "var(--c-tier2)" };
  if (t.includes("split")) return { icon: Split, color: "var(--c-tier1)" };
  if (t.includes("dispute") || t.includes("escalat")) return { icon: AlertTriangle, color: "var(--c-tier3)" };
  if (t.includes("verified") || t.includes("closed")) return { icon: ShieldCheck, color: "var(--c-resolved)" };
  if (t.includes("agent") || t.includes("plan") || t.includes("promise")) return { icon: Bot, color: "var(--c-teal-dim)" };
  return { icon: Circle, color: "var(--c-text-3)" };
}


/* ── Collapsible Agent Run Card ── */
function RunCard({ run, index }) {
  const [expanded, setExpanded] = useState(false);
  const started = new Date(run.started_at);

  const triggerLabel = {
    scheduler: "Cloud Scheduler",
    manual: "Manual Trigger",
    gmail_event: "Gmail Event",
    demo: "Simulation Injection",
  }[run.trigger] || run.trigger;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      style={{
        background: "var(--c-surface)",
        border: `1px solid ${run.status === "failed" ? "rgba(239, 68, 68, 0.4)" : "var(--c-border-bright)"}`,
        borderRadius: 10,
        marginBottom: 14,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header Summary (Click to Toggle) */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: "16px 18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          userSelect: "none",
          background: expanded ? "rgba(0,212,170,0.04)" : "transparent",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: f.mono, fontSize: 12, fontWeight: 700,
              color: run.status === "failed" ? "var(--c-tier3)" : "var(--c-text)",
            }}>
              RUN #{run.run_id}
            </span>
            <span style={{
              fontFamily: f.mono, fontSize: 9, fontWeight: 600,
              background: "var(--c-surface-2)", border: "1px solid var(--c-border-bright)",
              borderRadius: 4, padding: "2px 6px", color: "var(--c-teal)",
            }}>
              {triggerLabel}
            </span>
            {run.status === "failed" && (
              <span style={{
                fontFamily: f.mono, fontSize: 9, fontWeight: 600,
                background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 4, padding: "2px 6px", color: "var(--c-tier3)",
              }}>
                FAILED
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-2)" }}>
              {started.toLocaleDateString()} {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span style={{ color: "var(--c-border-bright)" }}>·</span>
            <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-2)" }}>
              {(run.duration_ms / 1000).toFixed(1)}s duration
            </span>
          </div>
        </div>

        {/* Collapsible toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Quick Stats Pillbox */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            {run.loops_scanned > 0 && (
              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-2)" }}>
                <span style={{ color: "var(--c-text)", fontWeight: 700 }}>{run.loops_scanned}</span> scanned
              </div>
            )}
            {run.plans_changed > 0 && (
              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-tier2)" }}>
                <span style={{ fontWeight: 700 }}>{run.plans_changed}</span> replans
              </div>
            )}
            {run.emails_sent > 0 && (
              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)" }}>
                <span style={{ fontWeight: 700 }}>{run.emails_sent}</span> sent
              </div>
            )}
            {run.approvals_created > 0 && (
              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-tier2)" }}>
                <span style={{ fontWeight: 700 }}>{run.approvals_created}</span> drafts
              </div>
            )}
            {run.resolved > 0 && (
              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-resolved)" }}>
                <span style={{ fontWeight: 700 }}>{run.resolved}</span> resolved
              </div>
            )}
          </div>
          {expanded ? <ChevronUp size={15} color="var(--c-teal)" /> : <ChevronDown size={15} color="var(--c-text-2)" />}
        </div>
      </div>

      {/* Expanded Decisions Table */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              borderTop: "1px solid var(--c-border-bright)",
              background: "var(--c-surface-2)",
              padding: "16px 18px",
            }}
          >
            {run.error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                fontFamily: f.body, fontSize: 13, color: "var(--c-tier3)", lineHeight: 1.5,
              }}>
                <strong>Error details:</strong> {run.error}
              </div>
            )}

            <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-2)", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
              DECISIONS MADE ({run.decisions?.length || 0})
            </div>

            {(!run.decisions || run.decisions.length === 0) ? (
              <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-3)", padding: "10px 0" }}>
                No active decisions made (all loops within normal bounds / no replies).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {run.decisions.map((dec, idx) => {
                  const label = dec.loop_id ? `${dec.loop_id.toUpperCase()}` : "SYSTEM";
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border-bright)",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-teal)", fontWeight: 700 }}>{label}</span>
                          {dec.tool && (
                            <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-2)" }}>
                              via {dec.tool}()
                            </span>
                          )}
                        </div>
                        {dec.authority && (
                          <span style={{
                            fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                            padding: "2px 6px", borderRadius: 4,
                            background: dec.authority === "tier_1" ? "rgba(0,212,170,0.1)" : dec.authority === "tier_2" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${dec.authority === "tier_1" ? "rgba(0,212,170,0.3)" : dec.authority === "tier_2" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: dec.authority === "tier_1" ? "var(--c-teal)" : dec.authority === "tier_2" ? "var(--c-tier2)" : "var(--c-tier3)",
                          }}>
                            {dec.authority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text)", lineHeight: 1.5 }}>
                        {dec.observed || dec.summary}
                      </div>
                      {dec.reasoning_summary && (
                        <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", fontStyle: "italic", borderLeft: "2px solid var(--c-teal)", paddingLeft: 10, marginTop: 4 }}>
                          {dec.reasoning_summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Activity() {
  const { loops, resolvedLoops, loadSampleDataset } = useApp();
  const { isDemoMode } = useAuth();
  const [tab, setTab] = useState("timeline"); // "timeline" | "runs"
  const [runLog, setRunLog] = useState(isDemoMode ? AGENT_RUNS : []);
  const [sandbox, setSandbox] = useState(true);

  // Try to load runs from live backend
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_CLOUD_RUN_URL || "http://localhost:8080";
    fetch(`${backendUrl}/agent/runs?limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setRunLog(data);
          setSandbox(false);
        } else if (isDemoMode) {
          setRunLog(AGENT_RUNS);
        }
      })
      .catch(() => {
        if (isDemoMode) setRunLog(AGENT_RUNS);
      });
  }, [isDemoMode]);

  // Aggregate all history events from all loops
  const events = useMemo(() => {
    const all = [];
    const allLoops = [...loops, ...resolvedLoops];

    allLoops.forEach((loop) => {
      const client = CLIENTS[loop.client_id] || { name: loop.client_name || "Unknown" };
      (loop.history || []).forEach((h) => {
        const event = typeof h === "string" ? h : h.event || "";
        const date  = typeof h === "object" ? h.date : null;
        all.push({
          loop_id: loop.loop_id,
          invoice_number: loop.invoice_number || loop.loop_id,
          client_name: client.name,
          event,
          date,
          tier: loop.tier,
          amount: loop.amount,
        });
      });
    });

    const stringifyDate = (d) => {
      if (!d) return "";
      if (typeof d === "string") return d;
      if (typeof d?.toDate === "function") return d.toDate().toISOString();
      if (d?.seconds) return new Date(d.seconds * 1000).toISOString();
      return String(d);
    };

    return all.sort((a, b) => {
      const dA = stringifyDate(a.date);
      const dB = stringifyDate(b.date);
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return dB.localeCompare(dA);
    });
  }, [loops, resolvedLoops]);

  return (
    <div style={{ padding: "32px 32px 60px", maxWidth: 820, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>ACTIVITY FEED</div>
        <h1 style={{ fontFamily: f.display, fontSize: 28, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Agent Activity
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 14, color: "var(--c-text-2)", marginTop: 6 }}>
          Every action, reply, and background execution log across LoopKeeper.
        </p>
      </motion.div>

      {/* Segmented Tab Control */}
      <div style={{ display: "flex", background: "var(--c-surface-2)", borderRadius: 9, padding: 3, marginBottom: 24, maxWidth: 320 }}>
        {[
          { id: "timeline", label: "Timeline feed" },
          { id: "runs",     label: "Agent runs log" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 7,
              background: tab === t.id ? "var(--c-surface-3)" : "transparent",
              border: "none", cursor: "pointer",
              fontFamily: f.body, fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "var(--c-text)" : "var(--c-text-3)",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timeline" ? (
        events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--c-text-3)", fontFamily: f.body }}>
            No activity yet.
          </div>
        ) : (
          <div style={{ position: "relative", paddingLeft: 28 }}>
            {/* Vertical spine */}
            <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 1, background: "var(--c-border)" }} />

            {events.map((ev, i) => {
              const { icon: Icon, color } = getIcon(ev.event);
              const isReply = ev.event.toLowerCase().includes("[incoming reply]") || ev.event.toLowerCase().includes("client replied");

              return (
                <motion.div
                  key={`${ev.loop_id}-${i}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  style={{
                    position: "relative",
                    marginBottom: 16,
                  }}
                >
                  {/* Dot */}
                  <div style={{
                    position: "absolute",
                    left: -28,
                    top: 3,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: isReply ? `${color}20` : "var(--c-surface-2)",
                    border: `1px solid ${isReply ? color : "var(--c-border-bright)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1,
                  }}>
                    <Icon size={8} color={color} />
                  </div>

                  <div style={{
                    background: "var(--c-surface)",
                    border: `1px solid ${isReply ? "var(--c-border-bright)" : "var(--c-border)"}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                      <span style={{ fontFamily: f.body, fontSize: 13, color: isReply ? "var(--c-teal)" : "var(--c-text)", lineHeight: 1.5 }}>
                        {ev.event.replace(/\[INCOMING REPLY\]\s*/i, "")}
                      </span>
                      {ev.date && (
                        <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", flexShrink: 0, marginTop: 2 }}>
                          {ev.date}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)" }}>
                        {ev.client_name}
                      </span>
                      <span style={{ color: "var(--c-border)" }}>·</span>
                      <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)" }}>
                        {ev.invoice_number}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* Agent Runs Tab */
        <div>
          {isDemoMode ? (
            <div style={{
              background: "rgba(0, 212, 170, 0.08)", border: "1px solid rgba(0, 212, 170, 0.25)",
              padding: "12px 16px", borderRadius: 10, marginBottom: 18,
              fontFamily: f.body, fontSize: 13, color: "var(--c-teal)", lineHeight: 1.5,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <strong>Demo Simulation Mode:</strong> Viewing sample agent execution scenarios. Switch to your live account to stream real background execution logs.
              </div>
            </div>
          ) : sandbox && (
            <div style={{
              background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)",
              padding: "12px 16px", borderRadius: 10, marginBottom: 18,
              fontFamily: f.body, fontSize: 13, color: "var(--c-tier2)", lineHeight: 1.5,
            }}>
              <strong>Live Execution Stream:</strong> Background execution logs will stream here automatically whenever your agent scans invoices or processes client email replies.
            </div>
          )}
          {runLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--c-text-3)", fontFamily: f.body }}>
              No agent runs logged yet.
            </div>
          ) : (
            runLog.map((run, i) => (
              <RunCard key={run.run_id || i} run={run} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

