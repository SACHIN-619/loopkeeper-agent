/**
 * AddInvoice.jsx — Invoice entry page.
 * Users add their overdue/upcoming invoices here.
 * On submit: writes to Firestore (live) or local sandbox state.
 * Agent then picks up the new loop on its next run.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../contexts/AppContext.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { annotateLoop } from "../data/priorityLogic.js";
import { f, formatCurrency } from "../theme/tokens.js";
import { db } from "../data/firestoreClient.js";
import { doc, setDoc } from "firebase/firestore";
import { FileText, DollarSign, Calendar, Mail, User, Building2, CheckCircle2, AlertTriangle } from "lucide-react";

/* ── Relationship tier options — data driven ─────────────── */
const RELATIONSHIP_TIERS = [
  { value: "new client",                  label: "New client — no history yet"            },
  { value: "reliable",                    label: "Reliable — usually pays on time"         },
  { value: "long-standing, reliable",     label: "Long-standing and reliable"              },
  { value: "mid-size, mixed track record",label: "Mixed track record"                      },
  { value: "chronic slow payer",          label: "Chronic slow payer"                      },
  { value: "large account",              label: "Large account — handle carefully"         },
];

function Label({ children }) {
  return (
    <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function Field({ icon: Icon, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {children}
      {hint && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-text-3)", marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = (hasError = false) => ({
  width: "100%",
  padding: "11px 12px",
  background: "var(--c-surface-2)",
  border: `1px solid ${hasError ? "var(--c-tier3)" : "var(--c-border)"}`,
  borderRadius: 8,
  color: "var(--c-text)",
  fontFamily: f.body,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
});

export default function AddInvoice() {
  const navigate = useNavigate();
  const { isFallback } = useApp();
  const { user, isDemoMode } = useAuth();

  const [form, setForm] = useState({
    client_name:       "",
    client_email:      "",
    invoice_number:    "",
    amount:            "",
    due_date:          "",
    relationship_tier: "new client",
    notes:             "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  function validate() {
    const e = {};
    if (!form.client_name.trim())    e.client_name    = "Client name required";
    if (!form.client_email.trim())   e.client_email   = "Client email required";
    if (!/\S+@\S+\.\S+/.test(form.client_email)) e.client_email = "Valid email address required";
    if (!form.invoice_number.trim()) e.invoice_number = "Invoice number required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = "Valid amount required";
    if (!form.due_date)              e.due_date       = "Due date required";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);

    const activeUserId = user?.uid || (isDemoMode ? "sandbox_demo_user" : "sandbox_local_user");

    const newLoop = annotateLoop({
      loop_id:        `inv_${Date.now()}`,
      user_id:        activeUserId,
      client_id:      `cl_${form.client_email.split("@")[0].replace(/\W/g, "_")}`,
      client_name:    form.client_name.trim(),
      client_email:   form.client_email.trim().toLowerCase(),
      invoice_number: form.invoice_number.trim().toUpperCase(),
      amount:         Number(form.amount),
      disputed_amount: 0,
      undisputed_amount: Number(form.amount),
      status:         "overdue",
      exception_type: "fresh_overdue",
      contact_count:  0,
      due_date:       form.due_date,
      history: [
        { date: new Date().toISOString().split("T")[0], event: "Invoice added to LoopKeeper" },
        { date: form.due_date, event: "Payment due" },
      ],
      email_syntax_valid: true,
      delivery_status: "VALID_FORMAT_DELIVERY_UNCONFIRMED",
      relationship_tier: form.relationship_tier,
      notes: form.notes.trim() || null,
    });

    if (!isFallback && db) {
      // Write to Firestore
      try {
        await setDoc(doc(db, "loops", newLoop.loop_id), newLoop);
      } catch (err) {
        console.warn("Firestore write failed — loop added to sandbox only.", err);
      }
    }

    // Also add to local sandbox state via a custom event (AppShell listens)
    window.dispatchEvent(new CustomEvent("lk:add-loop", { detail: newLoop }));

    setSubmitting(false);
    setSuccess(true);

    // Auto-navigate to Open Loops after a brief success display
    setTimeout(() => navigate("/app/loops"), 1800);
  }

  if (success) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <CheckCircle2 size={34} color="var(--c-teal)" strokeWidth={1.5} />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 500, color: "var(--c-text)", marginBottom: 6 }}>
            Invoice added to LoopKeeper
          </div>
          <div style={{ fontFamily: f.body, fontSize: 14, color: "var(--c-text-2)" }}>
            The agent will investigate and prioritize it on its next run.
          </div>
        </div>
      </div>
    );
  }

  const amtNum = Number(form.amount);
  const isHighValue = amtNum >= 5000;
  const isDisputed  = false; // set by agent later

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.12em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>
          ADD INVOICE
        </div>
        <h1 style={{ fontFamily: f.display, fontSize: 26, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Track a new invoice
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 5, lineHeight: 1.5 }}>
          Add an overdue or upcoming invoice. The agent takes over immediately.
        </p>
      </motion.div>

      {/* Sandbox note */}
      {isFallback && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 8, marginBottom: 20 }}>
          <AlertTriangle size={14} color="var(--c-tier2)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
            <strong>Sandbox mode:</strong> This invoice will be added to the local demo session only. Connect Firebase to persist across sessions.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 12, padding: "24px",
        }}>
          {/* Client section */}
          <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 600, marginBottom: 16 }}>
            CLIENT INFORMATION
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field hint="Full business name or person's name">
              <Label>Client name *</Label>
              <input
                style={inputStyle(!!errors.client_name)}
                placeholder="e.g. Bright Path Design Co."
                value={form.client_name}
                onChange={e => set("client_name", e.target.value)}
              />
              {errors.client_name && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-tier3)", marginTop: 3 }}>{errors.client_name}</div>}
            </Field>

            <Field hint="Replies will be matched to this email">
              <Label>Client email *</Label>
              <input
                style={inputStyle(!!errors.client_email)}
                type="email"
                placeholder="e.g. accounts@clientco.com"
                value={form.client_email}
                onChange={e => set("client_email", e.target.value)}
              />
              {errors.client_email && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-tier3)", marginTop: 3 }}>{errors.client_email}</div>}
            </Field>
          </div>

          {/* Relationship */}
          <Field>
            <Label>Relationship tier</Label>
            <select
              style={{ ...inputStyle(), cursor: "pointer" }}
              value={form.relationship_tier}
              onChange={e => set("relationship_tier", e.target.value)}
            >
              {RELATIONSHIP_TIERS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field>
            <Label>Notes about this client (optional)</Label>
            <textarea
              style={{ ...inputStyle(), minHeight: 68, resize: "vertical", lineHeight: 1.5 }}
              placeholder="Payment history, communication style, anything the agent should know…"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </Field>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--c-border)", margin: "16px 0" }} />
          <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 600, marginBottom: 16 }}>
            INVOICE DETAILS
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            <Field>
              <Label>Invoice number *</Label>
              <input
                style={inputStyle(!!errors.invoice_number)}
                placeholder="e.g. INV-1042"
                value={form.invoice_number}
                onChange={e => set("invoice_number", e.target.value)}
              />
              {errors.invoice_number && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-tier3)", marginTop: 3 }}>{errors.invoice_number}</div>}
            </Field>

            <Field>
              <Label>Amount (USD) *</Label>
              <input
                style={inputStyle(!!errors.amount)}
                type="number" min="1" step="0.01"
                placeholder="e.g. 4200"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
              />
              {errors.amount && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-tier3)", marginTop: 3 }}>{errors.amount}</div>}
            </Field>

            <Field>
              <Label>Due date *</Label>
              <input
                style={inputStyle(!!errors.due_date)}
                type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
              />
              {errors.due_date && <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-tier3)", marginTop: 3 }}>{errors.due_date}</div>}
            </Field>
          </div>
        </div>

        {/* Authority preview */}
        {form.amount && !isNaN(amtNum) && amtNum > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: `${isHighValue ? "rgba(245,158,11,0.06)" : "rgba(0,212,170,0.05)"}`,
              border: `1px solid ${isHighValue ? "rgba(245,158,11,0.2)" : "rgba(0,212,170,0.15)"}`,
              borderRadius: 8,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isHighValue ? "var(--c-tier2)" : "var(--c-tier1)",
              flexShrink: 0,
            }} />
            <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
              <strong style={{ color: isHighValue ? "var(--c-tier2)" : "var(--c-tier1)" }}>
                {isHighValue ? "Tier 2 — Needs your approval" : "Tier 1 — Agent will handle autonomously"}
              </strong>
              {" "}— {isHighValue
                ? `${formatCurrency(amtNum)} exceeds the $5,000 auto-send threshold. The agent will draft and hold for your review.`
                : `${formatCurrency(amtNum)} is within the agent's autonomous authority. It will follow up without asking.`}
            </div>
          </motion.div>
        )}

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          style={{
            marginTop: 20,
            width: "100%", padding: "14px", borderRadius: 10,
            background: submitting ? "var(--c-text-3)" : "var(--c-teal)",
            color: "var(--c-text-inv)",
            fontFamily: f.body, fontWeight: 700, fontSize: 15,
            border: "none", cursor: submitting ? "default" : "pointer",
            boxShadow: "0 0 20px rgba(0,212,170,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {submitting ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              Adding invoice…
            </span>
          ) : (
            <>
              <FileText size={15} />
              Add to LoopKeeper
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
}
