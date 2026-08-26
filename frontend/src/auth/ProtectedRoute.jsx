/**
 * ProtectedRoute.jsx — Auth guard for /app/* routes.
 * Lets through: signed-in users, demo mode users.
 * Redirects: unauthenticated users → /login.
 * Shows spinner while auth state is loading.
 */
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { f } from "../theme/tokens.js";

export default function ProtectedRoute({ children }) {
  const { user, loading, isDemoMode } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--c-bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2.5px solid var(--c-border)",
          borderTop: "2.5px solid var(--c-teal)",
          animation: "spin 0.8s linear infinite",
        }} />
        <span style={{ fontFamily: f.mono, fontSize: 12, color: "var(--c-text-3)", letterSpacing: "0.06em" }}>
          LOADING…
        </span>
      </div>
    );
  }

  // Allow demo mode
  if (isDemoMode) return children;

  // Allow authenticated users
  if (user) return children;

  // Not authenticated — redirect to login
  return <Navigate to="/login" replace />;
}
