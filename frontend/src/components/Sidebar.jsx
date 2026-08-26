/**
 * Sidebar.jsx — Collapsible navigation sidebar.
 * Nav items driven by config array — no hardcoded labels in JSX.
 * Includes: user avatar/name, "+ Add Invoice" CTA, sign-out.
 */
import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Inbox, CheckCircle2, Activity,
  Users, Settings, ChevronLeft, ChevronRight, Zap,
  Plus, LogOut,
} from "lucide-react";
import { f } from "../theme/tokens.js";
import { LogoIcon } from "./Logo.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { signOut, isFirebaseConfigured } from "../auth/firebaseAuth.js";

const NAV_ITEMS = [
  { to: "/app",           icon: LayoutDashboard, label: "Command Center", exact: true },
  { to: "/app/loops",     icon: Inbox,           label: "Open Loops"                  },
  { to: "/app/approvals", icon: CheckCircle2,    label: "Approvals",      badge: true },
  { to: "/app/activity",  icon: Activity,        label: "Activity Feed"               },
  { to: "/app/clients",   icon: Users,           label: "Clients"                     },
  { to: "/app/settings",  icon: Settings,        label: "Settings"                    },
];

export default function Sidebar({ loops = [], isSandbox = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();

  // Sidebar is open if either user has not collapsed it OR is hovering while minimized
  const isExpanded = !collapsed || isHovered;

  const pendingApprovals = loops.filter(l => l.tier === 2 && l.draft && !l.approved).length;
  const agentActive      = loops.some(l => l.tier === 1 && !l.status?.includes("resolved"));

  const displayName  = user?.displayName || user?.email?.split("@")[0] || "Demo user";
  const displayEmail = user?.email || "sandbox mode";
  const avatarLetter = displayName[0]?.toUpperCase() || "L";

  const handleSignOut = async () => {
    if (isFirebaseConfigured && !isDemoMode) {
      await signOut();
    }
    sessionStorage.removeItem("lk_demo_mode");
    navigate("/login");
  };

  return (
    <motion.aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={{
        width: isExpanded ? 240 : 64,
        boxShadow: (collapsed && isHovered) ? "0 10px 30px rgba(0,0,0,0.5)" : "none",
      }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 60,
        background: "var(--c-surface)", borderRight: "1px solid var(--c-border)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Logo row */}
      <div style={{
        height: 56, display: "flex", alignItems: "center",
        padding: !isExpanded ? "0 18px" : "0 20px",
        borderBottom: "1px solid var(--c-border)", gap: 10, flexShrink: 0,
      }}>
        <LogoIcon size={28} />
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              style={{ fontFamily: f.display, fontSize: 17, fontWeight: 600, color: "var(--c-text)", letterSpacing: "-0.025em" }}
            >
              LoopKeeper
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Agent status pill */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            title={agentActive ? "Agent is actively monitoring open loops" : "Agent is idle — all loops monitored"}
            style={{
              margin: "12px 12px 4px", padding: "8px 12px", borderRadius: 8,
              background: agentActive ? "rgba(0,212,170,0.06)" : "rgba(90,100,121,0.08)",
              border: `1px solid ${agentActive ? "rgba(0,212,170,0.2)" : "var(--c-border)"}`,
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            }}
            onClick={() => navigate("/app/activity")}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: agentActive ? "var(--c-teal)" : "var(--c-text-3)",
              animation: agentActive ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", fontWeight: 600, color: agentActive ? "var(--c-teal)" : "var(--c-text-3)" }}>
              {agentActive ? "AGENT ACTIVE" : "AGENT IDLE"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "+ Add Invoice" CTA */}
      <div style={{ padding: "6px 8px 2px", flexShrink: 0 }}>
        <NavLink
          to="/app/add"
          style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 10,
            padding: !isExpanded ? "10px 18px" : "9px 12px",
            borderRadius: 8, textDecoration: "none",
            background: isActive ? "var(--c-teal-glow)" : "rgba(0,212,170,0.07)",
            border: `1px solid ${isActive ? "var(--c-teal-border, rgba(0,212,170,0.15))" : "rgba(0,212,170,0.15)"}`,
            color: "var(--c-teal)", transition: "all 0.15s",
            justifyContent: !isExpanded ? "center" : "flex-start",
          })}
          title="Add a new invoice manually or upload PDF/image"
        >
          <Plus size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.16 }}
                style={{ fontSize: 13, fontWeight: 600, fontFamily: f.body }}
              >
                Add Invoice
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            title={`${label} — Click to view page`}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 12,
              padding: !isExpanded ? "10px 18px" : "9px 12px",
              borderRadius: 8, textDecoration: "none",
              color: isActive ? "var(--c-teal)" : "var(--c-text-2)",
              background: isActive ? "var(--c-teal-glow)" : "transparent",
              border: isActive ? "1px solid var(--c-teal-border, rgba(0,212,170,0.15))" : "1px solid transparent",
              transition: "all 0.15s ease", cursor: "pointer", position: "relative",
              flexShrink: 0,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2 : 1.8} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.16 }}
                      style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1, fontFamily: f.body }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {badge && pendingApprovals > 0 && isExpanded && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{
                      background: "var(--c-tier2)", color: "#000",
                      fontSize: 10, fontWeight: 700, borderRadius: 10,
                      padding: "1px 6px", minWidth: 18, textAlign: "center", fontFamily: f.mono,
                    }}
                  >
                    {pendingApprovals}
                  </motion.span>
                )}
                {badge && pendingApprovals > 0 && !isExpanded && (
                  <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "var(--c-tier2)", borderRadius: "50%" }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User row + sign out */}
      <div style={{ borderTop: "1px solid var(--c-border)", padding: "10px 8px", flexShrink: 0 }}>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6 }}
            >
              {/* Avatar */}
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: isSandbox ? "rgba(245,158,11,0.15)" : "linear-gradient(135deg, var(--c-teal), #6EE7DF)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.body, fontSize: 13, fontWeight: 700,
                color: isSandbox ? "var(--c-tier2)" : "var(--c-text-inv)",
                overflow: "hidden",
              }}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                ) : avatarLetter}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: f.body, fontSize: 12, fontWeight: 600, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isDemoMode ? "Demo mode" : displayName}
                </div>
                <div style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isDemoMode ? "no account" : displayEmail}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sandbox badge */}
        <AnimatePresence>
          {isSandbox && isExpanded && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                margin: "0 4px 6px",
                padding: "5px 10px", borderRadius: 6,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-tier2)", animation: "pulse 2s infinite", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "var(--c-tier2)", fontFamily: f.mono, letterSpacing: "0.07em", fontWeight: 600 }}>
                SANDBOX MODE
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Sign out / exit demo mode"
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: !isExpanded ? "10px 18px" : "9px 12px",
            borderRadius: 8, background: "transparent",
            border: "1px solid transparent", cursor: "pointer",
            color: "var(--c-text-3)", transition: "all 0.15s",
            justifyContent: !isExpanded ? "center" : "flex-start",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; e.currentTarget.style.color = "var(--c-tier3)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.borderColor = "transparent"; }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontFamily: f.body, fontSize: 13 }}
              >
                {isDemoMode ? "Exit demo" : "Sign out"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{
            width: "100%", height: 34, borderRadius: 8,
            background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
            color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, cursor: "pointer", fontSize: 12, transition: "all 0.15s", marginTop: 4,
          }}
          title={collapsed ? "Lock expanded sidebar" : "Minimize sidebar to icons"}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span style={{ fontFamily: f.body }}>Collapse</span></>}
        </button>
      </div>
    </motion.aside>
  );
}
