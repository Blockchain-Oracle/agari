/**
 * Which read a basket print is signed from (S19, D-124): the first same-fetch snapshot that priced EVERY member inside
 * the slot's honest window `[T + min_delay, T + PRESTOCKS_MAX_LATE_SEC]`. A read that priced only some members is not a
 * price of the basket and is skipped, never completed from an older read. Nothing is clamped: a boundary with no
 * complete read inside its window lets the Window void on a missing print rather than sign a late index as that bar.
 * Pure over the feed's snapshots (oldest first); the same shape as `chooseSample` for a single name.
 */
import type { Basket } from "@agari/core/market";
import { PRESTOCKS_MAX_LATE_SEC, type PrintSlot } from "@agari/markets/ops/prints";
import { indexOfSnapshot, type BasketIndexSample } from "../../prices/basket-index";
import type { PreStocksSnapshot } from "../../prices/prestocks-spot";

export function chooseBasketSample(
  snapshots: readonly PreStocksSnapshot[],
  basket: Basket,
  slot: Pick<PrintSlot, "boundarySec" | "earliestSec">,
  wallSec: number,
): { sample: BasketIndexSample } | { waiting: string } | { missed: string } {
  const latestSec = slot.boundarySec + PRESTOCKS_MAX_LATE_SEC;
  let incomplete = 0;
  for (const snapshot of snapshots) {
    if (snapshot.fetchedAtSec < slot.earliestSec || snapshot.fetchedAtSec > latestSec) continue;
    const sample = indexOfSnapshot(basket, snapshot);
    if (sample) return { sample };
    incomplete++;
  }
  const window = `[T+${slot.earliestSec - slot.boundarySec}s, T+${PRESTOCKS_MAX_LATE_SEC}s]`;
  const partial = incomplete ? ` (${incomplete} read(s) missed a member)` : "";
  return wallSec <= latestSec
    ? { waiting: `no complete PreStocks read of ${basket.symbol} yet inside ${window}${partial}` }
    : { missed: `no complete PreStocks read of ${basket.symbol} landed inside ${window}${partial}; the Window voids` };
}
