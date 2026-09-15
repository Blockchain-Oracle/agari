/**
 * The token lane's attested fallback (session-lanes.md §2.5): the median of Jupiter Price v3 at T − 40, T − 20 and T for
 * the verified mint, recorded through `recordAttestedSlot` at ≥ T + 60. "Attested demo" only; devnet by user opt-in
 * (Q-S6-5). Lane 6b owns this file. The relay hands it every unexpired attested slot of a token Series.
 *
 * Samples come from the process's `xstock-spot` history: for each offset, the newest sample in the 5 s before it, so
 * all three sit inside the bar `[T − 60, T]`. A missing sample leaves the slot unrecorded (it voids honestly rather
 * than attesting fewer points). Opens copy the previous close when adjacent, like the Switchboard lane.
 */
import { keypairSigner } from "@agari/markets/ops";
import { copyOpenSlot, JUPITER_SAMPLE_OFFSETS_SEC, medianE8, recordAttestedSlot, SWITCHBOARD_ERROR, type PrintSlot, type SlotOutcome } from "@agari/markets/ops/prints";
import { XSTOCK_SYMBOLS, type XStockSymbol } from "@agari/core/market";
import { currentXStockSpot, type XStockSpotFeed } from "../../prices/xstock-spot";
import type { LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

const MAX_ATTEMPTS = 3;
const slotKey = (s: PrintSlot) => `${s.market}:${s.slot}`;
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19) + "Z";
const short = (s: PrintSlot) => `${s.seriesKey}#${s.marketIndex} ${s.slot}`;

/** The token lane key's asset (`TSLAx-5m` → `TSLAx`), or null for any other Series. */
const xstockOfKey = (seriesKey: string) => (XSTOCK_SYMBOLS as readonly string[]).find((x) => seriesKey.startsWith(`${x}-`)) as XStockSymbol | undefined;

/** The median of the three bar samples of `xstock` at T, or why not. Pure over the feed. */
export function barMedianE8(feed: XStockSpotFeed, xstock: XStockSymbol | undefined, tSec: number): { medianE8: bigint } | { missing: string } {
  if (!xstock) return { missing: "not a token-lane Series" };
  const samples = JUPITER_SAMPLE_OFFSETS_SEC.map((offset) => feed.at(xstock, tSec + offset, 5));
  const gaps = JUPITER_SAMPLE_OFFSETS_SEC.filter((_, i) => !samples[i]);
  if (gaps.length) return { missing: `${xstock} Jupiter sample missing at T${gaps.map((g) => (g ? `${g}` : "+0")).join("/")}` };
  return { medianE8: medianE8(samples.map((s) => s!.priceE8)) };
}

export async function jupiterAttestPass(ctx: RelayContext, slots: readonly PrintSlot[], chainNow: number): Promise<LanePassResult> {
  if (slots.length === 0) return { line: null, nextSec: null };
  if (!ctx.attested) return { line: `jupiter attested: ${slots.length} slot(s), RELAY_ATTESTED is off (Q-S6-5 opt-in)`, nextSec: null };
  const feed = currentXStockSpot();
  if (!feed) return { line: `jupiter attested: ${slots.length} slot(s), no xStock spot feed running`, nextSec: null };
  const wall = Math.floor(Date.now() / 1000);
  // Wake for the next sample point of any future boundary, and for the earliest admissible record.
  const points = slots.flatMap((s) => [...JUPITER_SAMPLE_OFFSETS_SEC.map((o) => s.boundarySec + o), s.earliestSec + (wall - chainNow)]).filter((p) => p > wall);
  const nextSec = points.length ? Math.min(...points) : null;
  const due = slots.filter((s) => chainNow >= s.earliestSec && (ctx.failures.get(slotKey(s))?.attempts ?? 0) < MAX_ATTEMPTS);
  if (due.length === 0) return { line: null, nextSec };

  const attestor = await keypairSigner(ctx.attested.attestorSecret);
  const parts: string[] = [];
  const record = async (slot: PrintSlot): Promise<SlotOutcome | string> => {
    const bar = barMedianE8(feed, xstockOfKey(slot.seriesKey), slot.boundarySec);
    if ("missing" in bar) return `${short(slot)}: ${bar.missing}`;
    if (ctx.dryRun) return `DRY attested ${short(slot)} @ ${bar.medianE8}e-8`;
    const fetchedAtSec = Math.max(slot.earliestSec, Math.min(chainNow, wall));
    return recordAttestedSlot(ctx.client, slot, { attestor, clusterTag: ctx.attested!.clusterTag, priceE8: bar.medianE8, fetchedAtSec });
  };
  for (const slot of due) {
    let outcome: SlotOutcome | string = slot.slot === "open" && !ctx.dryRun ? await copyOpenSlot(ctx.client, slot) : "";
    const noPrev = typeof outcome !== "string" && (outcome.code === SWITCHBOARD_ERROR.printNotAdjacent || outcome.code === SWITCHBOARD_ERROR.printsMissing);
    if (outcome === "" || noPrev) outcome = await record(slot);
    if (typeof outcome === "string") parts.push(outcome);
    else {
      if (outcome.status === "recorded") ctx.counters.recorded++;
      else if (outcome.status === "failed") {
        ctx.counters.failed++;
        const prev = ctx.failures.get(slotKey(slot))?.attempts ?? 0;
        ctx.failures.set(slotKey(slot), { attempts: prev + 1, reason: `jupiter attested failed: ${outcome.error ?? ""}`.slice(0, 300) });
      }
      parts.push(`${short(slot)} ${outcome.status}${outcome.signature ? ` ${outcome.signature.slice(0, 8)}` : outcome.code ? ` (${outcome.code})` : ""}`);
    }
  }
  return { line: `jupiter attested T ${[...new Set(due.map((s) => iso(s.boundarySec)))].join(",")}: ${parts.join(", ")}`, nextSec };
}
