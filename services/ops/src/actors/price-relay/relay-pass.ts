/**
 * One price-relay pass (venue-ops.md §6.1–6.2): gather due slots, then record per boundary. RedStone check slots go
 * first (their window closes at T + 120), then RedStone primaries, then Pyth (post once per T, record, close).
 * S6 lane dispatch (session-lanes.md §6): Gap archive opens (6a) take their slots first; Switchboard and token
 * attested slots go to their lane passes (6b). Gap slots otherwise ride the same (source, T) units as Regular ones.
 */
import { emptySlots, inBatches, recordPythBoundary, recordRedstoneSlot, type PrintSlot, type SlotOutcome } from "@agari/markets/ops/prints";
import type { OpsClient } from "@agari/markets/ops";
import type { PassResult } from "../../runtime/actor";
import { recordAttested, type AttestedContext } from "./attest-sign";
import type { BoundaryCache } from "./boundary-cache";
import { gapArchivePass } from "./gap-slots";
import { jupiterAttestPass } from "./jupiter-attest";
import type { LanePassResult } from "./lane-pass";
import { isPreStocksSlot, prestocksPass } from "./prestocks-pass";
import { switchboardPass } from "./switchboard-pass";
import { feedAt } from "./redstone-fetch";
import type { RelaySources } from "./sources";
import type { VenueTracker } from "./tracker";

export const PYTH_FETCH_AFTER_SEC = 2;
export const REDSTONE_FETCH_AFTER_SEC = 10;
const MAX_FAILED_ATTEMPTS = 5;
const CONCURRENCY = 4;

export interface RelayContext {
  client: OpsClient;
  rpcUrl: string;
  payerSecret: Uint8Array;
  dryRun: boolean;
  sources: RelaySources;
  cache: BoundaryCache;
  tracker: VenueTracker;
  attested: AttestedContext | null;
  /** The Pre-IPO lane's attestor (`RELAY_PRESTOCKS=1`); null leaves PreStocks slots unrecorded. */
  prestocks?: AttestedContext | null;
  log: (why: string) => void;
  /** Slot key → failed attempts and the last reason. */
  failures: Map<string, { attempts: number; reason: string }>;
  missed: Set<string>;
  counters: { recorded: number; already: number; failed: number; missed: number; pythPosted: number; pythClosed: number };
}

const wallSec = () => Math.floor(Date.now() / 1000);
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19) + "Z";
export const slotKey = (s: PrintSlot) => `${s.market}:${s.slot}`;
const short = (s: PrintSlot) => `${s.seriesKey}#${s.marketIndex} ${s.slot}`;

function groupByT(slots: PrintSlot[]): Map<number, PrintSlot[]> {
  const out = new Map<number, PrintSlot[]>();
  for (const s of slots) out.set(s.boundarySec, [...(out.get(s.boundarySec) ?? []), s]);
  return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
}

function note(ctx: RelayContext, outcomes: SlotOutcome[]): string[] {
  const parts: string[] = [];
  for (const o of outcomes) {
    const key = slotKey(o.slot);
    if (o.status === "recorded") {
      ctx.counters.recorded++;
      ctx.failures.delete(key);
      parts.push(`${short(o.slot)} ✓ ${o.signature!.slice(0, 8)}`);
    } else if (o.status === "already") {
      ctx.counters.already++;
      parts.push(`${short(o.slot)} already`);
    } else if (o.status === "early") {
      parts.push(`${short(o.slot)} too early (chain clock)`);
    } else {
      const prev = ctx.failures.get(key)?.attempts ?? 0;
      ctx.failures.set(key, { attempts: prev + 1, reason: `${o.status}: ${o.error ?? ""}`.slice(0, 300) });
      ctx.counters.failed++;
      parts.push(`${short(o.slot)} ${o.status} (${o.code ?? "no code"})`);
    }
  }
  return parts;
}

function reportMissed(ctx: RelayContext, slot: PrintSlot, reason: string) {
  const key = slotKey(slot);
  if (ctx.missed.has(key)) return;
  ctx.missed.add(key);
  ctx.counters.missed++;
  ctx.log(`missed ${slot.slot} ${slot.market} (${short(slot)}, T ${iso(slot.boundarySec)}): ${reason}`);
}

