/**
 * MetricCard.jsx — Interactive animated stat card for the dashboard header.
 * Enhanced with hover animations, tooltips, and click-navigation.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { c, f } from "../theme/tokens.js";

// Tooltip & Navigation lookup dictionary for metrics
const METRIC_INFO = {
  "Outstanding":    { to: "/app/loops",     tooltip: "Total value of all open invoices currently being tracked by LoopKeeper" },
  "Open Loops":     { to: "/app/loops",     tooltip: "Click to view all active invoices currently in monitoring" },
  "Agent Handling": { to: "/app/loops",     tooltip: "Invoices being handled autonomously under Tier-1 authority" },
  "Need Approval":  { to: "/app/approvals", tooltip: "Click to view Tier-2 drafts waiting for your one-tap OK" },
  "Needs You":      { to: "/app/loops",     tooltip: "Tier-3 high-value or disputed invoices requiring your direct attention" },
  "Resolved":       { to: "/app/activity",  tooltip: "Click to view all closed and payment-verified invoices" },
};

function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = target;
    const tick = (now) => {
      const pct = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(from + (to - from) * ease));
      if (pct < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return value;
}

export default function MetricCard({ label, value, unit = "", accent, icon: Icon, index = 0, onClick, to }) {
  const navigate = useNavigate();
  const isMonetary = unit === "$";
  const displayNum = typeof value === "number" ? value : 0;
  const animated = useCountUp(displayNum, 900 + index * 80);

  const info = METRIC_INFO[label] || {};
  const destination = to || info.to;
  const tooltipText = info.tooltip || `Click to inspect ${label.toLowerCase()}`;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (destination) {
      navigate(destination);
    }
  };

  const displayValue = isMonetary
    ? `$${animated.toLocaleString("en-US")}`
    : String(animated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={handleClick}
      title={tooltipText}
      style={{
        background: "var(--c-surface)",
        border: `1px solid ${accent ?? "var(--c-border)"}`,
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
        cursor: destination || onClick ? "pointer" : "default",
      }}
    >
      {/* Subtle top glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accent
            ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
            : "transparent",
          opacity: 0.8,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.1em", color: "var(--c-text-3)", fontWeight: 600, textTransform: "uppercase" }}>
          {label}
        </span>
        {Icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: accent ? `${accent}18` : "var(--c-surface-2)",
              border: `1px solid ${accent ?? "var(--c-border)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={14} color={accent ?? "var(--c-text-2)"} strokeWidth={2} />
          </div>
        )}
      </div>

      <span
        style={{
          fontFamily: f.display,
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: accent ?? "var(--c-text)",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </span>

      {unit && unit !== "$" && (
        <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-text-3)" }}>
          {unit}
        </span>
      )}
    </motion.div>
  );
}
