/**
 * The print archive loop (venue-ops.md §6.4; takes over the S0 archivers): every 5-minute boundary of every session in
 * the last 23 hours, RedStone for every RedStone ticker and Pyth for every trial feed, whether or not a Window used it.
 * The live boundary goes first, then the backlog oldest-first, a few fetches per pass.
 */
import { archivedKeys, archivePrints, isDbConfigured } from "@agari/db";
import type { SessionService } from "../../calendar/session-service";
import type { PassResult } from "../../runtime/actor";
import type { PythEntitlementStore } from "../../runtime/pyth-entitlement";
import type { BoundaryCache } from "./boundary-cache";
import { pythRows } from "./pyth-archive";
import { archiveIndexFeeds } from "./pyth-index-archive";
import { redstoneRows } from "./redstone-archive";
import type { RelaySources } from "./sources";

const STEP_SEC = 300;
const LOOK_BACK_SEC = 23 * 3600;
const FETCH_AFTER_SEC = 12;
const LIVE_SEC = 120;
const REDSTONE_PER_PASS = 2;
const PYTH_PER_PASS = 1;

export interface ArchiveContext {
  sources: RelaySources;
  cache: BoundaryCache;
  sessions: SessionService;
  pythEnabled: boolean;
  /** The valuation indices' entitlement (S20): only an entitled index is archived, around the clock, alone in its request. */
  entitlement?: PythEntitlementStore | null;
  /** `"<source>:<feed>:<T>"` the source no longer has (fetched after T + 60 with nothing): not retried. */
  unavailable: Set<string>;
  counters: { redstoneRows: number; pythRows: number; unavailable: number; pythIndexRows?: number };
  log: (why: string) => void;
}

const wallSec = () => Math.floor(Date.now() / 1000);
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(5, 16).replace("T", " ") + "Z";

function liveFirst(times: number[], wall: number): number[] {
  const live = times.filter((t) => wall - t <= LIVE_SEC).sort((a, b) => b - a);
  return [...live, ...times.filter((t) => wall - t > LIVE_SEC).sort((a, b) => a - b)];
}

