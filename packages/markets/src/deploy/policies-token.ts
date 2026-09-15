/**
 * Switchboard and attested print policies for the 24/7 token lane (session-lanes.md §2.4–2.5). Lane 6b owns this file.
 *
 * Token versions live in `price-sources.json` `tokenLane.versions` (shared by the four xStocks) with each xStock's
 * feed in `tokenLane.tickers.<xStock>`: Switchboard's pinned Surge feed hash (D-053) or, for an opt-in attested fallback
 * version, `sha256("jupiter-price-v3-median3:<xStock>")`. A null feed hash refuses, so nothing lists unpinned.
 */
import { createHash } from "node:crypto";
import type { PrintPolicyInput } from "@agari/clients/agari-events";
import { TICKERS, type TickerSymbol, type XStockSymbol } from "@agari/core/market";
import { hexBytes, I64_MAX, SOURCE, ZERO_POLICY, type PolicyVersionArgs, type PriceSources, type SourceName, type TickerSources } from "./policies";

export type TokenLaneSources = {
  versions: Array<{ version: number; validFrom: string; validUntil: string | null; primary: SourceName; check: SourceName | null }>;
  tickers: Partial<Record<XStockSymbol, { mint: string; surgeSymbol: string; feedHash: string | null }>>;
};

type WithTokenLane = PriceSources & { tokenLane?: TokenLaneSources };

/** The attested fallback's source hash (prints.md §4.3 `feed_id`; session-lanes.md §2.5). */
export const jupiterAttestedFeedId = (xstock: XStockSymbol) => Uint8Array.from(createHash("sha256").update(`jupiter-price-v3-median3:${xstock}`).digest());

function laneOf(sources: PriceSources): TokenLaneSources {
  const lane = (sources as WithTokenLane).tokenLane;
  if (!lane?.versions?.length) throw new Error("price-sources.json: tokenLane.versions is missing");
  return lane;
}

function xstockOf(symbol: string): XStockSymbol {
  const xstock = TICKERS[symbol as TickerSymbol]?.xstock?.symbol;
  if (!xstock) throw new Error(`${symbol} has no xStock token lane`);
  return xstock;
}

function policyForXStock(source: SourceName, xstock: XStockSymbol, sources: PriceSources): PrintPolicyInput {
  if (source === "switchboard") {
    const d = sources.defaults.switchboard;
    const feedHash = laneOf(sources).tickers[xstock]?.feedHash;
    if (!d) throw new Error("price-sources.json: defaults.switchboard is missing");
    if (!feedHash) throw new Error(`price-sources.json: tokenLane.tickers.${xstock}.feedHash is not pinned (D-053)`);
    return {
      ...ZERO_POLICY, source: SOURCE.switchboard, feedId: hexBytes(feedHash, 32), minDelaySec: d.minDelaySec, maxSlotAge: d.maxSlotAge,
      openAdmissionSec: d.admissionSec, closeAdmissionSec: d.admissionSec,
    };
  }
  if (source === "attested") {
    const d = sources.defaults.attested;
    if (!d) throw new Error("price-sources.json: defaults.attested is missing");
    return {
      ...ZERO_POLICY, source: SOURCE.attested, feedId: jupiterAttestedFeedId(xstock), minDelaySec: d.minDelaySec, barLenSec: d.barLenSec,
      openAdmissionSec: d.admissionSec, closeAdmissionSec: d.admissionSec,
    };
  }
  throw new Error(`${source} is not a token-lane source`);
}

function unixSec(iso: string): bigint {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms % 1000 !== 0) throw new Error(`bad timestamp "${iso}"`);
  return BigInt(ms / 1000);
}

/** The token lane's versions for a ticker (`TSLA` → the TSLAx Series), in index order. No check: one source per Window. */
export function tokenPolicyVersions(symbol: string, sources: PriceSources): PolicyVersionArgs[] {
  const xstock = xstockOf(symbol);
  return [...laneOf(sources).versions]
    .sort((a, b) => a.version - b.version)
    .map((v, i) => {
      if (v.version !== i + 1) throw new Error("tokenLane: versions must be 1..n without gaps");
      if (v.check !== null) throw new Error("tokenLane: token versions carry no check");
      return {
        validFromTs: unixSec(v.validFrom),
        validUntilTs: v.validUntil === null ? I64_MAX : unixSec(v.validUntil),
        primary: policyForXStock(v.primary, xstock, sources),
        check: ZERO_POLICY,
        maxDivergenceBps: 0,
        checkAdmissionSec: 0,
      };
    });
}

/** A session ticker version naming a token source: the feed follows the ticker's xStock (`surgeSymbol` in the ticker entry). */
export function tokenPolicyFor(source: SourceName, ticker: TickerSources, sources: PriceSources, check: boolean): PrintPolicyInput {
  if (check) throw new Error(`${source} cannot be a check policy`);
  const surge = (ticker as TickerSources & { surgeSymbol?: string }).surgeSymbol;
  const entry = Object.entries(laneOf(sources).tickers).find(([, t]) => t?.surgeSymbol === surge);
  if (!surge || !entry) throw new Error(`${source} source on a ticker without a token lane`);
  return policyForXStock(source, entry[0] as XStockSymbol, sources);
}
