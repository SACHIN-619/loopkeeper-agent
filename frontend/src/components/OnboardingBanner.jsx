/**
 * OnboardingBanner.jsx — Guided First-Time User Onboarding.
 * Renders a clean 4-step onboarding flow for brand-new authenticated users.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Mail, Plus, Shield, Bot, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { f } from "../theme/tokens.js";

export default function OnboardingBanner({ user, loadSampleDataset }) {
  const steps = [
    {
      num: 1,
      title: "Connect Inbox Permission",
      desc: "Grant OAuth permission to read incoming invoice replies & proofs.",
      icon: Mail,
      color: "#4285F4",
      action: { label: "Configure Gmail", link: "/app/settings" },
    },
    {
      num: 2,
      title: "Add First Invoice",
      desc: "Upload a PDF or enter details for Gemini Vision extraction.",
      icon: Plus,
      color: "var(--c-teal)",
      action: { label: "Add Invoice", link: "/app/add" },
    },
    {
      num: 3,
      title: "Set Authority Rules",
      desc: "Review Tier 1 auto-send vs Tier 2 draft hold thresholds.",
      icon: Shield,
      color: "var(--c-tier2)",
      action: { label: "Review Policy", link: "/app/settings" },
    },
    {
      num: 4,
      title: "Agent Active 24/7",
      desc: "LoopKeeper observes, reasons, and replans while your browser is closed.",
      icon: Bot,
      color: "var(--c-resolved)",
      action: null,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "linear-gradient(135deg, var(--c-surface) 0%, var(--c-surface-2) 100%)",
        border: "1px solid var(--c-teal-border, rgba(0,212,170,0.25))",
        borderRadius: 16,
        padding: "24px 28px",
        marginBottom: 28,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 12, padding: "4px 10px", marginBottom: 8 }}>
            <Sparkles size={13} color="var(--c-teal)" />
            <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-teal)", fontWeight: 700, letterSpacing: "0.08em" }}>
              FIRST-TIME AGENT SETUP
            </span>
          </div>
          <h2 style={{ fontFamily: f.display, fontSize: 22, fontWeight: 600, color: "var(--c-text)", margin: 0, letterSpacing: "-0.01em" }}>
            Welcome to LoopKeeper! Let's activate your agent.
          </h2>
          <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", marginTop: 4, margin: 0 }}>
            Follow these 4 simple steps to let LoopKeeper observe, reason, and track invoice follow-ups autonomously.
          </p>
        </div>

        <button
          onClick={loadSampleDataset}
          style={{
            padding: "9px 16px", borderRadius: 8,
            background: "var(--c-surface-3)", border: "1px solid var(--c-border-bright)",
            color: "var(--c-text-2)", fontFamily: f.mono, fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}
        >
          Load Demo Dataset for Testing
        </button>
      </div>

      {/* 4 Steps Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {steps.map((st) => (
          <div
            key={st.num}
            style={{
              background: "var(--c-surface)",
              border: "1px solid var(--c-border)",
              borderRadius: 12,
              padding: "16px 16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${st.color}15`, border: `1px solid ${st.color}35`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <st.icon size={15} color={st.color} />
                </div>
                <span style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700, color: st.color }}>
                  0{st.num}
                </span>
              </div>

              <div style={{ fontFamily: f.body, fontWeight: 600, fontSize: 14, color: "var(--c-text)", marginBottom: 4 }}>
                {st.title}
              </div>
              <div style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)", lineHeight: 1.5 }}>
                {st.desc}
              </div>
            </div>

            {st.action && (
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--c-border)" }}>
                <Link
                  to={st.action.link}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontFamily: f.mono, fontSize: 10, fontWeight: 700, color: st.color, textDecoration: "none",
                  }}
                >
                  {st.action.label} <ArrowRight size={11} />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
