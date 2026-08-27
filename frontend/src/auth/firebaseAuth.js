/**
 * firebaseAuth.js — Firebase Auth helper.
 * Strategy: popup first, redirect fallback on mobile/popup-blocked.
 * All config from VITE_FIREBASE_* env vars — zero hardcoding.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Singleton — safe across hot reloads
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Sign in with Google.
 * • Desktop: popup (instant UX)
 * • Mobile or popup-blocked: redirect (graceful fallback)
 */
export async function signInWithGoogle() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Redirect flow — result picked up on return via checkRedirectResult()
    await signInWithRedirect(auth, googleProvider);
    return null; // page will reload
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (e) {
    // Popup blocked → fall back to redirect
    if (e.code === "auth/popup-blocked" || e.code === "auth/popup-closed-by-user") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw e;
  }
}

/**
 * Call once on app mount — resolves redirect-based Google sign-in.
 * Returns user if a redirect just completed, otherwise null.
 */
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

/** Sign in with email + password. */
export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Create account with name, email, password. */
export async function signUpWithEmail(name, email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  return result.user;
}

/** Sign out. */
export async function signOut() {
  await firebaseSignOut(auth);
}

/** Subscribe to auth state changes. Returns unsubscribe. */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

const rawKey = import.meta.env.VITE_FIREBASE_API_KEY || "";
export const isPlaceholderKey = !rawKey || rawKey.includes("your_") || rawKey.length < 20;

/** True only when valid, non-placeholder Firebase config env vars are set. */
export const isFirebaseConfigured = !!(
  rawKey &&
  !isPlaceholderKey &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !import.meta.env.VITE_FIREBASE_PROJECT_ID.includes("your_")
);
