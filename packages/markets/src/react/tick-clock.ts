/**
 * One timer per interval, shared by every hook that asks for it.
 *
 * The ticker strip alone mounts four `useAssetPrice`, each of which wants a one-second staleness
 * tick; the hero's chart series wants another. Five independent `setInterval`s means five
 * unsynchronised wake-ups a second, and five separate render passes that could have been one.
 * Here they share a timer and fire together, so an interval costs the same whether one hook or
 * twenty are watching it.
 */
interface Clock {
  id: ReturnType<typeof setInterval>;
  listeners: Set<() => void>;
}

const clocks = new Map<number, Clock>();
/** Kept past the last unsubscribe so a remount never sees the count go backwards. */
const counts = new Map<number, number>();

/** The current count for `intervalMs` — the same number every subscriber sees on a given beat. */
export function tickCount(intervalMs: number): number {
  return counts.get(intervalMs) ?? 0;
}

function beat(intervalMs: number): void {
  counts.set(intervalMs, tickCount(intervalMs) + 1);
  const clock = clocks.get(intervalMs);
  if (!clock) return;
  for (const listener of clock.listeners) listener();
}

export function subscribeTick(intervalMs: number, listener: () => void): () => void {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    clock = { id: setInterval(() => beat(intervalMs), intervalMs), listeners: new Set() };
    clocks.set(intervalMs, clock);
  }
  const held = clock;
  held.listeners.add(listener);
  return () => {
    held.listeners.delete(listener);
    if (held.listeners.size > 0) return;
    clearInterval(held.id);
    clocks.delete(intervalMs);
  };
}
