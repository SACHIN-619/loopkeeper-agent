/**
 * Home.jsx — Public landing page.
 * Features: Framer Motion reveals, official SVG Logo,
 * Video showcase (invoiceGeneration.mp4), and Showcase Banner (Horizonalbanner.jpg).
 */
import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Zap, Bot, CheckCircle2, AlertTriangle, Shield, Clock, Play } from "lucide-react";
import { c, f } from "../theme/tokens.js";
import Logo from "../components/Logo.jsx";

const FLOW_STEPS = [
  { icon: AlertTriangle, label: "Invoice overdue",        color: "var(--c-tier3)" },
  { icon: Bot,           label: "Agent detects & reasons", color: "var(--c-teal)"  },
  { icon: Clock,         label: "Priority calculated",    color: "var(--c-tier2)" },
  { icon: Zap,           label: "Action taken or held",   color: "var(--c-tier1)" },
  { icon: CheckCircle2,  label: "Evidence received",      color: "var(--c-teal)"  },
  { icon: Shield,        label: "Verified & resolved",    color: "var(--c-resolved)" },
];

const FEATURE_CARDS = [
  {
    icon: Bot,
    title: "Autonomous agent",
    body: "Detects overdue invoices, calculates priority, selects action — without you lifting a finger.",
    accent: "var(--c-tier1)",
  },
  {
    icon: Shield,
    title: "Three-tier authority",
    body: "Small invoices? Agent sends. Large or disputed? Held for your one-tap approval. Tier 3 escalations? Never auto-sent.",
    accent: "var(--c-tier2)",
  },
  {
    icon: CheckCircle2,
    title: "Evidence-gated resolution",
    body: "Invoices can only close when real payment evidence exists. The agent cannot fake a resolution.",
    accent: "var(--c-resolved)",
  },
];

const STAT_ITEMS = [
  { value: "0", label: "Manual follow-up emails you write" },
  { value: "3", label: "Authority tiers — Agent, Approval, You" },
  { value: "100%", label: "Agentic — runs while you sleep" },
];

