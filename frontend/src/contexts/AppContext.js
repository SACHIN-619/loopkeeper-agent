/**
 * AppContext.js — Shared context for app-wide data.
 * Separated from AppShell to satisfy React Fast Refresh requirements
 * (a module cannot export both a context and a default component).
 */
import { createContext, useContext } from "react";

export const AppContext = createContext({
  loops: [],
  resolvedLoops: [],
  clients: {},
  isFallback: true,
  loading: true,
  firestoreError: null,
  onVerifyAndClose: () => {},
  onActionCompleted: () => {},
});

export function useApp() {
  return useContext(AppContext);
}
