import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Radio, AlertCircle } from "lucide-react";
import { useLiveLoops, useLiveResolvedLoops, verifyAndCloseFirestore } from "./data/firestoreClient.js";
import { LOOPS as MOCK_LOOPS, CLIENTS as MOCK_CLIENTS } from "./data/mockData.js";
import LoopRow from "./components/LoopRow.jsx";
import ResolvedStamp from "./components/ResolvedStamp.jsx";
import { colors, fonts } from "./theme/tokens.js";

const fontStack = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

export default function CommandCenter() {
  const [expandedId, setExpandedId] = useState(null);
  const [showResolved, setShowResolved] = useState(true);
  const [sandboxTrigger, setSandboxTrigger] = useState(0);

  // Load live data from Firestore
  const { loops: liveLoops, loading: loadingLive, error: liveError } = useLiveLoops();
  const { resolvedLoops: liveResolved } = useLiveResolvedLoops();

  // Fallback to mock demo data ONLY if Firestore is completely unconfigured or errored, NOT when open loops array is empty (0 open loops is a valid live state)
  const isFallback = (liveLoops === null || liveLoops === undefined) || !!liveError;
  
  const activeLoops = useMemo(() => {
    if (!isFallback) return liveLoops || [];
    
    // Sandbox mode overrides: filter out resolved loops and apply approval overrides
    return MOCK_LOOPS.filter(loop => {
      return sessionStorage.getItem(`resolved_${loop.loop_id}`) !== "true";
    }).map(loop => {
      const hasApproved = sessionStorage.getItem(`approved_${loop.loop_id}`) === "true";
      if (hasApproved && loop.draft) {
        // Simulate the backend update by hiding draft and modifying history
        return {
          ...loop,
          tier: 1, // acts like agent handling after send
          history: [...loop.history, `[email] approved & sent: ${loop.draft.subject}`],
          draft: null
        };
      }
      return loop;
    });
  }, [liveLoops, isFallback, sandboxTrigger]);

  const resolvedLoops = useMemo(() => {
    if (!isFallback) return liveResolved || [];
    
    // Sandbox Mode resolved list
    const mockResolvedBase = { loop_id: "mock_resolved", client_name: "Fernwood Realty", client_id: "cl_fernwood", amount: 3100, history: [{ event: "Payment confirmed by client, verified" }] };
    const additionalResolved = MOCK_LOOPS.filter(loop => {
      return sessionStorage.getItem(`resolved_${loop.loop_id}`) === "true";
    }).map(loop => ({
      loop_id: loop.loop_id,
      client_id: loop.client_id,
      client_name: MOCK_CLIENTS[loop.client_id]?.name || "Client",
      amount: loop.amount,
      history: [{ event: "Payment confirmed by owner, verified & closed." }]
    }));
    return [mockResolvedBase, ...additionalResolved];
  }, [liveResolved, isFallback, sandboxTrigger]);

  const handleActionCompleted = (loopId, action) => {
    if (isFallback) {
      setSandboxTrigger(prev => prev + 1);
    }
  };

  const handleVerifyAndClose = async (loopId, note) => {
    if (isFallback) {
      sessionStorage.setItem(`resolved_${loopId}`, "true");
      setSandboxTrigger(prev => prev + 1);
    } else {
      try {
        await verifyAndCloseFirestore(loopId, note);
      } catch (err) {
        console.error("Failed to verify and close Firestore loop:", err);
        alert("Failed to verify and close loop: " + err.message);
      }
    }
  };

  const sorted = useMemo(() => {
    return [...activeLoops].sort((a, b) => {
      const getScore = (l) => {
        if (l.priority_why) {
          const parts = l.priority_why.split("=");
          if (parts.length > 1) {
            return parseFloat(parts[1].replace(/,/g, "")) || 0;
          }
        }
        return l.amount || 0;
      };
      return getScore(b) - getScore(a);
    });
  }, [activeLoops]);

  const totalOutstanding = activeLoops.reduce((s, l) => s + l.amount, 0);
  const totalResolved = resolvedLoops.reduce((s, l) => s + l.amount, 0);
  const needsYou = activeLoops.filter((l) => l.tier >= 2).length;
  const agentHandling = activeLoops.filter((l) => l.tier === 1).length;

  return (
    <div style={{ minHeight: "100%", background: colors.paper, padding: "0" }}>
      <style>{fontStack}</style>
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "48px 24px 64px" }}>
        
        {/* CONNECTION STATE INDICATOR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ fontFamily: fonts.mono, fontSize: "11px", letterSpacing: "0.1em", color: "#8A876F" }}>
            LOOPKEEPER · CONTROL STATION
          </div>
          
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px", 
              background: isFallback ? "#FDF2F2" : "#F0FDF4", 
              border: `1.5px solid ${isFallback ? colors.redInk : colors.ink}`,
              padding: "4px 10px", 
              borderRadius: "20px",
              fontFamily: fonts.mono,
              fontSize: "10px",
              fontWeight: 600,
              color: isFallback ? colors.redInk : colors.ink
            }}
          >
            <Radio size={10} style={{ animation: "pulse 1.5s infinite" }} />
            {isFallback ? "SANDBOX MODE (OFFLINE)" : "LIVE CLOUD STORAGE (FIRESTORE)"}
          </div>
        </div>

        {/* ERROR WARNING BANNER */}
        {!!liveError && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#FDF2F2", border: `1.5px solid ${colors.redInk}`, padding: "12px 16px", borderRadius: "6px", marginBottom: "24px" }}>
            <AlertCircle size={18} color={colors.redInk} style={{ flexShrink: 0 }} />
            <div style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.redInk, lineHeight: 1.4 }}>
              <b>Connection to Firestore failed:</b> {liveError.message || "Network unreachable."} Operating in local offline sandbox mode. Actions will be simulated.
            </div>
          </div>
        )}

        {/* HERO */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: "clamp(38px, 6vw, 56px)", color: colors.ink, lineHeight: 1.02, letterSpacing: "-0.01em" }}>
            ${totalOutstanding.toLocaleString()}
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: "14px", color: "#6B6858", marginTop: "6px" }}>
            outstanding across {activeLoops.length} open {activeLoops.length === 1 ? "invoice" : "invoices"}
          </div>

          <div style={{ display: "flex", gap: "28px", marginTop: "22px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.ink }} />
              <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.charcoal }}>
                <b>{agentHandling}</b> the agent is handling autonomously
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.redInk }} />
              <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.charcoal }}>
                <b>{needsYou}</b> need your review
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.brass }} />
              <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.charcoal }}>
                <b>${totalResolved.toLocaleString()}</b> verified payment resolutions
              </span>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {loadingLive && !isFallback ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", background: colors.paperRaised, border: `1px solid ${colors.rule}`, borderRadius: "6px" }}>
            <RefreshCw size={24} style={{ color: colors.ink, animation: "spin 1.5s linear infinite" }} />
            <div style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.muted, marginTop: "12px" }}>
              SYNCHRONIZING WITH CLOUD RUNTIME...
            </div>
          </div>
        ) : (
          /* LEDGER TABLE */
          <div style={{ background: colors.paperRaised, border: `1px solid ${colors.rule}`, borderRadius: "6px", overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "20px minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) auto",
                gap: "16px",
                padding: "10px 6px",
                borderBottom: `1px solid ${colors.rule}`,
                fontFamily: fonts.mono,
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: colors.muted,
              }}
            >
              <div />
              <div>CLIENT</div>
              <div>SITUATION</div>
              <div style={{ textAlign: "right" }}>AMOUNT</div>
              <div />
            </div>
            
            {sorted.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", fontFamily: fonts.body, color: colors.muted }}>
                No active loops in registry. All invoices are fully resolved.
              </div>
            ) : (
              sorted.map((loop) => (
                <LoopRow
                  key={loop.loop_id}
                  loop={loop}
                  expanded={expandedId === loop.loop_id}
                  onToggle={() => setExpandedId(expandedId === loop.loop_id ? null : loop.loop_id)}
                  isFallback={isFallback}
                  onActionCompleted={handleActionCompleted}
                  onVerifyAndClose={handleVerifyAndClose}
                />
              ))
            )}
          </div>
        )}

        {/* RESOLVED HISTORY */}
        <div style={{ marginTop: "28px" }}>
          <button
            onClick={() => setShowResolved(!showResolved)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: fonts.mono, fontSize: "10px", letterSpacing: "0.08em", color: colors.muted }}
          >
            {showResolved ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            RESOLVED HISTORY
          </button>
          
          {showResolved && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {resolvedLoops.length === 0 ? (
                <div style={{ padding: "16px", background: colors.paperRaised, border: `1px solid ${colors.rule}`, borderRadius: "6px", fontFamily: fonts.body, fontSize: "13px", color: colors.muted, textAlign: "center" }}>
                  No payment resolutions recorded this week.
                </div>
              ) : (
                resolvedLoops.map((r, i) => {
                  const latestHistory = r.history && r.history.length > 0
                    ? r.history[r.history.length - 1].event || r.history[r.history.length - 1]
                    : "Payment verified and loop closed.";
                  
                  return (
                    <div 
                      key={r.loop_id || i} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "16px 18px", 
                        background: colors.paperRaised, 
                        border: `1px solid ${colors.rule}`, 
                        borderRadius: "6px" 
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: "14px", color: colors.charcoal }}>
                          {MOCK_CLIENTS[r.client_id]?.name || r.client_name || "Unknown Client"} · <span style={{ fontFamily: fonts.mono, fontWeight: 500 }}>${r.amount.toLocaleString()}</span>
                        </div>
                        <div style={{ fontFamily: fonts.body, fontSize: "12px", color: "#7A7768", marginTop: "2px" }}>
                          {typeof latestHistory === "string" ? latestHistory : latestHistory.event}
                        </div>
                      </div>
                      <ResolvedStamp visible={true} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: "40px", fontFamily: fonts.mono, fontSize: "11px", color: colors.muted, textAlign: "center", lineHeight: 1.5 }}>
          Verified payment outcomes are processed by verify_and_close() inside the backend engine.<br />
          Displaying active data sync under the zero-trust Agent Gateway routing policies.
        </div>
      </div>
      
      {/* KEYFRAME ANIMATIONS */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
