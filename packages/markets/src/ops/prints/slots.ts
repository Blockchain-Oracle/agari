/**
 * Print slots of a Market (prints.md §3–4, venue-ops.md §6.1): which boundary, which source and feed, and the
 * admission bounds, as plain data the relay schedules on. Pure over decoded accounts.
 */
import type { Print, PrintPolicy } from "@agari/clients/agari-events";
import type { LaneBasis } from "@agari/core/types";
import type { MarketView, SeriesView } from "../venue";
import { MARKET_STATE, seriesBasis, seriesLaneKey } from "../venue";

export type SlotName = "open" | "close" | "checkOpen" | "checkClose";
export type PrintSourceName = "pyth" | "redstone" | "switchboard" | "attested";

/** `which` on the wire: 0 open, 1 close, 2 check open, 3 check close. */
export const WHICH_OF: Record<SlotName, number> = { open: 0, close: 1, checkOpen: 2, checkClose: 3 };
const SOURCE_BY_ID: Record<number, PrintSourceName> = { 1: "pyth", 2: "redstone", 3: "switchboard", 4: "attested" };

export interface PrintSlot {
  series: string;
  market: string;
  /** The lane key (`TSLA-5m`, `TSLA-gap`, `TSLAx-5m`); the Series address when the ticker isn't in the core registry. */
  seriesKey: string;
  /** The Series' lane; relay passes dispatch on it (session-lanes.md §1.5, §2.4). Unknown bases count as Regular. */
  basis: LaneBasis;
  marketIndex: bigint;
  slot: SlotName;
  which: number;
  source: PrintSourceName;
  /** The boundary T. */
  boundarySec: number;
  /** `T + min_delay_sec`. */
  earliestSec: number;
  /** Last admissible second (inclusive). */
  deadlineSec: number;
  /** Pyth: lower-case feed id hex; attested: the source hash hex. */
  feedIdHex: string;
  /** RedStone: the ASCII data feed id (`TSLA`); null for other sources. */
  redstoneFeed: string | null;
  /** RedStone: every configured signer is required while `now ≤ T + strict_sec`. */
  strictSec: number;
  barLenSec: number;
}

const hex = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function asciiFeed(bytes: ArrayLike<number>): string {
  const list = Array.from(bytes);
  const end = list.indexOf(0);
  return String.fromCharCode(...(end === -1 ? list : list.slice(0, end)));
}

export const isPrintEmpty = (p: Print) => p.source === 0 && p.sourceTs === 0n;

export const seriesKeyOf = (s: SeriesView) => (s.symbol ? seriesLaneKey(s) : s.address);

function slotOf(s: SeriesView, m: MarketView, slot: SlotName, policy: PrintPolicy, boundarySec: number, deadlineSec: number): PrintSlot | null {
  const source = SOURCE_BY_ID[policy.source];
  if (!source) return null;
  return {
    series: s.address,
    market: m.address,
    seriesKey: seriesKeyOf(s),
    basis: seriesBasis(s) ?? "regular",
    marketIndex: m.data.index,
    slot,
    which: WHICH_OF[slot],
    source,
    boundarySec,
    earliestSec: boundarySec + policy.minDelaySec,
    deadlineSec,
    feedIdHex: hex(policy.feedId),
    redstoneFeed: source === "redstone" ? asciiFeed(policy.feedId) : null,
    strictSec: policy.strictSec,
    barLenSec: policy.barLenSec,
  };
}

/** Every still-empty slot of a non-terminal Market, whatever the clock says (the caller checks admission). */
export function emptySlots(series: SeriesView, market: MarketView): PrintSlot[] {
  const m = market.data;
  if (m.state !== MARKET_STATE.open) return [];
  const version = series.data.policyVersions[m.policyVersion];
  if (!version) return [];
  const [start, expiry] = [Number(m.tradingStart), Number(m.expiry)];
  const out: Array<PrintSlot | null> = [];
  if (isPrintEmpty(m.open)) out.push(slotOf(series, market, "open", version.primary, start, Number(m.openDeadline)));
  if (isPrintEmpty(m.close)) out.push(slotOf(series, market, "close", version.primary, expiry, Number(m.closeDeadline)));
  if (version.check.source !== 0) {
    if (isPrintEmpty(m.checkOpen)) out.push(slotOf(series, market, "checkOpen", version.check, start, start + version.checkAdmissionSec));
    if (isPrintEmpty(m.checkClose)) out.push(slotOf(series, market, "checkClose", version.check, expiry, expiry + version.checkAdmissionSec));
  }
  return out.filter((s): s is PrintSlot => s !== null);
}

/** Nothing left for a relay to do: terminal, or every empty slot is past its deadline. */
export function relayFinished(series: SeriesView, market: MarketView, nowSec: number): boolean {
  return emptySlots(series, market).every((s) => nowSec > s.deadlineSec);
}

/** Price × 10^expo → price × 10⁻⁸, exactly; refuses a value that would lose digits. */
export function toE8(price: bigint, expo: number): bigint {
  const shift = 8 + expo;
  if (shift >= 0) return price * 10n ** BigInt(shift);
  const div = 10n ** BigInt(-shift);
  if (price % div !== 0n) throw new Error(`${price}e${expo} is not exact at expo -8`);
  return price / div;
}
