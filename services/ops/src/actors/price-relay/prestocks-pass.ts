/**
 * The Pre-IPO lane's prints (D-100/D-101, plan Step 3): an attested slot whose feed id is a PreStocks feed is valued
 * from the `prestocks-spot` history — the first sample read inside `[T + min_delay, T + PRESTOCKS_MAX_LATE_SEC]` — and
 * signed with that sample's true read time. Nothing is clamped: a boundary with no sample inside its window lets the
 * Window void on a missing print rather than sign a late price as that bar. Opens copy the previous close when the
 * Windows are adjacent, like the other 24/7 lane. Gated by `RELAY_PRESTOCKS=1`, narrower than `RELAY_ATTESTED`, which
 * would also switch on the Jupiter and RedStone demo fallbacks.
 *
 * S19 (D-124): a basket lane's feed (`prestocks-basket-v1:<SYM>`) is valued the same way from the feed's same-fetch
 * snapshots — the first read inside the window that priced every member, as the basket's index in points × 10⁸
 * (`basket-sample.ts`) — and signed with that read's time. One record/retry/copy-open loop serves both.
 */
import { BASKET_SYMBOLS, BASKETS, PRE_IPO_TICKERS, type Basket, type TickerSymbol } from "@agari/core/market";
import { keypairSigner } from "@agari/markets/ops";
import { copyOpenSlot, PRESTOCKS_MAX_LATE_SEC, preStocksBasketFeedHex, preStocksFeedHex, recordAttestedSlot, SWITCHBOARD_ERROR, type PrintSlot, type SlotOutcome } from "@agari/markets/ops/prints";
import { currentPreStocksSpot, type PreStocksSample, type PreStocksSpotFeed } from "../../prices/prestocks-spot";
import { chooseBasketSample } from "./basket-sample";
import type { LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_SEC = 5;
const slotKey = (s: PrintSlot) => `${s.market}:${s.slot}`;
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19) + "Z";
const short = (s: PrintSlot) => `${s.seriesKey}#${s.marketIndex} ${s.slot}`;

/** What a PreStocks feed id prints: one name's token price, or one basket's index. */
export type PreStocksTarget = { kind: "name"; symbol: TickerSymbol } | { kind: "basket"; basket: Basket };

export const TARGET_BY_FEED: ReadonlyMap<string, PreStocksTarget> = new Map<string, PreStocksTarget>([
  ...PRE_IPO_TICKERS.map((symbol): [string, PreStocksTarget] => [preStocksFeedHex(symbol), { kind: "name", symbol }]),
  ...BASKET_SYMBOLS.map((symbol): [string, PreStocksTarget] => [preStocksBasketFeedHex(symbol), { kind: "basket", basket: BASKETS[symbol] }]),
]);

/** An attested slot on a PreStocks feed (a name or a basket), whatever its Series' basis: the feed id, not the lane, names the source. */
export const isPreStocksSlot = (slot: PrintSlot): boolean => slot.source === "attested" && TARGET_BY_FEED.has(slot.feedIdHex);

/**
 * The first sample read inside the slot's honest window, or why there is none: `waiting` while the window is still
 * open and no read has landed yet, `missed` once it has closed. Pure over the history (oldest first).
 */
export function chooseSample(
  history: readonly PreStocksSample[],
  slot: Pick<PrintSlot, "boundarySec" | "earliestSec">,
  wallSec: number,
): { sample: PreStocksSample } | { waiting: string } | { missed: string } {
  const latestSec = slot.boundarySec + PRESTOCKS_MAX_LATE_SEC;
  const sample = history.find((s) => s.fetchedAtSec >= slot.earliestSec && s.fetchedAtSec <= latestSec);
  if (sample) return { sample };
  const window = `[T+${slot.earliestSec - slot.boundarySec}s, T+${PRESTOCKS_MAX_LATE_SEC}s]`;
  return wallSec <= latestSec ? { waiting: `no PreStocks read yet inside ${window}` } : { missed: `no PreStocks read landed inside ${window}; the Window voids` };
}