async function redstoneBoundary(ctx: RelayContext, tSec: number, slots: PrintSlot[], chainNow: number): Promise<string> {
  const response = await ctx.cache.redstone(tSec);
  if (!response) return `redstone T ${iso(tSec)}: no data yet${ctx.cache.redstoneError(tSec) ? ` (${ctx.cache.redstoneError(tSec)})` : ""}`;
  const { redstoneSigners, redstoneSignerCount, redstoneThreshold } = ctx.sources;
  const ready: Array<{ slot: PrintSlot; packages: NonNullable<ReturnType<typeof feedAt>>["packages"] }> = [];
  const waiting: string[] = [];
  for (const slot of slots) {
    const at = feedAt(response.text, slot.redstoneFeed!, tSec, redstoneSigners);
    const have = at?.packages.length ?? 0;
    const need = chainNow <= tSec + slot.strictSec ? redstoneSignerCount : redstoneThreshold;
    if (at && have >= need) ready.push({ slot, packages: at.packages });
    else waiting.push(`${short(slot)} ${have}/${need} signers`);
  }
  // Check slots first: their admission ends at T + check_admission_sec.
  ready.sort((a, b) => Number(b.slot.slot.startsWith("check")) - Number(a.slot.slot.startsWith("check")));
  if (ctx.dryRun) return `DRY redstone T ${iso(tSec)}: would record ${ready.map((r) => short(r.slot)).join(", ") || "nothing"}${waiting.length ? `; waiting ${waiting.join(", ")}` : ""}`;
  const outcomes = await inBatches(ready, CONCURRENCY, (r) => recordRedstoneSlot(ctx.client, r.slot, r.packages));
  return `redstone T ${iso(tSec)}: ${[...note(ctx, outcomes), ...waiting.map((w) => `waiting ${w}`)].join(", ")}`;
}

