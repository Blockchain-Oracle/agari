/**
 * Venue reads every actor shares (venue-ops.md §4): Series and Markets decoded from chain, batched.
 * `getProgramAccounts` is for boot and slow refreshes only; steady-state reads go through `fetchMarkets`.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getMarketDecoder,
  getSeriesDecoder,
  MARKET_DISCRIMINATOR,
  SERIES_DISCRIMINATOR,
  type Market,
  type Series,
} from "@agari/clients/agari-events";
import { laneKey, TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { laneBasisOf, type LaneBasis } from "@agari/core/types";
import { getBase58Decoder, getBase64Encoder, type Address, type Base58EncodedBytes, type ReadonlyUint8Array } from "@solana/kit";
import type { OpsClient } from "./client";

export type SeriesView = { address: Address; symbol: TickerSymbol | null; data: Series };
export type MarketView = { address: Address; data: Market };

/** `Market.state` (events-accounts.md §2). */
export const MARKET_STATE = { open: 0, resolved: 1, voided: 2 } as const;
/** `Market.flags` bits. */
export const MARKET_FLAG = { bookReleased: 1, ledgerClosed: 2, singleSource: 4 } as const;

export type MarketStatus = "listed" | "trading" | "locked" | "resolved" | "voided";

/** events-engine.md §7 `status(m, now)`. */
export function marketStatus(m: Market, nowSec: number): MarketStatus {
  if (m.state === MARKET_STATE.resolved) return "resolved";
  if (m.state === MARKET_STATE.voided) return "voided";
  if (nowSec < Number(m.tradingStart)) return "listed";
  return nowSec < Number(m.lockAt) ? "trading" : "locked";
}

export const isTerminal = (m: Market) => m.state !== MARKET_STATE.open;

/** The Series' lane, or null for a basis this build doesn't know (actors skip it). */
export const seriesBasis = (s: SeriesView): LaneBasis | null => laneBasisOf(s.data.basis);

/**
 * The ops lane key every actor logs and `/session.lanes` reports (`TSLA-5m`, `TSLA-gap`, `TSLAx-5m`, core `laneKey`);
 * `#<ticker>-<basis>-<cadence>` for a Series outside the registry or of an unknown basis.
 */
export function seriesLaneKey(s: SeriesView): string {
  const basis = seriesBasis(s);
  return s.symbol && basis ? laneKey(s.symbol, basis, s.data.cadenceSec) : `#${s.data.ticker}-${s.data.basis}-${s.data.cadenceSec}`;
}

const SYMBOL_BY_SERIES_ID = new Map<number, TickerSymbol>(TICKER_SYMBOLS.map((s) => [TICKERS[s].seriesId, s]));
const base58 = (bytes: ReadonlyUint8Array) => getBase58Decoder().decode(bytes) as Base58EncodedBytes;
const bytesOf = (b64: string) => getBase64Encoder().encode(b64);
const MARKET_SERIES_OFFSET = 8n;
const MULTIPLE_ACCOUNTS_MAX = 100;

/**
 * Every Series of the program. `symbol` is null for ids outside the core registry (e.g. the drive-only Series 900),
 * which actors skip.
 */
export async function listSeries(client: OpsClient): Promise<SeriesView[]> {
  const rows = await client.rpc
    .getProgramAccounts(AGARI_EVENTS_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [{ memcmp: { offset: 0n, bytes: base58(SERIES_DISCRIMINATOR), encoding: "base58" } }],
    })
    .send();
  const decoder = getSeriesDecoder();
  return rows
    .map((row) => {
      const data = decoder.decode(bytesOf(row.account.data[0]));
      return { address: row.pubkey, symbol: SYMBOL_BY_SERIES_ID.get(data.ticker) ?? null, data };
    })
    .sort((a, b) => a.data.ticker - b.data.ticker || a.data.basis - b.data.basis || a.data.cadenceSec - b.data.cadenceSec);
}

/** Every Market account of one Series that still exists (closed Markets are gone). Boot and slow refresh only. */
export async function listMarketsOfSeries(client: OpsClient, series: Address): Promise<MarketView[]> {
  const rows = await client.rpc
    .getProgramAccounts(AGARI_EVENTS_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        { memcmp: { offset: 0n, bytes: base58(MARKET_DISCRIMINATOR), encoding: "base58" } },
        { memcmp: { offset: MARKET_SERIES_OFFSET, bytes: series as unknown as Base58EncodedBytes, encoding: "base58" } },
      ],
    })
    .send();
  const decoder = getMarketDecoder();
  return rows.map((row) => ({ address: row.pubkey, data: decoder.decode(bytesOf(row.account.data[0])) })).sort((a, b) => Number(a.data.index - b.data.index));
}

async function fetchDecoded<T>(client: OpsClient, addresses: readonly Address[], decode: (bytes: ReadonlyUint8Array) => T): Promise<Array<T | null>> {
  const out: Array<T | null> = [];
  for (let i = 0; i < addresses.length; i += MULTIPLE_ACCOUNTS_MAX) {
    const chunk = addresses.slice(i, i + MULTIPLE_ACCOUNTS_MAX);
    const { value } = await client.rpc.getMultipleAccounts(chunk, { encoding: "base64" }).send();
    for (const account of value) out.push(account ? decode(bytesOf(account.data[0])) : null);
  }
  return out;
}

/** Markets by address, in order, `null` where the account doesn't exist (not opened yet, or closed). */
export async function fetchMarkets(client: OpsClient, addresses: readonly Address[]): Promise<Array<MarketView | null>> {
  const decoder = getMarketDecoder();
  const rows = await fetchDecoded(client, addresses, (bytes) => decoder.decode(bytes));
  return rows.map((data, i) => (data ? { address: addresses[i]!, data } : null));
}

export async function fetchSeries(client: OpsClient, addresses: readonly Address[]): Promise<Array<SeriesView | null>> {
  const decoder = getSeriesDecoder();
  const rows = await fetchDecoded(client, addresses, (bytes) => decoder.decode(bytes));
  return rows.map((data, i) => (data ? { address: addresses[i]!, symbol: SYMBOL_BY_SERIES_ID.get(data.ticker) ?? null, data } : null));
}
