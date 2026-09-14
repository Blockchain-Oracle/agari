/**
 * What `init-events` ensures on a cluster: the launch grid, the authorities and the S2 Series set (plan §7.2 S2).
 * Values mirror the LiteSVM fixtures (`anchor/tests/src/fixtures.rs`), which the engine tests run against.
 */
import type { AdminRegisterSeriesInstructionDataArgs, AdminSetAuthoritiesInstructionDataArgs } from "@agari/clients/agari-events";
import { TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Address } from "@solana/kit";
import { policyVersions, redstoneSigners, type PolicyVersionArgs, type PriceSources } from "./policies";

export const DEFAULT_ADDRESS = "11111111111111111111111111111111" as Address;
export const COLLATERAL_DECIMALS = 6;
/** PD-7 default: a resolved Window's Market and MarketResult close 6 h after resolution. */
export const RESULT_RETENTION_SEC = 21_600;
/** Regular 5m books hold 512 nodes (plan §4 SOL budget); two per Series. */
export const BOOK_CAPACITY = 512;
export const BOOKS_PER_SERIES = 2;
export const BASIS = { regular: 0, gap: 1, token: 2 } as const;

/** `8 + 32,384 + 48 · capacity` (events-accounts.md §3.8). */
export const bookSpace = (capacity: number) => 8 + 32_384 + 48 * capacity;

type SeriesParams = Omit<AdminRegisterSeriesInstructionDataArgs, "ticker" | "cadenceSec" | "basis">;

/** The launch grid: lot = tick = 1,000 base units on 6-dp collateral (cash unit 1), 0.25 tUSDC seat bond, ~20 s rest filter. */
export const LAUNCH_GRID: SeriesParams = {
  lotBase: 1_000n,
  tickBase: 1_000n,
  minLots: 1_000n,
  seatBond: 250_000n,
  minRestSlots: 50,
  maxLeadSec: 400_000,
  fillsCap: 16,
  evictionsCap: 16,
};

export type SeriesSpec = {
  /** Record key, e.g. `TSLA-5m`. */
  key: string;
  symbol: TickerSymbol;
  ticker: number;
  cadenceSec: number;
  basis: number;
  params: SeriesParams;
  versions: PolicyVersionArgs[];
};

/** S2's Series: TSLA (Pyth + RedStone check, then RedStone) and NVDA (RedStone), Regular 5m. */
export function s2Series(sources: PriceSources): SeriesSpec[] {
  return (["TSLA", "NVDA"] as const).map((symbol) => ({
    key: `${symbol}-5m`,
    symbol,
    ticker: TICKERS[symbol].seriesId,
    cadenceSec: 300,
    basis: BASIS.regular,
    params: LAUNCH_GRID,
    versions: policyVersions(symbol, sources),
  }));
}

export type AuthorityKeys = { roller: Address; attestor: Address };

export function s2Authorities(keys: AuthorityKeys, sources: PriceSources): AdminSetAuthoritiesInstructionDataArgs {
  const pad = (list: Address[], size: number) => [...list, ...Array<Address>(size - list.length).fill(DEFAULT_ADDRESS)];
  return {
    rollers: pad([keys.roller], 4),
    attestors: pad([keys.attestor], 4),
    redstoneSigners: redstoneSigners(sources),
    redstoneSignerCount: 5,
    redstoneThreshold: sources.defaults.redstone.threshold,
    // Placeholder until S6 pins the Switchboard queue (a zero queue needs no minimum).
    switchboardQueue: DEFAULT_ADDRESS,
    switchboardMinOracles: 0,
    programAuthorities: pad([], 8),
    resultRetentionSec: RESULT_RETENTION_SEC,
  };
}
