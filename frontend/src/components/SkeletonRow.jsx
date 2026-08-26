/**
 * SkeletonRow.jsx — Shimmer skeleton placeholder for loading states.
 * Matches the LoopRow grid structure.
 */
import React from "react";
import { motion } from "framer-motion";

export default function SkeletonRow({ index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        borderRadius: 10,
        padding: "18px 20px",
        display: "grid",
        gridTemplateColumns: "1fr 120px 90px 130px",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Name col */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ height: 14, width: "55%", borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 11, width: "35%", borderRadius: 4 }} />
      </div>
      {/* Amount */}
      <div className="skeleton" style={{ height: 20, width: "60%", borderRadius: 4 }} />
      {/* Days */}
      <div className="skeleton" style={{ height: 14, width: "50%", borderRadius: 4 }} />
      {/* Stamp */}
      <div className="skeleton" style={{ height: 24, width: "80%", borderRadius: 4 }} />
    </motion.div>
  );
}
