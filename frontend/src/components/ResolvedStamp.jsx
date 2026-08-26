/**
 * ResolvedStamp.jsx — Verified & Resolved badge with spring animation.
 */
import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { c, f } from "../theme/tokens.js";

export default function ResolvedStamp({ visible }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
      animate={visible ? { scale: 1, opacity: 1, rotate: -3 } : { scale: 0.5, opacity: 0, rotate: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        border: `1.5px solid ${c.resolved}`,
        background: c.resolvedBg,
        color: c.resolved,
        fontFamily: f.mono,
        fontWeight: 600,
        fontSize: "11px",
        letterSpacing: "0.1em",
        padding: "5px 12px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
      }}
    >
      <ShieldCheck size={13} strokeWidth={2.5} />
      VERIFIED &amp; RESOLVED
    </motion.div>
  );
}
