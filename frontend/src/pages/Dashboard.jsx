/**
 * Dashboard.jsx — Command Center overview.
 * Shows: Agent Status Panel, "While You Were Away", resolution donut chart,
 * priority loops, and recent agent activity feed.
 */
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Inbox, Bot, CheckCircle2, AlertTriangle, ArrowRight,
  Wifi, WifiOff, Clock, Mail, MessageSquare, Smartphone, RefreshCw,
} from "lucide-react";
import { useApp } from "../contexts/AppContext.js";
import MetricCard from "../components/MetricCard.jsx";
import Stamp from "../components/Stamp.jsx";
import { f, formatCurrency } from "../theme/tokens.js";
import { CLIENTS, AGENT_STATUS } from "../data/mockData.js";
import { priorityScore } from "../data/priorityLogic.js";

/* ── Trigger badge styles ────────────────────────────────────── */
const TRIGGER_STYLE = {
  scheduler:   { label: "Scheduler",   color: "var(--c-teal)" },
  manual:      { label: "Manual",      color: "var(--c-text-3)" },
  gmail_event: { label: "Gmail Event", color: "#4285F4" },
  demo:        { label: "Demo",        color: "var(--c-tier2)" },
};

/* ── Resolution Donut Chart (pure SVG, no dependency) ──────── */
function ResolutionDonut({ open, resolved, needsApproval, escalated }) {
  const total = open + resolved;
  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>No invoices yet</span>
      </div>
    );
  }

  const size = 110;
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  // Segments: resolved, agent (autonomous), needs-approval, escalated, other open
  const autonomous = Math.max(0, open - needsApproval - escalated);
  const segments = [
    { value: resolved,      color: "var(--c-resolved)",  label: "Resolved" },
    { value: autonomous,    color: "var(--c-teal)",       label: "Agent handling" },
    { value: needsApproval, color: "var(--c-tier2)",      label: "Approval" },
    { value: escalated,     color: "var(--c-tier3)",      label: "Escalated" },
  ].filter(s => s.value > 0);

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const arc = { ...seg, dash, offset, pct };
    offset += dash;
    return arc;
  });

  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={12} />
          {/* Segments */}
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={12}
              strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        {/* Center label */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: f.display, fontSize: 20, fontWeight: 700, color: "var(--c-text)", lineHeight: 1 }}>
            {resolvedPct}%
          </span>
          <span style={{ fontFamily: f.mono, fontSize: 8, color: "var(--c-text-3)", letterSpacing: "0.06em", marginTop: 2 }}>
            RESOLVED
          </span>
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, width: "100%" }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: arc.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)" }}>{arc.label}</span>
            </div>
            <span style={{ fontFamily: f.display, fontSize: 12, fontWeight: 600, color: "var(--c-text-2)" }}>{arc.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── While You Were Away panel ───────────────────────────────── */
function WhileYouWereAway({ lastRun }) {
  if (!lastRun) return null;

  const total = (lastRun.gmail_replies_ingested || 0)
    + (lastRun.plans_changed || 0)
    + (lastRun.emails_sent || 0)
    + (lastRun.resolved || 0)
    + (lastRun.approvals_created || 0);

  if (total === 0) return null;

  const items = [
    { val: lastRun.gmail_replies_ingested, label: "Gmail replies ingested",   icon: Mail,           color: "#4285F4" },
    { val: lastRun.plans_changed,          label: "strategies replanned",     icon: RefreshCw,      color: "var(--c-tier2)" },
    { val: lastRun.emails_sent,            label: "follow-ups sent",          icon: MessageSquare,  color: "var(--c-teal)" },
    { val: lastRun.approvals_created,      label: "approvals created",        icon: CheckCircle2,   color: "var(--c-tier2)" },
    { val: lastRun.resolved,               label: "invoices resolved",        icon: CheckCircle2,   color: "var(--c-resolved)" },
  ].filter(x => x.val > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      style={{
        background: "linear-gradient(135deg, rgba(0,212,170,0.04) 0%, rgba(0,212,170,0.01) 100%)",
        border: "1px solid rgba(0,212,170,0.2)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 700, marginBottom: 10 }}>
        ● WHILE YOU WERE AWAY
      </div>
      <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginBottom: 12, lineHeight: 1.5 }}>
        LoopKeeper worked in the background during the last agent cycle.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
        {items.map(({ val, label, icon: Icon, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon size={12} color={color} />
            <span style={{ fontFamily: f.display, fontSize: 14, fontWeight: 700, color }}>{val}</span>
            <span style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)" }}>{label}</span>
          </div>
        ))}
      </div>
      {lastRun.gmail_error && (
        <div style={{ marginTop: 10, fontFamily: f.mono, fontSize: 10, color: "var(--c-tier3)", opacity: 0.7 }}>
          ⚠ Gmail: {lastRun.gmail_error.slice(0, 80)}
        </div>
      )}
    </motion.div>
  );
}

/* ── Channel source indicator ────────────────────────────────── */
function ChannelDot({ label, connected, icon: Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {connected ? <Icon size={11} color="var(--c-teal)" /> : <Icon size={11} color="var(--c-text-3)" />}
      <span style={{
        fontFamily: f.mono, fontSize: 9,
        color: connected ? "var(--c-text-2)" : "var(--c-text-3)",
        letterSpacing: "0.06em",
      }}>
        {label}
      </span>
    </div>
  );
}

/* ── Agent Status Panel ──────────────────────────────────────── */
function AgentStatusPanel({ status }) {
  const lastRun = status?.last_run;
  const isStale = status?.stale;
  const isSandbox = status?.sandbox;
  const sources = status?.sources || {};

  const timeSince = (() => {
    if (!lastRun?.completed_at) return null;
    try {
      const ms = Date.now() - new Date(lastRun.completed_at).getTime();
      const m  = Math.floor(ms / 60000);
      const h  = Math.floor(m / 60);
      if (h > 0) return `${h}h ${m % 60}m ago`;
      if (m > 0) return `${m}m ago`;
      return "just now";
    } catch { return null; }
  })();

  // Next run estimate: 60 min from last run
  const nextRun = (() => {
    if (!lastRun?.completed_at) return null;
    try {
      const next = new Date(new Date(lastRun.completed_at).getTime() + 60 * 60 * 1000);
      return next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  })();

  const trigInfo = TRIGGER_STYLE[lastRun?.trigger] || TRIGGER_STYLE.manual;

  // Determine status label: sandbox overrides everything
  const statusLabel = isSandbox ? "SANDBOX" : isStale ? "AGENT STALE" : "AGENT ACTIVE";
  const statusColor = isSandbox ? "var(--c-text-3)" : isStale ? "var(--c-tier3)" : "var(--c-teal)";
  const dotGlow = (!isSandbox && !isStale) ? "0 0 8px var(--c-teal)" : "none";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      style={{
        background: "var(--c-surface)",
        border: `1px solid ${isStale && !isSandbox ? "rgba(239,68,68,0.3)" : "var(--c-border)"}`,
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: statusColor, boxShadow: dotGlow, display: "inline-block",
          }} />
          <span style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: statusColor }}>
            {statusLabel}
          </span>
          {isSandbox && (
            <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.08em" }}>
              local json mode
            </span>
          )}
        </div>
        <Link to="/app/activity" style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
          View runs <ArrowRight size={11} />
        </Link>
      </div>

      {/* Last run stats */}
      {lastRun ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 16px" }}>
          {/* Timing */}
          <div>
            <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 4 }}>LAST RUN</div>
            <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text)", fontWeight: 500 }}>
              {new Date(lastRun.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
              {timeSince}
            </div>
          </div>
          {/* Trigger + Duration */}
          <div>
            <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 4 }}>TRIGGER</div>
            <div style={{ fontFamily: f.mono, fontSize: 12, color: trigInfo.color }}>{trigInfo.label}</div>
            <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
              {(lastRun.duration_ms / 1000).toFixed(1)}s · {lastRun.loops_scanned} loops
            </div>
          </div>
          {/* Next run */}
          <div>
            <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 4 }}>NEXT RUN</div>
            <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text)", fontWeight: 500 }}>
              {nextRun || "—"}
            </div>
            <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
              Scheduled · 1 hour
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)" }}>No runs recorded yet.</div>
      )}

      {/* Last run action counts */}
      {lastRun && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
          {[
            { label: "scanned",   val: lastRun.loops_scanned,         color: "var(--c-text-2)" },
            { label: "replanned", val: lastRun.plans_changed,         color: "var(--c-tier2)" },
            { label: "sent",      val: lastRun.emails_sent,           color: "var(--c-teal)" },
            { label: "approvals", val: lastRun.approvals_created,     color: "var(--c-tier2)" },
            { label: "resolved",  val: lastRun.resolved,              color: "var(--c-resolved)" },
            { label: "gmail in",  val: lastRun.gmail_replies_ingested || 0, color: "#4285F4" },
            { label: "failed",    val: lastRun.failures,              color: lastRun.failures > 0 ? "var(--c-tier3)" : "var(--c-text-3)" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontFamily: f.display, fontSize: 15, fontWeight: 500, color }}>{val}</span>
              <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Channel health */}
      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        <ChannelDot label="Gmail"     connected={sources.gmail}             icon={Mail} />
        <ChannelDot label="SMS"       connected={sources.sms}               icon={Smartphone} />
        <ChannelDot label="WhatsApp"  connected={sources.whatsapp}          icon={MessageSquare} />
        <ChannelDot label="Firestore" connected={sources.firestore}         icon={Wifi} />
        <ChannelDot label="Policy"    connected={sources.policy !== false}  icon={CheckCircle2} />
      </div>
    </motion.div>
  );
}

