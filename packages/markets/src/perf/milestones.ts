/**
 * Read-path milestones.
 *
 * One ordered record of when the app became useful, kept in memory for the life of the
 * document. It exists so "the app is slow" can be answered with a stage rather than a
 * feeling: the shell painting at 0.3 s and the first market card at 20 s are two different
 * defects, and only a milestone between them says which one to fix.
 *
 * Nothing here may carry identity. A mark's `detail` is a query family, an endpoint index
 * or a stage name — never a wallet address, session key, token or request payload.
 */

/** The stages every session passes through, in the order they can first become true. */
export const MILESTONES = [
  /** The static shell is on screen: chrome, navigation, page frame. No chain read has landed. */
  "shell.ready",
  /** The shared read runtime has been constructed and has an endpoint selected. */
  "runtime.configured",
  /** Wallet connection state is known — connected or definitively not. Not "a wallet exists". */
  "wallet.ready",
  /** The chain clock offset landed. */
  "clock.ready",
  /** Collateral decimals landed. Money can now be formatted truthfully. */
  "collateral.ready",
  /** The live venue id resolved. Venue-scoped reads can start. */
  "venue.ready",
  /** All three boot facts are true. Historically the gate on every other read. */
  "boot.ready",
  /** The first live lane set arrived — the first genuinely useful market content. */
  "lanes.first",
  /** The route's critical tier is renderable. Deferred sections may still be loading. */
  "critical.ready",
  /** The route shows the thing the user came for. The number that matters. */
  "route.useful",
] as const;

export type Milestone = (typeof MILESTONES)[number];

export interface MilestoneMark {
  name: Milestone;
  /** Milliseconds since the document's time origin. */
  atMs: number;
  /** A stage/query-family label. Never identity. */
  detail?: string;
}

const marks = new Map<Milestone, MilestoneMark>();
const listeners = new Set<() => void>();

function nowMs(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

/**
 * Records a milestone the first time it happens and ignores every repeat: a route that
 * re-renders four times still became useful once, and the first time is the honest one.
 */
export function mark(name: Milestone, detail?: string): void {
  if (marks.has(name)) return;
  marks.set(name, { name, atMs: Math.round(nowMs()), detail });
  for (const listener of listeners) listener();
}

/** Every mark so far, in the canonical stage order rather than arrival order. */
export function milestones(): readonly MilestoneMark[] {
  return MILESTONES.map((name) => marks.get(name)).filter((m): m is MilestoneMark => m !== undefined);
}

export function milestoneAtMs(name: Milestone): number | null {
  return marks.get(name)?.atMs ?? null;
}

/** Clears the record — for tests and for a deliberate re-measurement in one document. */
export function resetMilestones(): void {
  marks.clear();
  for (const listener of listeners) listener();
}

export function subscribeMilestones(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
