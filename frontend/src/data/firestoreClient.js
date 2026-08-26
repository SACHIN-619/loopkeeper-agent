







import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { annotateLoop } from "./priorityLogic.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
const getApp = () => app || (app = initializeApp(firebaseConfig));

// Exported db singleton for use in AppShell
export const db = (() => {
  try { return getFirestore(getApp()); } catch { return null; }
})();

export function useLiveLoops() {
  const [loops, setLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const fsDb = getFirestore(getApp());
      const q = query(collection(fsDb, "loops"), where("status", "!=", "closed"));
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          setLoops(snap.docs.map((d) => annotateLoop(d.data())));
          setLoading(false);
        },
        (err) => {
          console.error("Firestore onSnapshot error:", err);
          setError(err);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Firestore initialization error:", err);
      setError(err);
      setLoading(false);
    }
    return () => unsubscribe();
  }, []);

  return { loops, loading, error };
}

export function useLiveResolvedLoops() {
  const [resolvedLoops, setResolvedLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const fsDb = getFirestore(getApp());
      const q = query(collection(fsDb, "resolved_loops"), where("status", "==", "closed"));
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          setResolvedLoops(snap.docs.map((d) => annotateLoop(d.data())));
          setLoading(false);
        },
        (err) => {
          console.error("Firestore resolved query error:", err);
          setError(err);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Firestore resolved initialization error:", err);
      setError(err);
      setLoading(false);
    }
    return () => unsubscribe();
  }, []);

  return { resolvedLoops, loading, error };
}

export async function triggerAgentRun(message, { serviceUrl, sessionId = "dashboard" }) {
  const res = await fetch(`${serviceUrl}/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName: "loop_keeper", userId: "dashboard", sessionId, newMessage: { role: "user", parts: [{ text: message }] } }),
  });
  if (!res.ok) throw new Error(`Agent run failed: ${res.status}`);
  return res.json();
}

export async function verifyAndCloseFirestore(loopId, note) {
  const fsDb = getFirestore(getApp());
  const docRef = doc(fsDb, "loops", loopId);
  const today = new Date().toISOString().split("T")[0];
  await updateDoc(docRef, {
    status: "closed",
    exception_type: "resolved",
    unread_reply: false,
    history: arrayUnion({
      date: today,
      event: `VERIFIED & CLOSED: ${note}`
    })
  });
}















