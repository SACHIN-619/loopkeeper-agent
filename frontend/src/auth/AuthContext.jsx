/**
 * AuthContext.jsx — Global auth state provider.
 * Handles: Firebase auth, local dev auth, explicit sandbox demo mode.
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange, checkRedirectResult, isFirebaseConfigured, signOut as firebaseSignOut, auth } from "./firebaseAuth.js";

export const AuthContext = createContext({
  user: null,
  loading: true,
  isDemoMode: false,
  isFirebaseConfigured: false,
  loginAsLocalUser: () => {},
  enterDemoMode: () => {},
  exitDemoMode: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [isDemoMode, setIsDemoMode]   = useState(false);

  useEffect(() => {
    // 1. Explicit Sandbox Demo Mode check
    const demo = sessionStorage.getItem("lk_demo_mode") === "true";
    if (demo) {
      setIsDemoMode(true);
      setUser({ uid: "sandbox_demo_user", email: "demo@loopkeeper.ai", displayName: "Demo Account" });
      setLoading(false);
      return;
    }

    // 2. Local Developer Auth check
    const localUserRaw = sessionStorage.getItem("lk_local_user");
    if (localUserRaw) {
      try {
        const parsed = JSON.parse(localUserRaw);
        setUser(parsed);
        setIsDemoMode(false);
        setLoading(false);
        return;
      } catch {}
    }

    // 3. Firebase Auth check if configured
    if (isFirebaseConfigured) {
      checkRedirectResult().then((redirectUser) => {
        if (redirectUser) setUser(redirectUser);
      });

      const unsubscribe = onAuthChange((firebaseUser) => {
        const isDemo = sessionStorage.getItem("lk_demo_mode") === "true";
        if (firebaseUser && !isDemo) {
          setUser(firebaseUser);
          setIsDemoMode(false);
        }
        setLoading(false);
      });

      return unsubscribe;
    }

    // Fallback: unconfigured Firebase defaults to unauthenticated (clean state)
    setLoading(false);
  }, []);

  const loginAsLocalUser = (email = "user@loopkeeper.ai", name = "Authenticated User") => {
    const localUser = { uid: `user_${Date.now()}`, email, displayName: name };
    sessionStorage.setItem("lk_local_user", JSON.stringify(localUser));
    sessionStorage.removeItem("lk_demo_mode");
    setUser(localUser);
    setIsDemoMode(false);
  };

  const enterDemoMode = () => {
    sessionStorage.setItem("lk_demo_mode", "true");
    sessionStorage.removeItem("lk_local_user");
    setUser({ uid: "sandbox_demo_user", email: "demo@loopkeeper.ai", displayName: "Demo Account" });
    setIsDemoMode(true);
  };

  const exitDemoMode = () => {
    sessionStorage.removeItem("lk_demo_mode");
    setIsDemoMode(false);

    if (isFirebaseConfigured && auth.currentUser) {
      setUser(auth.currentUser);
    } else {
      const localUserRaw = sessionStorage.getItem("lk_local_user");
      if (localUserRaw) {
        try {
          setUser(JSON.parse(localUserRaw));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    }
  };

  const logout = async () => {
    sessionStorage.removeItem("lk_demo_mode");
    sessionStorage.removeItem("lk_local_user");
    setUser(null);
    setIsDemoMode(false);
    if (isFirebaseConfigured) {
      try { await firebaseSignOut(); } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, isDemoMode, isFirebaseConfigured,
      loginAsLocalUser, enterDemoMode, exitDemoMode, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
