/**
 * The basket index over the PreStocks feed's same-fetch snapshots (S19, D-124). Pure: every function reads a list of
 * `PreStocksSnapshot` (one per catalogue read, oldest first) and computes `basketIndexE8` from core over the member
 * prices of ONE read, so the index a Window settles on can never mix two fetches. A snapshot missing any member (absent
 * from the catalogue, or a mint the registry does not know) has no index: the accessors skip it rather than fill it.
 * Units are points at expo −8 (`1e11` = 1,000.00000000 pts), never dollars.
 */
import { basketIndexE8, type Basket, type BasketSymbol, type PreIpoSymbol } from "@agari/core/market";
import type { PreStocksSnapshot } from "./prestocks-spot";

export interface BasketIndexSample {
  symbol: BasketSymbol;
  /** The index in points × 10⁸. */
  indexE8: bigint;
  /** The read the index came from: every member's price is from this one fetch. */
  fetchedAtSec: number;
}

/** The index of `basket` at this read, or null when the read did not price every member. */
export function indexOfSnapshot(basket: Basket, snapshot: PreStocksSnapshot): BasketIndexSample | null {
  const prices = new Map<PreIpoSymbol, bigint>();
  for (const m of basket.members) {
    const sample = snapshot.samples.get(m.symbol);
    if (!sample) return null;
    prices.set(m.symbol, sample.tokenPriceE8);
  }
  const indexE8 = basketIndexE8(basket.members, prices);
  return indexE8 === null ? null : { symbol: basket.symbol, indexE8, fetchedAtSec: snapshot.fetchedAtSec };
}

/** Every complete read's index, oldest first. */
export function basketIndexHistory(snapshots: readonly PreStocksSnapshot[], basket: Basket): BasketIndexSample[] {
  const out: BasketIndexSample[] = [];
  for (const snapshot of snapshots) {
    const sample = indexOfSnapshot(basket, snapshot);
    if (sample) out.push(sample);
  }
  return out;
}

/** The newest complete read's index, or null when none is within `maxAgeSec` of `nowSec` (default 30 s, like `latest`). */
export function basketIndexLatest(snapshots: readonly PreStocksSnapshot[], basket: Basket, nowSec: number, maxAgeSec = 30): BasketIndexSample | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snapshot = snapshots[i]!;
    if (snapshot.fetchedAtSec < nowSec - maxAgeSec) return null;
    const sample = indexOfSnapshot(basket, snapshot);
    if (sample) return sample;
  }
  return null;
}

/** The newest complete read at or before `sec`, when it is inside `[sec − windowSec, sec]` (default 15 s, like `at`); else null. */
export function basketIndexAt(snapshots: readonly PreStocksSnapshot[], basket: Basket, sec: number, windowSec = 15): BasketIndexSample | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snapshot = snapshots[i]!;
    if (snapshot.fetchedAtSec > sec) continue;
    if (snapshot.fetchedAtSec < sec - windowSec) return null;
    const sample = indexOfSnapshot(basket, snapshot);
    if (sample) return sample;
  }
  return null;
}