/* ── Metric config ───────────────────────────────────────────── */
function buildMetrics(loops, resolvedLoops) {
  const totalOutstanding = loops.reduce((s, l) => s + (l.amount || 0), 0);
  return [
    { label: "Outstanding",    value: totalOutstanding,                                   unit: "$",          accent: "var(--c-teal)",    icon: DollarSign   },
    { label: "Open Loops",     value: loops.length,                                       unit: "invoices",   accent: "var(--c-text-2)",  icon: Inbox        },
    { label: "Agent Handling", value: loops.filter(l => l.tier === 1).length,             unit: "autonomous", accent: "var(--c-tier1)",   icon: Bot          },
    { label: "Need Approval",  value: loops.filter(l => l.tier === 2).length,             unit: "hold",       accent: "var(--c-tier2)",   icon: CheckCircle2 },
    { label: "Needs You",      value: loops.filter(l => l.tier === 3).length,             unit: "escalated",  accent: "var(--c-tier3)",   icon: AlertTriangle },
    { label: "Resolved",       value: resolvedLoops.length,                               unit: "closed",     accent: "var(--c-resolved)",icon: CheckCircle2 },
  ];
}

/* ── Channel icon for event feed ─────────────────────────────── */
function channelIcon(event) {
  const ev = (event || "").toLowerCase();
  if (ev.includes("[gmail]") || ev.includes("gmail")) return <Mail size={10} color="#4285F4" />;
  if (ev.includes("[sms]"))       return <Smartphone size={10} color="var(--c-tier2)" />;
  if (ev.includes("[whatsapp]"))  return <MessageSquare size={10} color="#25D366" />;
  return null;
}

