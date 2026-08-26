/**
 * LoopRow.jsx — Full rebuild with dark design system.
 * History entries are {date, event} objects — properly rendered with timestamps.
 * Verify & Close uses inline modal — no window.prompt().
 * All colors from CSS variables.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Sparkles, Mail, MessageSquare,
  AlertTriangle, ShieldCheck, Split, Circle, Bot, ExternalLink,
} from "lucide-react";
import { c, f, displayTier, TIER_META, exceptionLabel, formatCurrency } from "../theme/tokens.js";
import { CLIENTS } from "../data/mockData.js";
import Stamp from "./Stamp.jsx";
import ResolvedStamp from "./ResolvedStamp.jsx";
import ActionPanel from "./ActionPanel.jsx";

/** Map event text to an icon — driven by keyword matching, no hardcoded text */
function eventIcon(text) {
  const t = String(text).toLowerCase();
  if (t.includes("[email]") || t.includes("reminder") || t.includes("invoice sent")) {
    return <Mail size={11} color="var(--c-teal)" />;
  }
  if (t.includes("[incoming reply]") || t.includes("client replied") || t.includes("reply")) {
    return <MessageSquare size={11} color="var(--c-tier2)" />;
  }
  if (t.includes("split")) {
    return <Split size={11} color="var(--c-tier1)" />;
  }
  if (t.includes("escalated") || t.includes("disputes")) {
    return <AlertTriangle size={11} color="var(--c-tier3)" />;
  }
  if (t.includes("verified") || t.includes("closed")) {
    return <ShieldCheck size={11} color="var(--c-resolved)" />;
  }
  if (t.includes("agent") || t.includes("plan")) {
    return <Bot size={11} color="var(--c-teal-dim)" />;
  }
  return <Circle size={6} color="var(--c-text-3)" fill="var(--c-text-3)" />;
}