function RevealSection({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", overflowX: "hidden" }}>

      {/* Top nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 64,
        background: "rgba(10,13,18,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--c-border)",
      }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Logo size={28} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to="/login"
            style={{
              padding: "7px 18px", borderRadius: 7,
              background: "transparent",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-2)", fontSize: 13, fontFamily: f.body,
              transition: "all 0.15s",
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
          <Link
            to="/app"
            style={{
              padding: "7px 18px", borderRadius: 7,
              background: "var(--c-teal)",
              color: "var(--c-text-inv)", fontSize: 13, fontFamily: f.body, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
              textDecoration: "none",
            }}
          >
            Try Demo <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero Section with Ambient Video Background */}
      <section style={{
        position: "relative", minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", padding: "100px 40px 80px", borderBottom: "1px solid var(--c-border)",
      }}>
        {/* Full Background Video */}
        <video
          src="/invoiceGeneration.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
            opacity: 0.38,
            filter: "brightness(0.65) contrast(1.15)",
          }}
        />

        {/* Dark radial overlay for text contrast */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(10,13,18,0.65) 0%, rgba(10,13,18,0.95) 85%)",
          zIndex: 1,
        }} />

        {/* Hero Content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(0,212,170,0.12)", border: "1px solid rgba(0,212,170,0.3)",
              borderRadius: 20, padding: "6px 16px", marginBottom: 28,
              boxShadow: "0 0 20px rgba(0,212,170,0.15)",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-teal)", animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-teal)", letterSpacing: "0.08em", fontWeight: 700 }}>
                ALL THINGS AGENTIC HACKATHON 2026
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: f.display,
              fontSize: "clamp(42px, 7.5vw, 76px)",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#FFFFFF",
              marginBottom: 24,
              textShadow: "0 4px 30px rgba(0,0,0,0.8)",
            }}
          >
            Your invoices<br />
            <span className="gradient-text">don't need a human</span><br />
            to remember them.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontFamily: f.body, fontSize: 19, color: "var(--c-text-2)", lineHeight: 1.7, maxWidth: 660, margin: "0 auto 40px", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}
          >
            LoopKeeper is an autonomous financial follow-up agent that owns
            every unresolved invoice — from detection through controlled action
            through verified resolution.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link
              to="/app"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 32px", borderRadius: 10,
                background: "var(--c-teal)",
                color: "var(--c-text-inv)", fontFamily: f.body, fontWeight: 700, fontSize: 16,
                boxShadow: "0 0 40px rgba(0,212,170,0.35)",
                transition: "all 0.2s", textDecoration: "none",
              }}
            >
              See it in action <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 32px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#FFFFFF", fontFamily: f.body, fontWeight: 600, fontSize: 16,
                transition: "all 0.2s", textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Flow diagram */}
      <section style={{ padding: "60px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
        <RevealSection>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>
              THE LOOP
            </div>
            <h2 style={{ fontFamily: f.display, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--c-text)" }}>
              One continuous closed loop
            </h2>
          </div>
        </RevealSection>

        <RevealSection delay={0.1}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
            {FLOW_STEPS.map((step, i) => (
              <React.Fragment key={step.label}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 20px" }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 16px ${step.color}20`,
                  }}>
                    <step.icon size={22} color={step.color} strokeWidth={1.8} />
                  </div>
                  <span style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-2)", textAlign: "center", maxWidth: 80, lineHeight: 1.4 }}>
                    {step.label}
                  </span>
                </motion.div>
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{ color: "var(--c-text-3)", fontSize: 18, padding: "0 4px" }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Showcase Horizontal Banner — Horizonalbanner.jpg */}
      <section style={{ padding: "40px 40px 80px", maxWidth: 1060, margin: "0 auto" }}>
        <RevealSection>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-teal)", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 10 }}>
              ● COMMAND CENTER INTERFACE
            </div>
            <h2 style={{ fontFamily: f.display, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--c-text)" }}>
              Full visibility over every collection loop
            </h2>
          </div>
          <div style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--c-border-bright)",
            boxShadow: "0 16px 50px rgba(0,0,0,0.4), 0 0 30px rgba(0,212,170,0.1)",
          }}>
            <img
              src="/Horizonalbanner.jpg"
              alt="LoopKeeper Command Center Banner"
              style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
            />
          </div>
        </RevealSection>
      </section>

      {/* Feature cards */}
      <section style={{ padding: "40px 40px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <RevealSection>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: f.display, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--c-text)" }}>
              Built on three principles
            </h2>
          </div>
        </RevealSection>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {FEATURE_CARDS.map((card, i) => (
            <RevealSection key={card.title} delay={i * 0.1}>
              <div style={{
                background: "var(--c-surface)", border: "1px solid var(--c-border)",
                borderRadius: 14, padding: "28px 24px",
                borderTop: `2px solid ${card.accent}`,
                height: "100%",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: `${card.accent}15`, border: `1px solid ${card.accent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                }}>
                  <card.icon size={20} color={card.accent} strokeWidth={1.8} />
                </div>
                <h3 style={{ fontFamily: f.display, fontSize: 20, fontWeight: 500, color: "var(--c-text)", marginBottom: 10, letterSpacing: "-0.01em" }}>
                  {card.title}
                </h3>
                <p style={{ fontFamily: f.body, fontSize: 14, color: "var(--c-text-2)", lineHeight: 1.7 }}>
                  {card.body}
                </p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "40px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
        <RevealSection>
          <div style={{
            background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16,
            padding: "40px",
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, textAlign: "center",
          }}>
            {STAT_ITEMS.map((stat, i) => (
              <div key={stat.label} style={{ padding: "0 16px", borderRight: i < STAT_ITEMS.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                <div style={{ fontFamily: f.display, fontSize: 42, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--c-teal)", marginBottom: 8 }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.5 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* CTA */}
      <section style={{ padding: "60px 40px 100px", textAlign: "center" }}>
        <RevealSection>
          <h2 style={{ fontFamily: f.display, fontSize: 40, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--c-text)", marginBottom: 20 }}>
            See the agent work.
          </h2>
          <p style={{ fontFamily: f.body, fontSize: 16, color: "var(--c-text-2)", marginBottom: 32 }}>
            No sign-up required — explore the live demo with realistic invoice scenarios.
          </p>
          <Link
            to="/app"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 10,
              background: "var(--c-teal)", color: "var(--c-text-inv)",
              fontFamily: f.body, fontWeight: 700, fontSize: 16,
              boxShadow: "0 0 40px rgba(0,212,170,0.3)",
              transition: "all 0.2s", textDecoration: "none",
            }}
          >
            Open Command Center <ArrowRight size={16} />
          </Link>
        </RevealSection>
      </section>

      {/* Enhanced Modern Footer */}
      <footer style={{
        borderTop: "1px solid var(--c-border-bright)",
        background: "linear-gradient(180deg, var(--c-bg) 0%, rgba(10,13,18,0.98) 100%)",
        padding: "60px 40px 32px",
        marginTop: 40,
        position: "relative",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 40,
            marginBottom: 48,
          }}>
            {/* Column 1: Brand & Tagline */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Logo size={26} />
              <p style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.6, margin: 0 }}>
                Autonomous financial follow-up agent. Owns every unpaid invoice from detection through verified resolution.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--c-resolved)",
                  boxShadow: "0 0 10px var(--c-resolved)",
                  display: "inline-block"
                }} />
                <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-2)", fontWeight: 600 }}>
                  Agent Service Active & Operational
                </span>
              </div>
            </div>

            {/* Column 2: Product & App Navigation */}
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 700, marginBottom: 16 }}>
                PRODUCT & NAVIGATION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Link to="/app" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Command Center</Link>
                <Link to="/app/loops" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Open Loops Registry</Link>
                <Link to="/app/approvals" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Approvals Queue (Tier 2)</Link>
                <Link to="/app/activity" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Activity & Run Logs</Link>
                <Link to="/app/clients" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Client Relationship Memory</Link>
                <Link to="/app/add-invoice" style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)", textDecoration: "none", transition: "color 0.15s" }}>Track New Invoice</Link>
              </div>
            </div>

            {/* Column 3: Safety & Architecture */}
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 700, marginBottom: 16 }}>
                SAFETY & ARCHITECTURE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)" }}>Deterministic Authority Tiers (1, 2, 3)</span>
                <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)" }}>Evidence-Gated Resolution</span>
                <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)" }}>Gemini Vision Invoice Ingestion</span>
                <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)" }}>Multi-channel Webhooks (Gmail, SMS, WA)</span>
                <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-text-2)" }}>Multi-tenant Firestore / JSON Engine</span>
              </div>
            </div>

            {/* Column 4: Technology Stack */}
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-teal)", fontWeight: 700, marginBottom: 16 }}>
                POWERED BY
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Google ADK", "Gemini 2.5 Flash", "React 18", "Flask Gateway", "Firebase Auth", "Firestore", "Render"].map(tech => (
                  <span key={tech} style={{
                    fontFamily: f.mono, fontSize: 10, fontWeight: 600,
                    background: "var(--c-surface-2)", border: "1px solid var(--c-border-bright)",
                    borderRadius: 4, padding: "4px 8px", color: "var(--c-text-2)",
                  }}>
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div style={{
            borderTop: "1px solid var(--c-border)", paddingTop: 24,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
          }}>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>
              © 2026 LoopKeeper Agent · All Things Agentic Hackathon
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Link to="/login" style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", textDecoration: "none" }}>Sign In</Link>
              <Link to="/app/settings" style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)", textDecoration: "none" }}>Settings</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
