import { useCallback, useSyncExternalStore } from "react";
import { subscribeTick, tickCount } from "./tick-clock";

/**
 * A counter that advances every `intervalMs` — the render clock for countdowns, staleness ticks,
 * and requotes. Every hook on the same interval shares one timer and one beat (see `tick-clock`),
 * so mounting a second countdown costs a listener, not a second wake-up.
 */
export function useTick(intervalMs: number): number {
  const subscribe = useCallback((onChange: () => void) => subscribeTick(intervalMs, onChange), [intervalMs]);
  const read = useCallback(() => tickCount(intervalMs), [intervalMs]);
  // The server has no clock to read; it renders the first beat and hydration takes over from there.
  return useSyncExternalStore(subscribe, read, () => 0);
}
