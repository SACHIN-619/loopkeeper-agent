/**
 * EvidenceInjector.jsx — Sandbox-only demo control.
 *
 * Posts to POST /agent/inject-evidence on the backend.
 * If backend is unavailable, shows an honest "start the runner" message.
 * Never fakes state in React — all mutations go through store.py.
 *
 * Rendered at the bottom of Approvals page in sandbox mode only.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { f } from "../theme/tokens.js";

const EVIDENCE_TYPES = [
  {
    type:        "promise",
    label:       "Customer promises payment",
    description: "Client reply: 'We'll pay by [date].' Stores promise in state machine.",
    needsDate:   true,
    needsText:   false,
    defaultText: "We'll get the payment to you by the date selected.",
  },
  {
    type:        "payment",
    label:       "Payment confirmed",
    description: "Client reply confirming payment sent. Agent will verify and close.",
    needsDate:   false,
    needsText:   false,
    defaultText: "The payment has been sent. Please check your account.",
  },
  {
    type:        "dispute",
    label:       "Dispute raised",
    description: "Client disputes the invoice. Sets exception_type to dispute_partial.",
    needsDate:   false,
    needsText:   true,
    defaultText: "We have concerns about this invoice and are disputing part of the amount.",
  },
  {
    type:        "advance_deadline",
    label:       "Advance promise deadline (simulate broken promise)",
    description: "Sets promise_date to yesterday so the deterministic checker fires on next agent run.",
    needsDate:   false,
    needsText:   false,
    defaultText: "",
  },
];

export default function EvidenceInjector({ loops = [] }) {
  const [selectedLoop,  setSelectedLoop]  = useState(loops[0]?.loop_id || "");
  const [selectedType,  setSelectedType]  = useState(EVIDENCE_TYPES[0].type);
  const [promisedDate,  setPromisedDate]  = useState(() => {
    // Default to 3 days from now
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [customText,    setCustomText]    = useState("");
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState(null); // { ok, message }
  const [open,          setOpen]          = useState(false);

  const backendUrl = import.meta.env.VITE_CLOUD_RUN_URL || "http://localhost:8080";
  const ev = EVIDENCE_TYPES.find(e => e.type === selectedType) || EVIDENCE_TYPES[0];

  const handleInject = async () => {
    if (!selectedLoop) { setResult({ ok: false, message: "Select a loop first." }); return; }
    if (ev.needsDate && !promisedDate) { setResult({ ok: false, message: "A promise date is required." }); return; }

    setLoading(true);
    setResult(null);

    const body = {
      loop_id:      selectedLoop,
      type:         selectedType,
      text:         customText || ev.defaultText,
      ...(ev.needsDate ? { promised_date: promisedDate } : {}),
    };

    try {
      const res  = await fetch(`${backendUrl}/agent/inject-evidence`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.injected) {
        setResult({ ok: true, message: `Evidence injected. Run the agent to see it replan.` });
      } else {
        setResult({ ok: false, message: data.description || data.error || "Injection failed." });
      }
    } catch (e) {
      setResult({
        ok: false,
        message: "Agent backend unavailable. Start the sandbox runner first:\n  python -m loop_keeper.runner",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 32,
        background: "rgba(109,40,217,0.04)",
        border: "1px dashed rgba(109,40,217,0.25)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={13} color="rgba(109,40,217,0.7)" />
          <span style={{ fontFamily: f.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(109,40,217,0.7)" }}>
            SIMULATE INCOMING EVIDENCE
          </span>
          <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "1px 5px" }}>
            SANDBOX ONLY
          </span>
        </div>
        <ChevronDown size={13} color="var(--c-text-3)" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 18px 18px" }}>
              <p style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)", lineHeight: 1.6, marginBottom: 14, marginTop: 0 }}>
                Inject evidence into a loop through the same backend path as real Gmail replies. The agent
                will replan on the next run. Requires{" "}
                <code style={{ fontFamily: f.mono, fontSize: 11 }}>python -m loop_keeper.runner</code> to be running.
              </p>

              {/* Loop selector */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>INVOICE</label>
                <select
                  value={selectedLoop}
                  onChange={e => setSelectedLoop(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 10px", background: "var(--c-surface-2)",
                    border: "1px solid var(--c-border)", borderRadius: 7,
                    fontFamily: f.body, fontSize: 13, color: "var(--c-text)", outline: "none",
                  }}
                >
                  {loops.map(l => (
                    <option key={l.loop_id} value={l.loop_id}>
                      {l.invoice_number} — {l.client_name || l.loop_id} (${l.amount?.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Evidence type */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>EVIDENCE TYPE</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {EVIDENCE_TYPES.map(et => (
                    <label key={et.type} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="ev_type"
                        value={et.type}
                        checked={selectedType === et.type}
                        onChange={() => setSelectedType(et.type)}
                        style={{ marginTop: 3, accentColor: "rgba(109,40,217,0.7)" }}
                      />
                      <div>
                        <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text)", fontWeight: selectedType === et.type ? 600 : 400 }}>{et.label}</div>
                        <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-text-3)", lineHeight: 1.4 }}>{et.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Promise date picker */}
              {ev.needsDate && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>PROMISED DATE</label>
                  <input
                    type="date"
                    value={promisedDate}
                    onChange={e => setPromisedDate(e.target.value)}
                    style={{
                      padding: "9px 10px", background: "var(--c-surface-2)",
                      border: "1px solid var(--c-border)", borderRadius: 7,
                      fontFamily: f.body, fontSize: 13, color: "var(--c-text)", outline: "none",
                    }}
                  />
                </div>
              )}

              {/* Custom text */}
              {ev.needsText && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-text-3)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>DISPUTE REASON</label>
                  <textarea
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder={ev.defaultText}
                    rows={2}
                    style={{
                      width: "100%", padding: "9px 10px", background: "var(--c-surface-2)",
                      border: "1px solid var(--c-border)", borderRadius: 7,
                      fontFamily: f.body, fontSize: 13, color: "var(--c-text)", outline: "none",
                      resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Result feedback */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: "flex", gap: 8, padding: "10px 12px", borderRadius: 7, marginBottom: 12,
                      background: result.ok ? "rgba(0,212,170,0.07)" : "rgba(239,68,68,0.07)",
                      border: `1px solid ${result.ok ? "rgba(0,212,170,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}
                  >
                    {result.ok
                      ? <CheckCircle2 size={13} color="var(--c-teal)" style={{ flexShrink: 0, marginTop: 1 }} />
                      : <AlertCircle size={13} color="var(--c-tier3)" style={{ flexShrink: 0, marginTop: 1 }} />
                    }
                    <pre style={{ fontFamily: f.body, fontSize: 12, color: result.ok ? "var(--c-teal)" : "var(--c-tier3)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {result.message}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inject button */}
              <motion.button
                onClick={handleInject}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 8,
                  background: loading ? "var(--c-surface-3)" : "rgba(109,40,217,0.12)",
                  border: "1px solid rgba(109,40,217,0.3)",
                  color: "rgba(109,40,217,0.9)", fontFamily: f.body, fontWeight: 600, fontSize: 13,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(109,40,217,0.2)", borderTop: "2px solid rgba(109,40,217,0.7)", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                    Injecting…
                  </>
                ) : (
                  <><Zap size={13} /> Inject Evidence →</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
