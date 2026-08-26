/**
 * OpenLoops.jsx — Tracked invoices with List View & Tree Flow View.
 * Includes view switcher, filter pills, sorting, and inline loop expansion.
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, SlidersHorizontal, LayoutList, GitFork, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../contexts/AppContext.js";
import { priorityScore } from "../data/priorityLogic.js";
import LoopRow from "../components/LoopRow.jsx";
import LoopTreeView from "../components/LoopTreeView.jsx";
import SkeletonRow from "../components/SkeletonRow.jsx";
import { f } from "../theme/tokens.js";

const SORT_OPTIONS = [
  { value: "priority", label: "Priority score" },
  { value: "amount_desc", label: "Amount (high→low)" },
  { value: "days_desc", label: "Days overdue" },
  { value: "tier", label: "Tier (urgent first)" },
];

const FILTER_OPTIONS = [
  { value: "all",       label: "All loops" },
  { value: "tier1",     label: "Agent handling" },
  { value: "tier2",     label: "Needs approval" },
  { value: "tier3",     label: "Needs you" },
  { value: "watching",  label: "Watching" },
];

function EmptyState({ loadSampleDataset }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px", gap: 16 }}
    >
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle2 size={28} color="var(--c-teal)" strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 500, color: "var(--c-text)", marginBottom: 8 }}>
          No active invoices in tracking
        </div>
        <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.6, marginBottom: 20 }}>
          Add your first invoice to let LoopKeeper observe, reason, and track payment follow-ups automatically.
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
            Load Sample Dataset
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function OpenLoops() {
  const { loops, resolvedLoops, loading, isFallback, onVerifyAndClose, onActionCompleted, loadSampleDataset } = useApp();
  const [expandedId, setExpandedId] = useState(null);
  const [recentlyChanged, setRecentlyChanged] = useState(new Set());
  const [sortBy, setSortBy] = useState("priority");
  const [filterBy, setFilterBy] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" | "tree"

  const sorted = useMemo(() => {
    let list = [...loops];

    if (filterBy === "tier1") list = list.filter(l => l.tier === 1 && l.exception_type !== "promise_pending");
    else if (filterBy === "tier2") list = list.filter(l => l.tier === 2);
    else if (filterBy === "tier3") list = list.filter(l => l.tier === 3);
    else if (filterBy === "watching") list = list.filter(l => l.exception_type === "promise_pending");

    if (sortBy === "priority") list.sort((a, b) => priorityScore(b) - priorityScore(a));
    else if (sortBy === "amount_desc") list.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    else if (sortBy === "days_desc") list.sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
    else if (sortBy === "tier") list.sort((a, b) => b.tier - a.tier);

    return list;
  }, [loops, sortBy, filterBy]);

  const handleActionCompleted = (loopId, action) => {
    setRecentlyChanged(prev => new Set([...prev, loopId]));
    onActionCompleted(loopId, action);
    setTimeout(() => setRecentlyChanged(prev => { const n = new Set(prev); n.delete(loopId); return n; }), 4000);
  };

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 1150, margin: "0 auto" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.12em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>
          OPEN LOOPS
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: f.display, fontSize: 26, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
              Active Invoices
            </h1>
            <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 5 }}>
              {loading ? "Loading…" : `${sorted.length} of ${loops.length} loops showing`}
            </p>
          </div>

          {/* Controls row */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* View Mode Switcher: List vs Tree */}
            <div style={{ display: "flex", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setViewMode("list")}
                title="List View — Standard table view"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 6,
                  background: viewMode === "list" ? "var(--c-teal-glow)" : "transparent",
                  border: `1px solid ${viewMode === "list" ? "rgba(0,212,170,0.2)" : "transparent"}`,
                  color: viewMode === "list" ? "var(--c-teal)" : "var(--c-text-3)",
                  fontFamily: f.mono, fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                <LayoutList size={13} /> List View
              </button>
              <button
                onClick={() => setViewMode("tree")}
                title="Tree Flow View — Visual stage diagram"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 6,
                  background: viewMode === "tree" ? "var(--c-teal-glow)" : "transparent",
                  border: `1px solid ${viewMode === "tree" ? "rgba(0,212,170,0.2)" : "transparent"}`,
                  color: viewMode === "tree" ? "var(--c-teal)" : "var(--c-text-3)",
                  fontFamily: f.mono, fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                <GitFork size={13} /> Tree Flow View
              </button>
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterBy(opt.value)}
                  style={{
                    padding: "5px 12px", borderRadius: 20,
                    background: filterBy === opt.value ? "var(--c-teal)" : "var(--c-surface)",
                    border: `1px solid ${filterBy === opt.value ? "var(--c-teal)" : "var(--c-border)"}`,
                    color: filterBy === opt.value ? "var(--c-text-inv)" : "var(--c-text-2)",
                    fontFamily: f.mono, fontSize: 10, letterSpacing: "0.05em", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort select */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SlidersHorizontal size={13} color="var(--c-text-3)" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  color: "var(--c-text-2)", borderRadius: 7, padding: "5px 10px",
                  fontFamily: f.mono, fontSize: 11, cursor: "pointer",
                  outline: "none",
                }}
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      {viewMode === "tree" ? (
        <LoopTreeView
          loops={sorted}
          resolvedLoops={resolvedLoops}
          onSelectLoop={(id) => {
            setViewMode("list");
            setExpandedId(id);
          }}
        />
      ) : (
        <>
          {/* Column headers */}
          {!loading && sorted.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 130px 80px 170px",
              gap: 12, padding: "0 16px 8px 18px",
              fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em",
              color: "var(--c-text-3)", fontWeight: 600,
            }}>
              <div />
              <div>CLIENT / INVOICE</div>
              <div>SITUATION</div>
              <div style={{ textAlign: "center" }}>DAYS</div>
              <div style={{ textAlign: "right" }}>AMOUNT / STATUS</div>
            </div>
          )}

          {/* Loop rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              [0,1,2,3].map(i => <SkeletonRow key={i} index={i} />)
            ) : sorted.length === 0 ? (
              <EmptyState loadSampleDataset={loadSampleDataset} />
            ) : (
              <AnimatePresence>
                {sorted.map((loop, i) => (
                  <motion.div
                    key={loop.loop_id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <LoopRow
                      loop={loop}
                      expanded={expandedId === loop.loop_id}
                      onToggle={() => setExpandedId(prev => prev === loop.loop_id ? null : loop.loop_id)}
                      justChanged={recentlyChanged.has(loop.loop_id)}
                      isFallback={isFallback}
                      onActionCompleted={handleActionCompleted}
                      onVerifyAndClose={onVerifyAndClose}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </>
      )}
    </div>
  );
}