async function pythBoundary(ctx: RelayContext, tSec: number, slots: PrintSlot[]): Promise<string> {
  const feeds = [...new Set(slots.map((s) => s.feedIdHex))];
  const boundary = await ctx.cache.pyth(tSec, feeds);
  if (!boundary) {
    const status = ctx.cache.pythStatus(tSec, feeds);
    return `pyth T ${iso(tSec)}: ${ctx.cache.pythAuthFailed ? "Hermes refused the key (trial over?)" : `no update yet${status ? ` (HTTP ${status})` : ""}`}`;
  }
  if (ctx.dryRun) return `DRY pyth T ${iso(tSec)}: would post ${feeds.length} feed(s) and record ${slots.map(short).join(", ")}`;
  try {
    const result = await recordPythBoundary({ client: ctx.client, rpcUrl: ctx.rpcUrl, payerSecret: ctx.payerSecret, slots, updatesBase64: boundary.updatesBase64, concurrency: CONCURRENCY });
    ctx.counters.pythPosted += result.posted.length;
    ctx.counters.pythClosed += result.closeError ? 0 : result.posted.length;
    const close = result.closeError ? `close FAILED (${result.closeError.slice(0, 120)}; the leftover sweep retries)` : `closed ${result.posted.length}`;
    return `pyth T ${iso(tSec)}: posted ${result.posted.length} (${result.postSignatures.length} txs), ${note(ctx, result.outcomes).join(", ")}, ${close}`;
  } catch (error) {
    for (const slot of slots) {
      const prev = ctx.failures.get(slotKey(slot))?.attempts ?? 0;
      ctx.failures.set(slotKey(slot), { attempts: prev + 1, reason: `post failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) });
    }
    ctx.counters.failed += slots.length;
    return `pyth T ${iso(tSec)}: post failed: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`;
  }
}

/** Seconds until the next fetch point of a pending slot, clamped to [1, 15]. */
function nextDelayMs(pending: PrintSlot[], wall: number, busy: boolean): number {
  if (busy) return 1_000;
  const points = pending.map((s) => s.boundarySec + Math.max(s.source === "pyth" ? PYTH_FETCH_AFTER_SEC : REDSTONE_FETCH_AFTER_SEC, s.earliestSec - s.boundarySec));
  const next = points.length ? Math.min(...points) - wall : 15;
  return Math.min(15, Math.max(1, next)) * 1000;
}

/** A lane pass that wants to run sooner shortens the delay, never below 1 s. */
function laneDelayMs(delayMs: number, lanes: readonly LanePassResult[], wall: number): number {
  const wants = lanes.map((l) => l.nextSec).filter((s): s is number => s !== null);
  return wants.length ? Math.max(1_000, Math.min(delayMs, (Math.min(...wants) - wall) * 1000)) : delayMs;
}

export async function relayPass(ctx: RelayContext): Promise<PassResult> {
  const wall = wallSec();
  const chainNow = await ctx.tracker.chainNow();
  const { live: tracked, finished } = await ctx.tracker.read(chainNow);
  for (const { series, market } of finished) {
    for (const slot of emptySlots(series, market)) reportMissed(ctx, slot, ctx.failures.get(slotKey(slot))?.reason ?? "no admissible print was recorded before the deadline");
  }
  const due: PrintSlot[] = [];
  const pending: PrintSlot[] = [];
  const switchboard: PrintSlot[] = [];
  const tokenAttested: PrintSlot[] = [];
  const prestocks: PrintSlot[] = [];
  for (const { series, market } of tracked) {
    for (const slot of emptySlots(series, market)) {
      const failure = ctx.failures.get(slotKey(slot));
      if (chainNow > slot.deadlineSec) reportMissed(ctx, slot, failure?.reason ?? "no admissible print was recorded before the deadline");
      // The feed id names the source: a PreStocks slot goes to its own pass whatever the Series' basis (plan Step 3).
      else if (isPreStocksSlot(slot)) prestocks.push(slot);
      else if (slot.source === "switchboard") switchboard.push(slot);
      else if (slot.source === "attested" && slot.basis === "token") tokenAttested.push(slot);
      else if (slot.source === "attested" && !ctx.attested) continue;
      else if (failure && failure.attempts >= MAX_FAILED_ATTEMPTS) reportMissed(ctx, slot, `gave up after ${failure.attempts} attempts: ${failure.reason}`);
      else if (chainNow < slot.earliestSec) pending.push(slot);
      else due.push(slot);
    }
  }
  const lines: string[] = [];
  const gap = await gapArchivePass(ctx, due, chainNow);
  const lanes: LanePassResult[] = [gap, await prestocksPass(ctx, prestocks, chainNow), await switchboardPass(ctx, switchboard, chainNow), await jupiterAttestPass(ctx, tokenAttested, chainNow)];
  for (const lane of lanes) if (lane.line) lines.push(lane.line);
  const regular = gap.taken.size ? due.filter((s) => !gap.taken.has(slotKey(s))) : due;
  const fetchable = (s: PrintSlot, after: number) => wall >= s.boundarySec + after;
  const redstone = groupByT(regular.filter((s) => s.source === "redstone" && fetchable(s, REDSTONE_FETCH_AFTER_SEC)));
  const pyth = groupByT(regular.filter((s) => s.source === "pyth" && fetchable(s, PYTH_FETCH_AFTER_SEC)));
  const attested = regular.filter((s) => s.source === "attested");
  for (const [tSec, slots] of redstone) lines.push(await redstoneBoundary(ctx, tSec, slots, chainNow));
  for (const [tSec, slots] of pyth) lines.push(await pythBoundary(ctx, tSec, slots));
  if (ctx.attested && attested.length) lines.push(await recordAttested(ctx, ctx.attested, attested, chainNow));
  ctx.cache.prune(wall);
  const waitingFetch = regular.length - [...redstone.values(), ...pyth.values()].flat().length - attested.length;
  const summary = `${tracked.length} live Markets · due ${due.length} · pending ${pending.length}${waitingFetch ? ` · ${waitingFetch} before fetch time` : ""}`;
  return {
    why: lines.length ? `${summary} | ${lines.join(" | ")}` : summary,
    detail: { ...ctx.counters, liveMarkets: tracked.length, due: due.length, pending: pending.length, chainNowSec: chainNow, chainLagSec: wall - chainNow },
    nextDelayMs: laneDelayMs(
      nextDelayMs([...pending, ...regular], wall, lines.some((l) => l.includes("waiting") || l.includes("no data yet") || l.includes("no update yet") || l.includes("too early"))),
      lanes,
      wall,
    ),
  };
}
