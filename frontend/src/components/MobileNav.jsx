/**
 * MobileNav.jsx — Bottom navigation bar for mobile screens.
 * Replaces the sidebar when viewport width < 768px.
 * Shown/hidden via CSS media queries defined in index.css.
 */
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, CheckCircle2, Activity, Users } from "lucide-react";
import { f } from "../theme/tokens.js";

const MOBILE_NAV = [
  { to: "/app",           icon: LayoutDashboard, label: "Overview", exact: true },
  { to: "/app/loops",     icon: Inbox,           label: "Loops"                 },
  { to: "/app/approvals", icon: CheckCircle2,    label: "Approve",  badge: true },
  { to: "/app/activity",  icon: Activity,        label: "Activity"              },
  { to: "/app/clients",   icon: Users,           label: "Clients"               },
];

export default function MobileNav({ loops = [] }) {
  const pendingApprovals = loops.filter(l => l.tier === 2 && l.draft).length;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: "var(--c-surface)",
        borderTop: "1px solid var(--c-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 60,
        backdropFilter: "blur(12px)",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
    >
      {MOBILE_NAV.map(({ to, icon: Icon, label, badge, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "6px 12px",
            borderRadius: 10,
            color: isActive ? "var(--c-teal)" : "var(--c-text-3)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "none",
            position: "relative",
            minWidth: 48,
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{ fontFamily: f.mono, fontSize: 9, letterSpacing: "0.05em", fontWeight: isActive ? 700 : 400 }}>
                {label}
              </span>
              {badge && pendingApprovals > 0 && (
                <span style={{
                  position: "absolute",
                  top: 2,
                  right: 6,
                  width: 8, height: 8,
                  background: "var(--c-tier2)",
                  borderRadius: "50%",
                  border: "1.5px solid var(--c-bg)",
                }} />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
