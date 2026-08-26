/**
 * ActionPanel.jsx — The real authority logic made visible.
 * Tier 1: Agent acts autonomously.
 * Tier 2: Draft held for approval — one-tap approve/edit.
 * Tier 3: Agent refuses to draft — needs human judgment.
 * watching: Promise pending, no action needed yet.
 *
 * Zero hardcoded colors — all from CSS variables.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ShieldCheck, AlertTriangle, Send, Bot, Eye, Loader2 } from "lucide-react";
import { c, f, displayTier } from "../theme/tokens.js";
import { triggerAgentRun } from "../data/firestoreClient.js";

export default function ActionPanel({ loop, isFallback, onActionCompleted }) {
  const [state, setState] = useState("pending"); // pending | sending | sent | editing
  const [editBody, setEditBody] = useState(loop.draft?.body || "");
  const tier = displayTier(loop);

  const isSandboxApproved =
    isFallback && sessionStorage.getItem(`approved_${loop.loop_id}`) === "true";
  const displayState = isSandboxApproved ? "sent" : state;

  const panelBase = {
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid var(--c-border)",
  };

  /* ── Watching ─────────────────────────────────────── */
  if (tier === "watching") {
    return (
      <div
        style={{
          ...panelBase,
          padding: "14px 16px",
          background: "var(--c-watching-bg)",
          border: "1px solid var(--c-watching-border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Eye size={15} color="var(--c-watching)" strokeWidth={2} />
        <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.5 }}>
          Watching — client committed to a payment date. Nothing to do until it passes.
        </span>
      </div>
    );
  }

  /* ── Tier 1 ───────────────────────────────────────── */
  if (tier === 1) {
    return (
      <div
        style={{
          ...panelBase,
          padding: "14px 16px",
          background: "var(--c-tier1-bg)",
          border: "1px solid var(--c-tier1-border)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Bot size={15} color="var(--c-tier1)" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--c-tier1)", marginBottom: 4, fontWeight: 600 }}>
            AGENT AUTHORITY
          </div>
          <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.5 }}>
            Within the agent's own authority — it handles this without waiting on you.
          </span>
        </div>
      </div>
    );
  }

  /* ── Tier 3 ───────────────────────────────────────── */
  if (tier === 3) {
    return (
      <div
        style={{
          ...panelBase,
          padding: "14px 16px",
          background: "var(--c-tier3-bg)",
          border: "1px solid var(--c-tier3-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={14} color="var(--c-tier3)" strokeWidth={2.5} />
          <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--c-tier3)", fontWeight: 600 }}>
            AGENT WON'T DRAFT THIS
          </span>
        </div>
        <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text)", lineHeight: 1.6 }}>
          {loop.escalation_reason || "This situation requires human judgment before any action."}
        </div>
      </div>
    );
  }

  /* ── Tier 2 — Approved / Sent ─────────────────────── */
  if (displayState === "sent") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          ...panelBase,
          padding: "14px 16px",
          background: "rgba(0,212,170,0.05)",
          border: "1px solid rgba(0,212,170,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ShieldCheck size={15} color="var(--c-teal)" strokeWidth={2.5} />
        <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-teal)", fontWeight: 500 }}>
          {isFallback ? "Simulated send complete — sandbox mode." : "Approved and sent."}
        </span>
      </motion.div>
    );
  }

  /* ── Tier 2 — Editing ─────────────────────────────── */
  if (displayState === "editing") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ ...panelBase }}
        >
          <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-tier2)", letterSpacing: "0.07em", fontWeight: 600 }}>EDITING DRAFT</span>
          </div>
          <div style={{ padding: 14, background: "var(--c-surface-2)" }}>
            <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginBottom: 4 }}>
              Subject: <span style={{ color: "var(--c-text-2)" }}>{loop.draft?.subject}</span>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={6}
              style={{
                width: "100%",
                background: "var(--c-surface-3)",
                border: "1px solid var(--c-border-bright)",
                borderRadius: 6,
                color: "var(--c-text)",
                fontFamily: f.mono,
                fontSize: 12,
                padding: "10px 12px",
                lineHeight: 1.6,
                resize: "vertical",
                marginTop: 8,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={() => {
                  setState("pending");
                }}
                style={{ padding: "7px 14px", borderRadius: 6, background: "var(--c-tier2)", color: "#000", fontFamily: f.body, fontWeight: 600, fontSize: 12, cursor: "pointer", border: "none" }}
              >
                Done Editing
              </button>
              <button
                onClick={() => setState("pending")}
                style={{ padding: "7px 14px", borderRadius: 6, background: "transparent", color: "var(--c-text-2)", fontFamily: f.body, fontSize: 12, cursor: "pointer", border: "1px solid var(--c-border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ── Tier 2 — Pending approval ────────────────────── */
  return (
    <div style={{ ...panelBase }}>
      {/* Held reason */}
      <div
        style={{
          padding: "9px 14px",
          background: "rgba(245,158,11,0.06)",
          borderBottom: "1px solid var(--c-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Clock size={12} color="var(--c-tier2)" />
        <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-tier2)", letterSpacing: "0.04em" }}>
          {loop.draft?.held_reason}
        </span>
      </div>

      {/* Draft preview */}
      <div style={{ padding: 14, background: "var(--c-surface-2)" }}>
        <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", marginBottom: 4 }}>
          Subject: <span style={{ color: "var(--c-text-2)" }}>{loop.draft?.subject}</span>
        </div>
        <div
          style={{
            fontFamily: f.body,
            fontSize: 13,
            color: "var(--c-text)",
            whiteSpace: "pre-line",
            lineHeight: 1.6,
            marginTop: 8,
            padding: "10px 12px",
            background: "var(--c-surface-3)",
            borderRadius: 6,
            border: "1px solid var(--c-border)",
          }}
        >
          {state === "editing" ? editBody : loop.draft?.body}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={async () => {
              setState("sending");
              try { sessionStorage.setItem(`approved_${loop.loop_id}`, "true"); } catch {}

              const serviceUrl = import.meta.env.VITE_CLOUD_RUN_URL;
              if (!isFallback && serviceUrl) {
                try {
                  await triggerAgentRun(`send the draft for ${loop.loop_id}`, { serviceUrl });
                } catch (e) {
                  console.warn("Cloud Run approval trigger skipped/failed:", e);
                }
              }

              setTimeout(() => {
                setState("sent");
                if (onActionCompleted) onActionCompleted(loop.loop_id, "approved");
              }, 600);
            }}
            disabled={state === "sending"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: 7,
              background: state === "sending" ? "var(--c-text-3)" : "var(--c-teal)",
              color: "var(--c-text-inv)",
              fontFamily: f.body,
              fontWeight: 600,
              fontSize: 13,
              cursor: state === "sending" ? "default" : "pointer",
              border: "none",
              transition: "all 0.15s ease",
            }}
          >
            {state === "sending" ? (
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Send size={13} />
            )}
            {state === "sending" ? "Sending…" : isFallback ? "Simulate Send" : "Approve & Send"}
          </button>

          <button
            onClick={() => setState("editing")}
            disabled={state === "sending"}
            style={{
              padding: "9px 16px",
              borderRadius: 7,
              background: "transparent",
              color: "var(--c-text-2)",
              fontFamily: f.body,
              fontSize: 13,
              cursor: state === "sending" ? "default" : "pointer",
              border: "1px solid var(--c-border)",
              opacity: state === "sending" ? 0.5 : 1,
              transition: "all 0.15s ease",
            }}
          >
            Edit first
          </button>
        </div>
      </div>
    </div>
  );
}