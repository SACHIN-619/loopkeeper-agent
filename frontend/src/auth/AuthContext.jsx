/**
 * AuthContext.jsx — Global auth state provider.
 * Handles: Firebase auth, demo mode, redirect result on mount.
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange, checkRedirectResult, isFirebaseConfigured } from "./firebaseAuth.js";

export const AuthContext = createContext({
  user: null,
  loading: true,
  isDemoMode: false,
  isFirebaseConfigured: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Demo mode: set by "Try Demo" button in Login.jsx
    const demo = sessionStorage.getItem("lk_demo_mode") === "true";
    if (demo) {
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    // Firebase not configured → auto-sandbox
    if (!isFirebaseConfigured) {
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    // Check if we just returned from a Google redirect sign-in
    checkRedirectResult().then((redirectUser) => {
      if (redirectUser) setUser(redirectUser);
    });

    // Subscribe to ongoing auth state
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemoMode, isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}