/** Inline verify/close modal */
function VerifyModal({ loop, onConfirm, onCancel }) {
  const [note, setNote] = useState("Payment verified by agency owner");
  const [submitting, setSubmitting] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      style={{
        marginTop: 12,
        background: "var(--c-surface-3)",
        border: "1px solid var(--c-resolved-border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--c-resolved)", fontWeight: 600, marginBottom: 10 }}>
        VERIFY & CLOSE INVOICE
      </div>
      <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", marginBottom: 8 }}>
        Verification note (what evidence confirms this is resolved?):
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          background: "var(--c-surface-2)",
          border: "1px solid var(--c-border-bright)",
          borderRadius: 6,
          color: "var(--c-text)",
          fontFamily: f.mono,
          fontSize: 12,
          padding: "8px 10px",
          lineHeight: 1.5,
          resize: "none",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={async () => {
            if (!note.trim()) return;
            setSubmitting(true);
            await onConfirm(loop.loop_id, note.trim());
          }}
          disabled={submitting || !note.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            borderRadius: 6,
            background: submitting ? "var(--c-text-3)" : "var(--c-resolved)",
            color: "var(--c-bg)",
            fontFamily: f.body, fontWeight: 600, fontSize: 12,
            border: "none", cursor: submitting ? "default" : "pointer",
          }}
        >
          <ShieldCheck size={13} />
          {submitting ? "Closing…" : "Confirm Resolution"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 14px", borderRadius: 6,
            background: "transparent", color: "var(--c-text-2)",
            fontFamily: f.body, fontSize: 12, cursor: "pointer",
            border: "1px solid var(--c-border)",
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

export default function LoopRow({
  loop,
  expanded,
  onToggle,
  justChanged,
  isFallback,
  onActionCompleted,
  onVerifyAndClose,
}) {
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verified, setVerified] = useState(loop.status === "closed");

  const client = CLIENTS[loop.client_id] || {
    name: loop.client_name || "Unknown Client",
    relationship_tier: "unknown",
    notes: "",
  };

  const hasNewInfo = justChanged || loop.unread_reply;
  const tier = displayTier(loop);
  const tierMeta = TIER_META[tier] ?? TIER_META.watching;

  // Derive section header from tier — no hardcoded strings in JSX
  const sectionHeaders = {
    watching: "NOTHING TO DO YET",
    1: "AGENT'S NEXT MOVE",
    2: "AWAITING YOUR APPROVAL",
    3: "WHY YOU'RE SEEING THIS",
  };
  const sectionHeader = sectionHeaders[tier] ?? "AGENT STATUS";

  const handleVerify = async (loopId, note) => {
    if (onVerifyAndClose) await onVerifyAndClose(loopId, note);
    setVerified(true);
    setShowVerifyModal(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
      style={{
        background: "var(--c-surface)",
        border: `1px solid ${hasNewInfo ? tierMeta.border : "var(--c-border)"}`,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        boxShadow: hasNewInfo ? `0 0 0 1px ${tierMeta.border}, 0 4px 20px rgba(0,0,0,0.3)` : "none",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* Left tier accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: tierMeta.color,
          opacity: tier === "watching" ? 0.3 : 0.7,
          borderRadius: "12px 0 0 12px",
        }}
      />

      {/* NEW INFORMATION badge */}
      <AnimatePresence>
        {hasNewInfo && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: "absolute",
              top: -10,
              left: 48,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "var(--c-tier2)",
              color: "#000",
              fontFamily: f.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              padding: "3px 9px",
              borderRadius: 10,
              zIndex: 5,
            }}
          >
            <Sparkles size={8} />
            NEW INFORMATION
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row header (click to expand) */}
      <button
        id={`loop-row-${loop.loop_id}`}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "32px 1fr 130px 90px 160px",
          alignItems: "center",
          gap: 12,
          padding: "16px 16px 16px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Chevron */}
        <span style={{ color: "var(--c-text-3)" }}>
          {expanded
            ? <ChevronDown size={16} />
            : <ChevronRight size={16} />}
        </span>

        {/* Client + invoice */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 14, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {client.name}
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
            {loop.invoice_number}
            {loop.days_overdue > 0 && (
              <span style={{ color: "var(--c-tier3)", marginLeft: 8 }}>
                {loop.days_overdue}d overdue
              </span>
            )}
          </div>
        </div>

        {/* Exception type chip */}
        <div>
          <span
            style={{
              fontFamily: f.mono,
              fontSize: 10,
              letterSpacing: "0.06em",
              color: tierMeta.color,
              background: tierMeta.bg,
              border: `1px solid ${tierMeta.border}`,
              borderRadius: 5,
              padding: "3px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {exceptionLabel(loop.exception_type)}
          </span>
        </div>

        {/* Days overdue number */}
        <div style={{ textAlign: "center" }}>
          {loop.days_overdue > 0 ? (
            <span style={{ fontFamily: f.mono, fontSize: 13, fontWeight: 600, color: loop.days_overdue > 30 ? "var(--c-tier3)" : "var(--c-tier2)" }}>
              {loop.days_overdue}d
            </span>
          ) : (
            <span style={{ fontFamily: f.mono, fontSize: 12, color: "var(--c-text-3)" }}>—</span>
          )}
        </div>

        {/* Amount + stamp */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <span style={{ fontFamily: f.display, fontSize: 17, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.01em" }}>
            {formatCurrency(loop.amount)}
          </span>
          <Stamp loop={loop} />
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 20px 24px 20px", borderTop: "1px solid var(--c-border)" }}>

              {/* Action section */}
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", marginBottom: 8, fontWeight: 600 }}>
                  {sectionHeader}
                </div>
                <ActionPanel
                  loop={loop}
                  isFallback={isFallback}
                  onActionCompleted={onActionCompleted}
                />
              </div>

              {/* Two-column detail grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

                {/* Left: Decision Timeline */}
                <div>
                  <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", marginBottom: 12, fontWeight: 600 }}>
                    DECISION TIMELINE
                  </div>
                  <div style={{ position: "relative", paddingLeft: 18 }}>
                    {/* Vertical line */}
                    <div style={{
                      position: "absolute",
                      left: 6,
                      top: 6,
                      bottom: 6,
                      width: 1,
                      background: "var(--c-border-bright)",
                    }} />

                    {(loop.history || []).map((h, i) => {
                      const event = typeof h === "string" ? h : (h.event || "");
                      const date = typeof h === "object" ? h.date : null;
                      const isReply = event.toLowerCase().includes("[incoming reply]");

                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 12,
                            marginBottom: 14,
                            position: "relative",
                          }}
                        >
                          {/* Icon dot */}
                          <div
                            style={{
                              position: "absolute",
                              left: -18,
                              top: 2,
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: isReply ? "rgba(245,158,11,0.15)" : "var(--c-surface-3)",
                              border: `1px solid ${isReply ? "var(--c-tier2)" : "var(--c-border-bright)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 1,
                            }}
                          >
                            {eventIcon(event)}
                          </div>

                          <div style={{ flex: 1 }}>
                            {date && (
                              <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginBottom: 2 }}>
                                {date}
                              </div>
                            )}
                            <div
                              style={{
                                fontFamily: f.body,
                                fontSize: 13,
                                color: isReply ? "var(--c-tier2)" : "var(--c-text)",
                                lineHeight: 1.5,
                                background: isReply ? "rgba(245,158,11,0.05)" : "transparent",
                                padding: isReply ? "4px 8px" : "0",
                                borderRadius: isReply ? 5 : 0,
                                border: isReply ? "1px solid rgba(245,158,11,0.15)" : "none",
                              }}
                            >
                              {event.replace(/\[INCOMING REPLY\]\s*/i, "")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Agent Knowledge + Relationship */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Agent Knows */}
                  <div>
                    <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", marginBottom: 8, fontWeight: 600 }}>
                      WHAT THE AGENT KNOWS
                    </div>
                    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                      {[
                        ["Amount", formatCurrency(loop.amount)],
                        ["Status", loop.status],
                        ["Days Late", loop.days_overdue > 0 ? `${loop.days_overdue}d` : "—"],
                        ["Contacts", `${loop.contact_count ?? 0} sent`],
                        loop.disputed_amount > 0 && ["Disputed", formatCurrency(loop.disputed_amount)],
                        loop.undisputed_amount > 0 && loop.disputed_amount > 0 && ["Undisputed", formatCurrency(loop.undisputed_amount)],
                      ].filter(Boolean).map(([key, val]) => (
                        <React.Fragment key={key}>
                          <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>{key}</span>
                          <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text)", fontWeight: 500, textTransform: "capitalize" }}>{val}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Priority reasoning */}
                  {loop.priority_why && (
                    <div>
                      <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", marginBottom: 8, fontWeight: 600 }}>
                        WHY THIS PRIORITY RANK
                      </div>
                      <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "10px 14px", fontFamily: f.mono, fontSize: 11, color: "var(--c-text-2)", lineHeight: 1.6 }}>
                        {loop.priority_why}
                      </div>
                    </div>
                  )}

                  {/* Relationship memory */}
                  <div>
                    <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", marginBottom: 8, fontWeight: 600 }}>
                      RELATIONSHIP MEMORY
                    </div>
                    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: "var(--c-text)", marginBottom: 3 }}>
                        {client.name}
                      </div>
                      <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", marginBottom: 6 }}>
                        {client.relationship_tier}
                        {client.promises_made > 0 && (
                          <span style={{ marginLeft: 8, color: client.promises_kept === client.promises_made ? "var(--c-tier1)" : "var(--c-tier2)" }}>
                            · {client.promises_kept}/{client.promises_made} promises kept
                          </span>
                        )}
                        {client.avg_days_to_pay && (
                          <span style={{ marginLeft: 8 }}>· avg {client.avg_days_to_pay}d to pay</span>
                        )}
                      </div>
                      {client.notes && (
                        <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5, fontStyle: "italic" }}>
                          "{client.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Verify & Close */}
                  {!verified && loop.status !== "closed" && (
                    <AnimatePresence mode="wait">
                      {!showVerifyModal ? (
                        <motion.button
                          key="open-verify"
                          onClick={() => setShowVerifyModal(true)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "9px 14px",
                            borderRadius: 8,
                            background: "transparent",
                            border: "1px solid var(--c-resolved-border)",
                            color: "var(--c-resolved)",
                            fontFamily: f.mono,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <ShieldCheck size={13} />
                          VERIFY &amp; CLOSE INVOICE
                        </motion.button>
                      ) : (
                        <VerifyModal
                          key="verify-modal"
                          loop={loop}
                          onConfirm={handleVerify}
                          onCancel={() => setShowVerifyModal(false)}
                        />
                      )}
                    </AnimatePresence>
                  )}

                  {/* Already verified */}
                  {(verified || loop.status === "closed") && (
                    <ResolvedStamp visible={true} />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