export async function archivePass(ctx: ArchiveContext): Promise<PassResult> {
  if (!isDbConfigured()) return { why: "no DATABASE_URL: the print archive is off", nextDelayMs: 300_000 };
  await ctx.sessions.refresh();
  const calendar = ctx.sessions.calendar();
  if (!calendar) return { why: "no agreed session calendar: archiving nothing", nextDelayMs: 60_000 };
  const wall = wallSec();
  const from = wall - LOOK_BACK_SEC;
  const times = calendar.sessions
    .filter((s) => s.closeSec >= from && s.openSec <= wall)
    .flatMap((s) => {
      const out: number[] = [];
      for (let t = Math.ceil(s.openSec / STEP_SEC) * STEP_SEC; t <= s.closeSec; t += STEP_SEC) out.push(t);
      return out;
    })
    .filter((t) => t >= from && t <= wall - FETCH_AFTER_SEC);
  // The next archive point is the earliest boundary whose fetch time is still ahead (the current one until T + 12).
  const nextPoint = (Math.floor((wall - FETCH_AFTER_SEC) / STEP_SEC) + 1) * STEP_SEC + FETCH_AFTER_SEC;
  const idleDelay = Math.min(60_000, Math.max(1, nextPoint - wall) * 1000);
  if (times.length === 0) return { why: "no session boundary in the last 23 h to archive", nextDelayMs: idleDelay };

  const [lo, hi] = [Math.min(...times), Math.max(...times)];
  const rsHave = (await archivedKeys("redstone", lo, hi)) ?? new Set<string>();
  const pyHave = (await archivedKeys("pyth", lo, hi)) ?? new Set<string>();
  const rsMissing = times.filter((t) => ctx.sources.redstoneFeeds.some((f) => !rsHave.has(`${f.feed}:${t}`) && !ctx.unavailable.has(`redstone:${f.feed}:${t}`)));
  const pythOn = ctx.pythEnabled && !ctx.cache.pythAuthFailed;
  const pyMissing = pythOn
    ? times.filter((t) => t <= ctx.sources.pythTrialLastSec && ctx.sources.pythFeeds.some((f) => !pyHave.has(`${f.feedIdHex}:${t}`) && !ctx.unavailable.has(`pyth:${f.feedIdHex}:${t}`)))
    : [];

  const notes: string[] = [];
  let rsNew = 0;
  for (const t of liveFirst(rsMissing, wall).slice(0, REDSTONE_PER_PASS)) {
    const response = await ctx.cache.redstone(t);
    if (!response) {
      notes.push(`redstone ${iso(t)}: ${ctx.cache.redstoneError(t) ?? "no response"}`);
      continue;
    }
    const built = redstoneRows(ctx.sources, response, t, rsHave);
    rsNew += (await archivePrints(built.rows)) ?? 0;
    for (const feed of built.unavailable) ctx.unavailable.add(`redstone:${feed}:${t}`);
    ctx.counters.unavailable += built.unavailable.length;
    if (built.waiting.length) notes.push(`redstone ${iso(t)} waiting ${built.waiting.join(" ")}`);
    if (built.unavailable.length) notes.push(`redstone ${iso(t)} unavailable ${built.unavailable.join(" ")}`);
  }
  let pyNew = 0;
  const pythFeedIds = ctx.sources.pythFeeds.map((f) => f.feedIdHex);
  // Recording shares Hermes' rate limit and goes first: the archive only asks when the gate is open.
  for (const t of ctx.cache.pythThrottled() ? [] : liveFirst(pyMissing, wall).slice(0, PYTH_PER_PASS)) {
    const boundary = await ctx.cache.pyth(t, pythFeedIds);
    if (!boundary) {
      const status = ctx.cache.pythStatus(t, pythFeedIds);
      if (status === 404 && wall - t > 3600) for (const id of pythFeedIds) ctx.unavailable.add(`pyth:${id}:${t}`);
      notes.push(`pyth ${iso(t)}: ${ctx.cache.pythAuthFailed ? "key refused" : `not available${status ? ` (HTTP ${status})` : ""}`}`);
      continue;
    }
    pyNew += (await archivePrints(pythRows(boundary, pyHave))) ?? 0;
  }
  // S20: the valuation indices, 24/7, only while entitled (nothing today), never in the trial feeds' request.
  const index = pythOn ? await archiveIndexFeeds({ store: ctx.entitlement, cache: ctx.cache, fromSec: from, toSec: wall - FETCH_AFTER_SEC, unavailable: ctx.unavailable }) : { rows: 0, missing: 0, notes: [] };
  notes.push(...index.notes);
  ctx.counters.redstoneRows += rsNew;
  ctx.counters.pythRows += pyNew;
  ctx.counters.pythIndexRows = (ctx.counters.pythIndexRows ?? 0) + index.rows;
  const backlog = Math.max(0, rsMissing.length - REDSTONE_PER_PASS) + Math.max(0, pyMissing.length - PYTH_PER_PASS) + Math.max(0, index.missing - 1);
  const waiting = notes.some((n) => n.includes("waiting") || n.includes("not available") || n.includes("no response"));
  const indexText = index.missing || index.rows ? `, Pyth index ${index.missing}` : "";
  return {
    why: `archived ${rsNew} RedStone + ${pyNew} Pyth${index.rows ? ` + ${index.rows} Pyth index` : ""} rows · ${times.length} boundaries in view · missing RedStone ${rsMissing.length}, Pyth ${pyMissing.length}${indexText}${notes.length ? ` | ${notes.join(" | ")}` : ""}`,
    detail: { ...ctx.counters, boundaries: times.length, redstoneMissing: rsMissing.length, pythMissing: pyMissing.length, pythIndexMissing: index.missing },
    nextDelayMs: backlog > 0 ? 1_500 : waiting ? 3_000 : idleDelay,
  };
}
