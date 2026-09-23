import type { TickerSymbol } from "@agari/core/market";
import { useSyncExternalStore } from "react";
import { dropBellsSnapshot, setDropBell } from "@/features/hedge/drop-bell";

/**
 * The drop bell's switched-on list, over web's own store (`features/hedge/drop-bell.ts`: the same localStorage key, the
 * same parsing). Web's subscription also listens for another tab's `storage` event through `window.addEventListener`,
 * which React Native does not have, so the app keeps its own listener set and notifies it after every write.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBell(asset: TickerSymbol, on: boolean): void {
  setDropBell(asset, on);
  for (const listener of listeners) listener();
}

export function useBells(): readonly TickerSymbol[] {
  return useSyncExternalStore(subscribe, dropBellsSnapshot, dropBellsSnapshot);
}
