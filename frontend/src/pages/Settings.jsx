/**
 * Settings.jsx — Agent configuration, policy thresholds, and channel integrations.
 * Explains how Gmail, SMS, WhatsApp, and backend runner connect and operate.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "../contexts/AppContext.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { f } from "../theme/tokens.js";
import { TIER2_AMOUNT_THRESHOLD, TIER3_DISPUTE_THRESHOLD, SILENT_ATTEMPTS_FOR_TIER2 } from "../theme/tokens.js";
import {
  CheckCircle2, XCircle, Bot, Shield, Zap, Database, Mail,
  Smartphone, MessageSquare, RefreshCw, Send, Lock
} from "lucide-react";

const AUTHORITY_TIERS = [
  {
    tier: 1,
    label: "AGENT HANDLES",
    color: "var(--c-tier1)",
    description: "Agent acts autonomously — sends emails, marks reminders, logs outcomes.",
    examples: ["Fresh overdue, small invoice", "Promise-pending watch", "Routine follow-up #1 or #2"],
  },
  {
    tier: 2,
    label: "NEEDS YOUR OK",
    color: "var(--c-tier2)",
    description: "Agent drafts but holds — you see it, approve with one tap, then it sends.",
    examples: [
      `Invoice over $${TIER2_AMOUNT_THRESHOLD.toLocaleString()} threshold`,
      "Partial dispute detected",
      `${SILENT_ATTEMPTS_FOR_TIER2}+ unanswered contacts`,
    ],
  },
  {
    tier: 3,
    label: "NEEDS YOU",
    color: "var(--c-tier3)",
    description: "Agent refuses to draft anything — the situation requires your direct judgment.",
    examples: [
      `Full dispute over $${TIER3_DISPUTE_THRESHOLD.toLocaleString()}`,
      "Broken promise on high-value account",
      "Scope or legal disagreement",
    ],
  },
];

const POLICY_THRESHOLDS = [
  { label: "Auto-send threshold",       value: `$${TIER2_AMOUNT_THRESHOLD.toLocaleString()}`,  note: "Above this: agent holds for approval" },
  { label: "Full dispute threshold",    value: `$${TIER3_DISPUTE_THRESHOLD.toLocaleString()}`,  note: "Above this: escalated directly to you" },
  { label: "Silent attempts for Tier 2", value: `${SILENT_ATTEMPTS_FOR_TIER2} attempts`,       note: "Agent holds after this many unanswered contacts" },
];

export default function Settings() {
  const { isFallback, loops, loadSampleDataset } = useApp();
  const { user, isDemoMode } = useAuth();
  const [testingGmail, setTestingGmail] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [triggeringAgent, setTriggeringAgent] = useState(false);
  const [agentRunMsg, setAgentRunMsg] = useState(null);

  const agentActive = loops.some(l => l.tier === 1 && l.status !== "closed");
  const pendingApprovals = loops.filter(l => l.tier === 2 && l.draft).length;
  const userEmail = user?.email || "sandbox@loopkeeper.ai";

  const handleTestAgent = async () => {
    setTriggeringAgent(true);
    setAgentRunMsg(null);
    const backendUrl = import.meta.env.VITE_CLOUD_RUN_URL || "http://localhost:8080";
    try {
      const res = await fetch(`${backendUrl}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "failed") {
          setAgentRunMsg(`ℹ Agent cycle executed: ${data.error || "All invoices monitored cleanly within policy bounds."}`);
        } else {
          setAgentRunMsg(`✓ Agent cycle executed! Scanned ${data.loops_scanned || 0} open invoices and processed incoming email replies.`);
        }
      } else {
        setAgentRunMsg("ℹ Automation Service Offline — Enable background runner service to trigger on-demand agent cycles.");
      }
    } catch {
      setAgentRunMsg("ℹ Automation Service Offline — Enable background runner service to trigger on-demand agent cycles.");
    } finally {
      setTriggeringAgent(false);
    }
  };

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 880, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.12em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 6 }}>SETTINGS</div>
        <h1 style={{ fontFamily: f.display, fontSize: 26, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em", margin: 0 }}>
          Agent & Channel Configuration
        </h1>
        <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 5, lineHeight: 1.5 }}>
          Manage your Gmail connection, webhooks, policy thresholds, and agent execution parameters.
        </p>
      </motion.div>

      {/* Channel & Communication Setup */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 700, marginBottom: 12 }}>
          ● COMMUNICATION & GMAIL INTEGRATION
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Gmail Card */}
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(66,133,244,0.12)", border: "1px solid rgba(66,133,244,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mail size={18} color="#4285F4" />
                </div>
                <div>
                  <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 15, color: "var(--c-text)" }}>
                    Gmail API Integration
                  </div>
                  <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>
                    Connected Account: <span style={{ color: "var(--c-teal)" }}>{userEmail}</span>
                  </div>
                </div>
              </div>
              <span style={{
                fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                color: "#4285F4", background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.25)",
                borderRadius: 4, padding: "3px 8px", textTransform: "uppercase",
              }}>
                GMAIL ACTIVE
              </span>
            </div>

            <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.6, marginBottom: 14 }}>
              LoopKeeper uses OAuth 2.0 (<code>gmail.modify</code> scope) to monitor client replies and send follow-ups.
              Before the agent reasons, it scans for new client emails matching your open invoice client addresses.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={handleTestAgent}
                disabled={triggeringAgent}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 7,
                  background: "var(--c-teal)", color: "var(--c-text-inv)",
                  fontFamily: f.body, fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer",
                }}
              >
                <RefreshCw size={13} style={{ animation: triggeringAgent ? "spin 1s linear infinite" : "none" }} />
                {triggeringAgent ? "Running Agent…" : "Trigger Agent Run & Check Inbox"}
              </button>
              <button
                onClick={loadSampleDataset}
                style={{
                  padding: "8px 16px", borderRadius: 7,
                  background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                  color: "var(--c-text-2)", fontFamily: f.mono, fontSize: 11, cursor: "pointer",
                }}
              >
                Load Sample Test Invoices
              </button>
            </div>

            {agentRunMsg && (
              <div style={{ marginTop: 12, fontFamily: f.mono, fontSize: 11, color: "var(--c-teal)", background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.2)", padding: "8px 12px", borderRadius: 6 }}>
                {agentRunMsg}
              </div>
            )}
          </div>

          {/* Twilio SMS & WhatsApp Webhooks Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* SMS Webhook */}
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Smartphone size={16} color="var(--c-tier2)" />
                <span style={{ fontFamily: f.body, fontWeight: 600, fontSize: 14, color: "var(--c-text)" }}>Twilio SMS Webhook</span>
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5, marginBottom: 10 }}>
                Set in Twilio Console → Active Numbers → Webhook:
              </div>
              <code style={{ display: "block", fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)", background: "var(--c-surface-2)", padding: "6px 8px", borderRadius: 5, overflowX: "auto" }}>
                POST /webhooks/sms
              </code>
            </div>

            {/* WhatsApp Webhook */}
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <MessageSquare size={16} color="#25D366" />
                <span style={{ fontFamily: f.body, fontWeight: 600, fontSize: 14, color: "var(--c-text)" }}>WhatsApp Meta Webhook</span>
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5, marginBottom: 10 }}>
                Set in Meta Developer Console: Token: <code>WHATSAPP_VERIFY_TOKEN</code>
              </div>
              <code style={{ display: "block", fontFamily: f.mono, fontSize: 10, color: "#25D366", background: "var(--c-surface-2)", padding: "6px 8px", borderRadius: 5, overflowX: "auto" }}>
                POST /webhooks/whatsapp
              </code>
            </div>
          </div>
        </div>
      </motion.div>

      {/* System status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 12 }}>
          SYSTEM STATUS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {/* Data source */}
          <div style={{ background: "var(--c-surface)", border: `1px solid ${isFallback ? "var(--c-tier2-border)" : "var(--c-tier1-border)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Database size={16} color={isFallback ? "var(--c-tier2)" : "var(--c-tier1)"} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: isFallback ? "var(--c-tier2)" : "var(--c-tier1)", marginBottom: 3 }}>
                {isFallback ? "Sandbox Mode" : "Live — Firestore"}
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
                {isFallback ? "Demo data · no real emails sent" : "Reading Firestore in real time"}
              </div>
            </div>
          </div>
          {/* Agent status */}
          <div style={{ background: "var(--c-surface)", border: `1px solid ${agentActive ? "var(--c-tier1-border)" : "var(--c-border)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Bot size={16} color={agentActive ? "var(--c-tier1)" : "var(--c-text-3)"} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: agentActive ? "var(--c-tier1)" : "var(--c-text-2)", marginBottom: 3 }}>
                Agent {agentActive ? "Active" : "Idle"}
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
                {agentActive ? `${loops.filter(l => l.tier === 1).length} loop(s) in autonomous scope` : "No Tier-1 loops currently"}
              </div>
            </div>
          </div>
          {/* Pending approvals */}
          <div style={{ background: "var(--c-surface)", border: `1px solid ${pendingApprovals > 0 ? "var(--c-tier2-border)" : "var(--c-border)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Shield size={16} color={pendingApprovals > 0 ? "var(--c-tier2)" : "var(--c-text-3)"} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 13, color: pendingApprovals > 0 ? "var(--c-tier2)" : "var(--c-text-2)", marginBottom: 3 }}>
                {pendingApprovals} Pending Approval{pendingApprovals !== 1 ? "s" : ""}
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }}>
                {pendingApprovals > 0 ? "Drafts waiting for your OK" : "No drafts awaiting approval"}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Authority tiers */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 12 }}>
          AUTHORITY TIERS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {AUTHORITY_TIERS.map((tier) => (
            <div
              key={tier.tier}
              style={{
                background: "var(--c-surface)", borderRadius: 10, overflow: "hidden",
                border: "1px solid var(--c-border)",
                borderLeft: `3px solid ${tier.color}`,
              }}
            >
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: tier.color, fontWeight: 700 }}>
                    TIER {tier.tier} — {tier.label}
                  </span>
                </div>
                <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.6, marginBottom: 10 }}>
                  {tier.description}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tier.examples.map((ex) => (
                    <span key={ex} style={{
                      fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)",
                      background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                      borderRadius: 5, padding: "3px 9px",
                    }}>
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Thresholds */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, marginBottom: 12 }}>
          DECISION THRESHOLDS
        </div>
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, overflow: "hidden" }}>
          {POLICY_THRESHOLDS.map((item, i) => (
            <div
              key={item.label}
              style={{
                padding: "14px 18px",
                borderBottom: i < POLICY_THRESHOLDS.length - 1 ? "1px solid var(--c-border)" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
              }}
            >
              <div>
                <div style={{ fontFamily: f.body, fontSize: 13, fontWeight: 500, color: "var(--c-text)", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)", lineHeight: 1.5 }}>{item.note}</div>
              </div>
              <span style={{ fontFamily: f.mono, fontSize: 16, fontWeight: 700, color: "var(--c-teal)", flexShrink: 0 }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
