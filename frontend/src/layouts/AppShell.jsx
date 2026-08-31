/**
 * AppShell.jsx — Main layout wrapper with sidebar + mobile nav.
 * Single default export only — satisfies React Fast Refresh.
 * AppContext lives in src/contexts/AppContext.js.
 */
import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "../data/firestoreClient.js";
import { LOOPS, RESOLVED_LOOPS, CLIENTS } from "../data/mockData.js";
import { annotateLoop } from "../data/priorityLogic.js";
import { AppContext } from "../contexts/AppContext.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import MobileNav from "../components/MobileNav.jsx";
import { f } from "../theme/tokens.js";

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

export default function AppShell() {
  const [loops, setLoops]               = useState([]);
  const [resolvedLoops, setResolvedLoops] = useState([]);
  const [isFallback, setIsFallback]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [firestoreError, setFirestoreError] = useState(null);
  const [localApprovals, setLocalApprovals] = useState({});
  const isMobile    = useIsMobile();
  const { isDemoMode } = useAuth();

  // Pick up invoices added via AddInvoice form
  useEffect(() => {
    const handler = (e) => {
      const newLoop = e.detail;
      setLoops((prev) => {
        const merged = [newLoop, ...prev.filter(l => l.loop_id !== newLoop.loop_id)];
        return merged.sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
      });
    };
    window.addEventListener("lk:add-loop", handler);
    return () => window.removeEventListener("lk:add-loop", handler);
  }, []);

  // Data source: sandbox in demo mode, real user data in live mode
  useEffect(() => {
    const wantSample = sessionStorage.getItem("lk_load_sample_data") === "true";
    if (isDemoMode || wantSample) {
      setLoops(LOOPS);
      setResolvedLoops(RESOLVED_LOOPS);
      setIsFallback(true);
      setLoading(false);
      return;
    }

    // Real Authenticated User Mode — Do NOT pollute with mock data
    setIsFallback(false);

    if (!db) {
      // Real user with no Firestore connection starts with clean state (or locally added items)
      setLoops((prev) => prev.filter(l => !LOOPS.some(m => m.loop_id === l.loop_id)));
      setResolvedLoops([]);
      setLoading(false);
      return;
    }

    let unsubLoops, unsubResolved;
    try {
      unsubLoops = onSnapshot(
        collection(db, "loops"),
        (snap) => {
          const raw  = snap.docs.map((d) => annotateLoop({ loop_id: d.id, ...d.data() }));
          const open = raw
            .filter((l) => l.status !== "closed" && l.status !== "resolved")
            .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
          setLoops(open);
          setLoading(false);
          setFirestoreError(null);
        },
        (err) => {
          console.warn("Firestore listener warning:", err);
          setLoading(false);
          setFirestoreError(err.message);
        }
      );

      unsubResolved = onSnapshot(
        collection(db, "resolved_loops"),
        (snap) => setResolvedLoops(snap.docs.map((d) => ({ loop_id: d.id, ...d.data() }))),
        () => {}
      );
    } catch (err) {
      console.warn("Firestore error:", err);
      setLoading(false);
    }

    return () => {
      unsubLoops?.();
      unsubResolved?.();
    };
  }, [isDemoMode]);

  const handleVerifyAndClose = async (loopId, note) => {
    if (isFallback) {
      setLoops((prev) => prev.map((l) => l.loop_id === loopId ? { ...l, status: "closed", verify_note: note } : l));
      const loop = loops.find((l) => l.loop_id === loopId);
      if (loop) setResolvedLoops((prev) => [...prev, { ...loop, status: "closed", verify_note: note }]);
    } else {
      const serviceUrl = import.meta.env.VITE_CLOUD_RUN_URL;
      if (serviceUrl) {
        await fetch(`${serviceUrl}/verify_close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loop_id: loopId, note }),
        });
      }
    }
  };

  const handleActionCompleted = (loopId, action) => {
    try { sessionStorage.setItem(`approved_${loopId}`, "true"); } catch {}
    setLocalApprovals((prev) => ({ ...prev, [loopId]: action }));
    setLoops((prev) =>
      prev.map((l) =>
        l.loop_id === loopId
          ? {
              ...l,
              approved: true,
              tier: 1,
              draft: null,
              pending_draft: null,
              status: "sent",
              history: [
                ...(l.history || []),
                { date: new Date().toISOString().split("T")[0], event: "Approved & sent by user" },
              ],
            }
          : l
      )
    );
  };

  const loadSampleDataset = () => {
    sessionStorage.setItem("lk_load_sample_data", "true");
    setLoops(LOOPS);
    setResolvedLoops(RESOLVED_LOOPS);
    setIsFallback(true);
  };

  const clearSampleDataset = () => {
    sessionStorage.removeItem("lk_load_sample_data");
    sessionStorage.removeItem("lk_demo_mode");
    setIsFallback(false);
    window.location.reload();
  };

  const activeClients = isDemoMode ? CLIENTS : {};

  return (
    <AppContext.Provider value={{
      loops, resolvedLoops, clients: activeClients,
      isFallback, loading, firestoreError, localApprovals,
      onVerifyAndClose: handleVerifyAndClose,
      onActionCompleted: handleActionCompleted,
      loadSampleDataset, clearSampleDataset,
    }}>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--c-bg)" }}>

        {!isMobile && <Sidebar loops={loops} isSandbox={isFallback} />}

        <main style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 240,
          minHeight: "100vh",
          paddingBottom: isMobile ? 68 : 0,
          transition: "margin-left 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex", flexDirection: "column",
        }}>

          {/* Mobile top bar */}
          {isMobile && (
            <div style={{
              height: 52, display: "flex", alignItems: "center",
              padding: "0 16px", borderBottom: "1px solid var(--c-border)",
              background: "var(--c-surface)", gap: 10, flexShrink: 0,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: "linear-gradient(135deg, var(--c-teal), #6EE7DF)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 13, color: "var(--c-text-inv)" }}>⚡</span>
              </div>
              <span style={{ fontFamily: f.display, fontSize: 16, fontWeight: 500, color: "var(--c-text)", letterSpacing: "-0.02em" }}>
                LoopKeeper
              </span>
              {isFallback && (
                <span style={{ fontFamily: f.mono, fontSize: 9, color: "var(--c-tier2)", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4, padding: "2px 6px", marginLeft: "auto", letterSpacing: "0.06em", fontWeight: 600 }}>
                  SANDBOX
                </span>
              )}
            </div>
          )}

          {/* Desktop sandbox banner */}
          {!isMobile && isFallback && (
            <div style={{
              height: 36, background: "rgba(245,158,11,0.08)",
              borderBottom: "1px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-tier2)", animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: f.mono, fontSize: 11, color: "var(--c-tier2)", letterSpacing: "0.06em", fontWeight: 600 }}>
                SANDBOX MODE — No real emails will be sent · Using demo invoice data
              </span>
            </div>
          )}

          {firestoreError && (
            <div style={{ padding: "8px 20px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)", fontFamily: f.mono, fontSize: 11, color: "var(--c-tier3)" }}>
              Firestore unavailable — showing sandbox data.
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto" }}>
            <Outlet />
          </div>
        </main>

        {isMobile && <MobileNav loops={loops} />}
      </div>
    </AppContext.Provider>
  );
}
