import { useSyncExternalStore } from "react";

/**
 * Whether a screen has taken the whole phone (an arcade run in play). The shell reads it to step its chrome — the
 * strip, marquee, header and the floating dock — out of the way; the screen that set it clears it when it is done.
 */
let immersive = false;
const listeners = new Set<() => void>();

export function setImmersive(on: boolean): void {
  if (immersive === on) return;
  immersive = on;
  listeners.forEach((listener) => listener());
}

export function useImmersive(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => immersive,
  );
}
