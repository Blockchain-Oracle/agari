/**
 * Gap RedStone opening prints past the gateway's ≈ 24 h history (session-lanes.md §1.5): posted from `print_archive`
 * rows `(redstone, feed, T)` until `lock_at`. Lane 6a owns this file. The relay calls it first with every due slot; the
 * slots it takes are skipped by the Regular RedStone and Pyth passes.
 *
 * A Gap's Friday close T is a Regular session-close boundary, so while the gateway still has T the Regular pass records
 * it like any other. Once T is older than `ARCHIVE_FROM_SEC` this pass owns the slot, whatever the archive holds, so the
 * relay stops asking the gateway for a boundary it no longer serves. The admission rule is unchanged: past
 * `T + strict_sec` the engine needs `threshold` (3) packages, and every archived package carries its original signature.
 */
import { archivedAtBoundary, isDbConfigured } from "@agari/db";
import { inBatches, recordRedstoneSlot, type PrintSlot, type SlotOutcome } from "@agari/markets/ops/prints";
import type { LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";
import { feedAt } from "./redstone-fetch";

/** The gateway keeps ≈ 24 h (C:13 §3); from 23 h the archive is the source, leaving an hour's margin. */
export const ARCHIVE_FROM_SEC = 23 * 3_600;
const CONCURRENCY = 4;
/** Re-read the archive this often while a slot has no usable row (the archive pass may still be backfilling). */
const RETRY_SEC = 60;

const wallSec = () => Math.floor(Date.now() / 1000);
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(5, 16).replace("T", " ") + "Z";
/** The relay's `slotKey`, which `taken` keys must match. */
const keyOf = (s: PrintSlot) => `${s.market}:${s.slot}`;
const short = (s: PrintSlot) => `${s.seriesKey}#${s.marketIndex} ${s.slot}`;

/** The slots this lane owns now: a Gap Series' RedStone primary open, older than the gateway's history. */
export function archiveOwned(due: readonly PrintSlot[], wall: number): PrintSlot[] {
  return due.filter((s) => s.basis === "gap" && s.source === "redstone" && s.slot === "open" && s.redstoneFeed !== null && wall - s.boundarySec >= ARCHIVE_FROM_SEC);
}

function note(ctx: RelayContext, outcomes: SlotOutcome[]): string[] {
  return outcomes.map((o) => {
    const key = keyOf(o.slot);
    if (o.status === "recorded") {
      ctx.counters.recorded++;
      ctx.failures.delete(key);
      return `${short(o.slot)} ✓ ${o.signature!.slice(0, 8)} (archive)`;
    }
    if (o.status === "already") {
      ctx.counters.already++;
      return `${short(o.slot)} already`;
    }
    const prev = ctx.failures.get(key)?.attempts ?? 0;
    ctx.failures.set(key, { attempts: prev + 1, reason: `archive ${o.status}: ${o.error ?? ""}`.slice(0, 300) });
    ctx.counters.failed++;
    return `${short(o.slot)} ${o.status} (${o.code ?? "no code"})`;
  });
}

async function boundary(ctx: RelayContext, tSec: number, slots: PrintSlot[]): Promise<{ line: string; waiting: boolean }> {
  const feeds = [...new Set(slots.map((s) => s.redstoneFeed!))];
  const rows = await archivedAtBoundary("redstone", feeds, tSec);
  if (!rows) return { line: `gap archive T ${iso(tSec)}: no archive row (${feeds.join(" ")})`, waiting: true };
  const ready: Array<{ slot: PrintSlot; packages: NonNullable<ReturnType<typeof feedAt>>["packages"] }> = [];
  const waiting: string[] = [];
  for (const slot of slots) {
    const row = rows.get(slot.redstoneFeed!);
    // The row keeps the gateway's exact feed array; wrap it as a one-feed response so the live parser reads it unchanged.
    const at = row ? feedAt(`{${JSON.stringify(slot.redstoneFeed)}:${row.payload}}`, slot.redstoneFeed!, tSec, ctx.sources.redstoneSigners) : null;
    const have = at?.packages.length ?? 0;
    if (at && have >= ctx.sources.redstoneThreshold) ready.push({ slot, packages: at.packages });
    else waiting.push(`${short(slot)} ${row ? `${have}/${ctx.sources.redstoneThreshold} signers archived` : "not archived"}`);
  }
  const tail = waiting.length ? `; unrecordable ${waiting.join(", ")}` : "";
  if (ctx.dryRun) return { line: `DRY gap archive T ${iso(tSec)}: would record ${ready.map((r) => short(r.slot)).join(", ") || "nothing"}${tail}`, waiting: waiting.length > 0 };
  const outcomes = await inBatches(ready, CONCURRENCY, (r) => recordRedstoneSlot(ctx.client, r.slot, r.packages));
  return { line: `gap archive T ${iso(tSec)}: ${note(ctx, outcomes).join(", ") || "nothing ready"}${tail}`, waiting: waiting.length > 0 || outcomes.some((o) => o.status !== "recorded" && o.status !== "already") };
}

export async function gapArchivePass(ctx: RelayContext, due: readonly PrintSlot[], _chainNow: number): Promise<LanePassResult & { taken: ReadonlySet<string> }> {
  const wall = wallSec();
  const owned = archiveOwned(due, wall);
  const taken = new Set(owned.map(keyOf));
  if (owned.length === 0) return { line: null, nextSec: null, taken };
  if (!isDbConfigured()) return { line: `gap archive: ${owned.length} Gap open slot(s) past the gateway's history and no DATABASE_URL`, nextSec: wall + RETRY_SEC, taken };
  const byT = new Map<number, PrintSlot[]>();
  for (const s of owned) byT.set(s.boundarySec, [...(byT.get(s.boundarySec) ?? []), s]);
  const lines: string[] = [];
  let retry = false;
  for (const [tSec, slots] of [...byT.entries()].sort((a, b) => a[0] - b[0])) {
    const result = await boundary(ctx, tSec, slots);
    lines.push(result.line);
    retry ||= result.waiting;
  }
  return { line: lines.join(" | "), nextSec: retry ? wall + RETRY_SEC : null, taken };
}
