/**
 * Login.jsx — Real authentication page.
 * Three modes: Google OAuth, Email/Password sign-in, Email/Password sign-up.
 * Demo bypass: skips auth entirely → sandbox mode.
 * No hardcoded credentials anywhere.
 */
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import { f } from "../theme/tokens.js";
import Logo from "../components/Logo.jsx";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  isFirebaseConfigured,
} from "../auth/firebaseAuth.js";

/* ── Tab config — no hardcoded labels in JSX ──────────── */
const TABS = [
  { id: "signin",  label: "Sign in"  },
  { id: "signup",  label: "Sign up"  },
];

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "10px 14px", borderRadius: 8, marginBottom: 16,
        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      }}
    >
      <AlertCircle size={14} color="var(--c-tier3)" style={{ marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontFamily: f.body, fontSize: 13, color: "var(--c-tier3)", lineHeight: 1.5 }}>{msg}</span>
    </motion.div>
  );
}

function InputRow({ icon: Icon, type, placeholder, value, onChange, onToggle, showToggle }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
      borderRadius: 9, padding: "0 12px", marginBottom: 10,
    }}>
      <Icon size={15} color="var(--c-text-3)" style={{ flexShrink: 0 }} />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          flex: 1, padding: "11px 10px", background: "transparent",
          border: "none", outline: "none",
          fontFamily: f.body, fontSize: 14, color: "var(--c-text)",
        }}
      />
      {showToggle && (
        <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--c-text-3)" }}>
          {type === "password" ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      )}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const clearError = () => setError("");

  /* ── Demo bypass ─────────────────────────────────────── */
  const handleDemo = () => {
    sessionStorage.setItem("lk_demo_mode", "true");
    navigate("/app");
  };

  /* ── Google sign-in ───────────────────────────────────── */
  const handleGoogle = async () => {
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured. Fill in VITE_FIREBASE_* values in frontend/.env to enable Google sign-in.");
      return;
    }
    setLoading(true); clearError();
    try {
      const user = await signInWithGoogle();
      if (user) {
        // Popup succeeded immediately
        navigate("/app");
      }
      // If null → redirect flow started, page will reload — keep spinner
    } catch (e) {
      setError(friendlyError(e));
      setLoading(false);
    }
  };

  /* ── Email sign-in ────────────────────────────────────── */
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { setError("Firebase is not configured. Use Demo mode instead."); return; }
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); clearError();
    try {
      await signInWithEmail(email, password);
      navigate("/app");
    } catch (e) {
      setError(friendlyError(e, "signin"));
    } finally {
      setLoading(false);
    }
  };

  /* ── Email sign-up ────────────────────────────────────── */
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { setError("Firebase is not configured. Use Demo mode instead."); return; }
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email || !password) { setError("Please enter email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); clearError();
    try {
      await signUpWithEmail(name.trim(), email, password);
      navigate("/app");
    } catch (e) {
      setError(friendlyError(e, "signup"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--c-bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)",
        width: 500, height: 300, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,212,170,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%", maxWidth: 420,
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: 16, padding: "36px 32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <Logo size={32} />
        </div>

        {/* Demo button — always first, always most prominent */}
        <motion.button
          onClick={handleDemo}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 20px", borderRadius: 9,
            background: "var(--c-teal)", color: "var(--c-text-inv)",
            fontFamily: f.body, fontWeight: 700, fontSize: 14,
            border: "none", cursor: "pointer",
            boxShadow: "0 0 20px rgba(0,212,170,0.2)",
            marginBottom: 10,
          }}
        >
          <Zap size={14} fill="var(--c-text-inv)" strokeWidth={0} />
          Try Demo — No account needed
          <ArrowRight size={13} />
        </motion.button>
        <div style={{ fontFamily: f.body, fontSize: 11, color: "var(--c-text-3)", textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
          Explores with realistic invoice scenarios. No real emails sent.
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--c-border)" }} />
          <span style={{ fontFamily: f.mono, fontSize: 10, color: "var(--c-text-3)" }}>OR SIGN IN WITH YOUR ACCOUNT</span>
          <div style={{ flex: 1, height: 1, background: "var(--c-border)" }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "11px 20px", borderRadius: 9,
            background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
            color: "var(--c-text)", fontFamily: f.body, fontSize: 14, fontWeight: 500,
            cursor: loading ? "default" : "pointer", marginBottom: 16,
            opacity: loading ? 0.7 : 1, transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Tab: Sign in / Sign up */}
        <div style={{ display: "flex", background: "var(--c-surface-2)", borderRadius: 9, padding: 3, marginBottom: 16 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); clearError(); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7,
                background: tab === t.id ? "var(--c-surface-3)" : "transparent",
                border: "none", cursor: "pointer",
                fontFamily: f.body, fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? "var(--c-text)" : "var(--c-text-3)",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ErrorBanner msg={error} />

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={tab}
            initial={{ opacity: 0, x: tab === "signin" ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "signin" ? 12 : -12 }}
            transition={{ duration: 0.2 }}
            onSubmit={tab === "signin" ? handleEmailSignIn : handleEmailSignUp}
          >
            {tab === "signup" && (
              <InputRow
                icon={User} type="text" placeholder="Your name"
                value={name} onChange={e => setName(e.target.value)}
              />
            )}
            <InputRow
              icon={Mail} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <InputRow
              icon={Lock}
              type={showPw ? "text" : "password"}
              placeholder={tab === "signup" ? "Create password (min 6 chars)" : "Password"}
              value={password} onChange={e => setPassword(e.target.value)}
              showToggle onToggle={() => setShowPw(v => !v)}
            />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                width: "100%", padding: "12px", borderRadius: 9, marginTop: 4,
                background: loading ? "var(--c-text-3)" : "var(--c-surface-3)",
                border: "1px solid var(--c-border-bright)",
                color: "var(--c-text)", fontFamily: f.body, fontWeight: 600, fontSize: 14,
                cursor: loading ? "default" : "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--c-border)", borderTop: "2px solid var(--c-teal)", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  {tab === "signin" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                <>
                  {tab === "signin" ? "Sign in with email" : "Create account"}
                  <ArrowRight size={14} />
                </>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link to="/" style={{ fontFamily: f.body, fontSize: 12, color: "var(--c-text-3)" }}>
            ← Back to overview
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Firebase error → human message ────────────────────── */
function friendlyError(e, mode = "signin") {
  const code = e?.code || "";
  // user-not-found: distinguish sign-in (suggest sign up) vs sign-up
  if (code.includes("api-key-not-valid") || code.includes("invalid-api-key") || e?.message?.includes("api-key-not-valid"))
    return "Firebase API Key is invalid or not enabled for Authentication in Firebase Console. Please check VITE_FIREBASE_API_KEY in frontend/.env or click 'Try Demo' above to test offline.";
  if (code.includes("user-not-found"))
    return mode === "signin"
      ? "No account found with this email. Switch to Sign up above to create one."
      : "Something went wrong creating your account. Please try again.";
  if (code.includes("wrong-password"))
    return "Incorrect password. Please try again or reset your password.";
  if (code.includes("invalid-credential"))
    return "Email or password is incorrect.";
  if (code.includes("email-already-in-use"))
    return "An account with this email already exists — switch to Sign in above.";
  if (code.includes("weak-password"))
    return "Password must be at least 6 characters.";
  if (code.includes("invalid-email"))
    return "Please enter a valid email address.";
  if (code.includes("popup-closed"))
    return "Sign-in window was closed. Please try again.";
  if (code.includes("network-request-failed"))
    return "Network error. Check your connection and try again.";
  if (code.includes("unauthorized-domain"))
    return "This domain isn't authorized for Google sign-in. In Firebase Console → Authentication → Settings → Authorised domains, add 'localhost'.";
  if (code.includes("configuration-not-found") || code.includes("operation-not-allowed"))
    return "Google Sign-in is disabled. Go to Firebase Console → Authentication → Sign-in method → click Google → toggle Enable → select a support email → Save.";
  return e?.message || "Something went wrong. Please try again.";
}
