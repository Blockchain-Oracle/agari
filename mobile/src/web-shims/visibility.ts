import { AppState } from "react-native";
import { useSyncExternalStore } from "react";

/** Stands in for web/src/lib/visibility.ts: a backgrounded app polls nothing and animates nothing, as a hidden tab. */
function subscribe(onChange: () => void): () => void {
  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}

const isActive = () => AppState.currentState === "active";

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, isActive, isActive);
}