/* ── Plan-changed badge ──────────────────────────────────────── */
function PlanChangedBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
      style={{
        fontFamily: f.mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
        color: "var(--c-tier2)", background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.25)", borderRadius: 4, padding: "1px 5px",
        whiteSpace: "nowrap",
      }}
    >
      PLAN CHANGED
    </motion.span>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────── */
export default function Dashboard() {
  const { loops, resolvedLoops, loading, isFallback } = useApp();
  const [agentStatus, setAgentStatus] = useState({ ...AGENT_STATUS, sandbox: true });

  // Fetch live agent status once from backend
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_CLOUD_RUN_URL;
    if (!backendUrl) return;
    fetch(`${backendUrl}/agent/status`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgentStatus({ ...data, sandbox: false }); })
      .catch(() => { /* backend not running — stay with mock */ });
  }, []);

  const metrics = useMemo(() => buildMetrics(loops, resolvedLoops), [loops, resolvedLoops]);

  const topLoops = useMemo(
    () => [...loops].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 4),
    [loops]
  );

  const recentEvents = useMemo(() => {
    const all = [];
    loops.forEach((loop) => {
      const client = CLIENTS[loop.client_id] || { name: loop.client_name || "Unknown" };
      (loop.history || []).forEach((h) => {
        const event = typeof h === "string" ? h : h.event || "";
        const date  = typeof h === "object" ? h.date : null;
        all.push({ event, date, invoice: loop.invoice_number, client: client.name, loop_id: loop.loop_id,
          planChanged: event.toLowerCase().includes("plan changed") || event.toLowerCase().includes("promise_broken"),
        });
      });
    });
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
  }, [loops]);

  // Resolution chart data
  const openCount      = loops.length;
  const resolvedCount  = resolvedLoops.length;
  const approvalCount  = loops.filter(l => l.tier === 2).length;
  const escalatedCount = loops.filter(l => l.tier === 3).length;

  const lastRun = agentStatus?.last_run;

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.12em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>
          COMMAND CENTER
        </div>
        <h1 style={{ fontFamily: f.display, fontSize: 26, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Overview
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 5, lineHeight: 1.5 }}>
          Agent status and financial summary across all tracked invoices.
        </p>
      </motion.div>

      {/* Agent Status Panel */}
      <AgentStatusPanel status={agentStatus} />

      {/* While You Were Away */}
      <WhileYouWereAway lastRun={lastRun} />

      {/* Metric grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 32 }}>
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} index={i} />
        ))}
      </div>

      {/* Three-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 260px", gap: 20, alignItems: "start" }}>

        {/* Col 1: Priority Loops */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600 }}>
              HIGHEST PRIORITY LOOPS
            </div>
            <Link to="/app/loops" style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)", display: "flex", alignItems: "center", gap: 4, letterSpacing: "0.06em" }}>
              View all <ArrowRight size={11} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              [0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 10 }} />)
            ) : topLoops.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--c-text-3)", fontFamily: f.body, fontSize: 14 }}>
                No open loops — all resolved ✓
              </div>
            ) : (
              topLoops.map((loop, i) => {
                const client = CLIENTS[loop.client_id] || { name: loop.client_name || "Unknown" };
                const hasPlanChange = loop.exception_type === "promise_broken";
                return (
                  <motion.div
                    key={loop.loop_id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    style={{
                      background: "var(--c-surface)",
                      border: `1px solid ${hasPlanChange ? "rgba(245,158,11,0.3)" : "var(--c-border)"}`,
                      borderRadius: 10, padding: "14px 16px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {client.name}
                        </div>
                        {hasPlanChange && <PlanChangedBadge />}
                      </div>
                      <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                        {loop.invoice_number}
                        {loop.days_overdue > 0 && <span style={{ color: "var(--c-tier3)", marginLeft: 6 }}>· {loop.days_overdue}d overdue</span>}
                        {loop.exception_type === "promise_pending"  && <span style={{ color: "var(--c-tier2)", marginLeft: 6 }}>· promise pending</span>}
                        {loop.exception_type === "promise_broken"   && <span style={{ color: "var(--c-tier3)", marginLeft: 6 }}>· promise broken</span>}
                        {loop.exception_type === "disputed"         && <span style={{ color: "var(--c-tier3)", marginLeft: 6 }}>· disputed</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ fontFamily: f.display, fontSize: 15, fontWeight: 500, color: "var(--c-text)" }}>
                        {formatCurrency(loop.amount)}
                      </span>
                      <Stamp loop={loop} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {topLoops.length > 0 && (
            <Link
              to="/app/loops"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginTop: 12, padding: "10px",
                background: "var(--c-surface)", border: "1px dashed var(--c-border)", borderRadius: 10,
                fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", letterSpacing: "0.08em",
              }}
            >
              VIEW ALL OPEN LOOPS <ArrowRight size={11} />
            </Link>
          )}
        </div>

        {/* Col 2: Resolution Donut */}
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 14 }}>
            RESOLUTION STATUS
          </div>
          <div style={{
            background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12,
            padding: "20px 16px",
          }}>
            <ResolutionDonut
              open={openCount}
              resolved={resolvedCount}
              needsApproval={approvalCount}
              escalated={escalatedCount}
            />
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-border)", textAlign: "center" }}>
              <div style={{ fontFamily: f.display, fontSize: 20, fontWeight: 700, color: "var(--c-text)" }}>
                {openCount + resolvedCount}
              </div>
              <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em" }}>
                TOTAL INVOICES
              </div>
            </div>
          </div>
        </div>

        {/* Col 3: Agent Activity Feed */}
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 14 }}>
            AGENT ACTIVITY
          </div>
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, overflow: "hidden" }}>
            {recentEvents.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--c-text-3)", fontFamily: f.body, fontSize: 13 }}>
                No events yet.
              </div>
            ) : (
              recentEvents.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    padding: "11px 14px",
                    borderBottom: i < recentEvents.length - 1 ? "1px solid var(--c-border)" : "none",
                    background: ev.planChanged ? "rgba(245,158,11,0.03)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                    {channelIcon(ev.event)}
                    <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text)", lineHeight: 1.45, flex: 1 }}>
                      {ev.event.replace(/\[(incoming reply|gmail|sms|whatsapp)\]\s*/i, "")}
                    </div>
                    {ev.planChanged && <PlanChangedBadge />}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)" }}>{ev.client} · {ev.invoice}</span>
                    {ev.date && <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", flexShrink: 0 }}>{ev.date}</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recently resolved mini-list */}
          {resolvedLoops.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 8 }}>
                RECENTLY RESOLVED
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {resolvedLoops.slice(0, 3).map(loop => (
                  <div key={loop.loop_id} style={{
                    background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 8,
                    padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7,
                  }}>
                    <div>
                      <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)" }}>{loop.invoice_number || loop.loop_id}</div>
                      <div style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)" }}>{loop.resolved_date || "Resolved"}</div>
                    </div>
                    <span style={{ fontFamily: f.display, fontSize: 13, color: "var(--c-text-2)" }}>{formatCurrency(loop.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
