/**
 * Logo.jsx — Official LoopKeeper logo icon and logotype.
 * Replaces generic icons with the circular aperture checkmark design.
 */
import React from "react";
import { f } from "../theme/tokens.js";

export function LogoIcon({ size = 28, variant = "default" }) {
  const isTile = variant === "tile";
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="goldCheckGrad" x1="20%" y1="80%" x2="80%" y2="20%">
          <stop offset="0%" stopColor="#C4A462" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#E5C158" />
        </linearGradient>
      </defs>

      {/* Optional dark tile background */}
      {isTile && (
        <rect width="100" height="100" rx="24" fill="#0B2B26" />
      )}

      {/* Swirling aperture ring arcs */}
      <g stroke={isTile ? "#FFFFFF" : "var(--c-teal)"} strokeWidth="6" strokeLinecap="round" opacity="0.95">
        <path d="M 50 14 A 36 36 0 0 1 84 38 C 70 44 58 40 50 34" />
        <path d="M 86 50 A 36 36 0 0 1 62 84 C 56 70 60 58 66 50" />
        <path d="M 50 86 A 36 36 0 0 1 16 62 C 30 56 42 60 50 66" />
        <path d="M 14 50 A 36 36 0 0 1 38 16 C 44 30 40 42 34 50" />
      </g>

      {/* Outer circular track */}
      <circle
        cx="50"
        cy="50"
        r="37"
        stroke={isTile ? "#FFFFFF" : "var(--c-teal)"}
        strokeWidth="5"
        fill="none"
        opacity="0.8"
      />

      {/* Signature Checkmark */}
      <path
        d="M 31 52 L 45 66 L 77 31"
        stroke="url(#goldCheckGrad)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 28, showText = true, textStyle = {}, variant = "default" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoIcon size={size} variant={variant} />
      {showText && (
        <span
          style={{
            fontFamily: f.display,
            fontSize: size * 0.65,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "var(--c-text)",
            ...textStyle,
          }}
        >
          LoopKeeper
        </span>
      )}
    </div>
  );
}

export default Logo;