/** The print a slot gets, in one shape for both targets: the value at expo −8 (dollars for a name, points for a basket) and its read time. */
export function choosePrint(
  feed: Pick<PreStocksSpotFeed, "history" | "snapshots">,
  target: PreStocksTarget,
  slot: Pick<PrintSlot, "boundarySec" | "earliestSec">,
  wallSec: number,
): { priceE8: bigint; fetchedAtSec: number; unit: string } | { waiting: string } | { missed: string } {
  if (target.kind === "name") {
    const chosen = chooseSample(feed.history(target.symbol), slot, wallSec);
    return "sample" in chosen ? { priceE8: chosen.sample.tokenPriceE8, fetchedAtSec: chosen.sample.fetchedAtSec, unit: "e-8" } : chosen;
  }
  const chosen = chooseBasketSample(feed.snapshots(), target.basket, slot, wallSec);
  return "sample" in chosen ? { priceE8: chosen.sample.indexE8, fetchedAtSec: chosen.sample.fetchedAtSec, unit: "e-8 pts" } : chosen;
}

export async function prestocksPass(ctx: RelayContext, slots: readonly PrintSlot[], chainNow: number): Promise<LanePassResult> {
  if (slots.length === 0) return { line: null, nextSec: null };
  if (!ctx.prestocks) return { line: `prestocks: ${slots.length} slot(s), RELAY_PRESTOCKS is off`, nextSec: null };
  const feed = currentPreStocksSpot();
  if (!feed) return { line: `prestocks: ${slots.length} slot(s), no PreStocks feed running`, nextSec: null };
  const wall = Math.floor(Date.now() / 1000);
  let nextSec: number | null = null;
  const wake = (sec: number) => {
    if (sec > wall && (nextSec === null || sec < nextSec)) nextSec = sec;
  };
  const attestor = await keypairSigner(ctx.prestocks.attestorSecret);
  const parts: string[] = [];
  for (const slot of slots) {
    const target = TARGET_BY_FEED.get(slot.feedIdHex)!;
    const key = slotKey(slot);
    const attempts = ctx.failures.get(key)?.attempts ?? 0;
    if (attempts >= MAX_ATTEMPTS) continue;
    const chosen = choosePrint(feed, target, slot, wall);
    if ("waiting" in chosen) {
      wake(Math.max(slot.earliestSec, wall + RETRY_AFTER_SEC));
      parts.push(`${short(slot)}: ${chosen.waiting}`);
      continue;
    }
    if ("missed" in chosen) {
      ctx.failures.set(key, { attempts: MAX_ATTEMPTS, reason: chosen.missed });
      parts.push(`${short(slot)}: ${chosen.missed}`);
      continue;
    }
    // The program requires `fetched_at <= now` on chain; a read stamped ahead of the chain clock waits for it.
    if (chainNow < chosen.fetchedAtSec) {
      wake(chosen.fetchedAtSec + 1);
      parts.push(`${short(slot)}: chain clock ${chosen.fetchedAtSec - chainNow}s behind the read`);
      continue;
    }
    if (ctx.dryRun) {
      parts.push(`DRY attested ${short(slot)} @ ${chosen.priceE8}${chosen.unit} read T+${chosen.fetchedAtSec - slot.boundarySec}s`);
      continue;
    }
    let outcome: SlotOutcome | null = null;
    if (slot.slot === "open") {
      const copied = await copyOpenSlot(ctx.client, slot);
      const noPrev = copied.code === SWITCHBOARD_ERROR.printNotAdjacent || copied.code === SWITCHBOARD_ERROR.printsMissing;
      if (!noPrev) outcome = copied;
    }
    outcome ??= await recordAttestedSlot(ctx.client, slot, {
      attestor,
      clusterTag: ctx.prestocks.clusterTag,
      priceE8: chosen.priceE8,
      fetchedAtSec: chosen.fetchedAtSec,
    });
    if (outcome.status === "recorded") {
      ctx.counters.recorded++;
      ctx.failures.delete(key);
    } else if (outcome.status === "already") {
      ctx.counters.already++;
    } else if (outcome.status === "failed") {
      ctx.counters.failed++;
      ctx.failures.set(key, { attempts: attempts + 1, reason: `prestocks attested failed: ${outcome.error ?? ""}`.slice(0, 300) });
      wake(wall + RETRY_AFTER_SEC);
    }
    parts.push(`${short(slot)} ${outcome.status}${outcome.signature ? ` ${outcome.signature.slice(0, 8)}` : outcome.code ? ` (${outcome.code})` : ""}`);
  }
  const boundaries = [...new Set(slots.map((s) => iso(s.boundarySec)))].join(",");
  return { line: parts.length ? `prestocks T ${boundaries}: ${parts.join(", ")}` : null, nextSec };
}
