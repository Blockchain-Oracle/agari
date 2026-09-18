/**
 * What `init-events` ensures on a cluster: the launch grid, the authorities and the S2 Series set (plan §7.2 S2).
 * Values mirror the LiteSVM fixtures (`anchor/tests/src/fixtures.rs`), which the engine tests run against.
 */
import type { AdminRegisterSeriesInstructionDataArgs, AdminSetAuthoritiesInstructionDataArgs } from "@agari/clients/agari-events";
import { TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Address } from "@solana/kit";
import { asciiFeedId, I64_MAX, policyVersions, redstoneSigners, SOURCE, ZERO_POLICY, type PolicyVersionArgs, type PriceSources } from "./policies";

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
  /** Defaults: `BOOKS_PER_SERIES` × `BOOK_CAPACITY`. */
  books?: { count: number; capacity: 256 | 512 };
};

/** Drive-only Series id: never in the core ticker registry, so the app never lists it (D-027). */
export const DRIVE_TEST_TICKER = 900;
export const DRIVE_ATTESTED_FEED = asciiFeedId("agari-drive-attested:TSLA");

/**
 * The drive's test Series: an attested primary (10 s correction delay, 60 s bars) checked against RedStone TSLA, so one
 * real Window can exercise attested prints and a cross-check divergence void. One 256-node Book.
 */
export function driveTestSeries(sources: PriceSources): SeriesSpec {
  const tsla = policyVersions("TSLA", sources)[0]!;
  const redstoneCheck = policyVersions("TSLA", sources).find((v) => v.check.source === SOURCE.redstone)?.check;
  if (!redstoneCheck) throw new Error("price-sources.json: TSLA has no RedStone check version");
  const attested = { ...redstoneCheck, source: SOURCE.attested, feedId: DRIVE_ATTESTED_FEED, strictSec: 0, minDelaySec: 10, barLenSec: 60, openAdmissionSec: 900, closeAdmissionSec: 900 };
  return {
    key: "TEST-ATT-5m",
    symbol: "TSLA",
    ticker: DRIVE_TEST_TICKER,
    cadenceSec: 300,
    basis: BASIS.regular,
    params: LAUNCH_GRID,
    versions: [{ ...tsla, validUntilTs: I64_MAX, primary: attested, check: redstoneCheck }],
    books: { count: 1, capacity: 256 },
  };
}

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

/** The Pre-IPO lane's drive tickers (900–902 are the other drives); one id per PreStocks symbol. */
export const PRESTOCKS_TICKER_BASE = 910;
/** `prestocks-v1:OPENAI` is 19 B of the 32. The attestor signs this id, so it names the source and its version. */
export const preStocksFeedId = (symbol: string) => asciiFeedId(`prestocks-v1:${symbol}`);

/**
 * A PreStocks Pre-IPO Series (D-100): attested primary, no cross-check, 60 s bars, a 10 s correction delay and 15 min
 * to land each print. The missing check is the point — no second venue publishes a pre-IPO mark, so a check source
 * would void every Window (D-101). `validate_policy_version` admits `Source::None` only when the check is the zero
 * policy and divergence is zero, which is exactly this shape. The attestor's signature over the 158 B message is the
 * whole guarantee, and the README says so. One 256-node Book.
 */
export function preStocksSeries(symbol: string, ticker: number, cadenceSec = 300): SeriesSpec {
  const primary = {
    ...ZERO_POLICY,
    source: SOURCE.attested,
    feedId: preStocksFeedId(symbol),
    minDelaySec: 10,
    barLenSec: 60,
    openAdmissionSec: 900,
    closeAdmissionSec: 900,
  };
  return {
    key: `PRE-${symbol}-${cadenceSec / 60}m`,
    // The chain stores the numeric `ticker`; this label never leaves the deploy record. A PreStocks name is
    // deliberately absent from `TICKERS` (no NYSE clock, no price-source version), so it is cast, not added there.
    symbol: symbol as TickerSymbol,
    ticker,
    cadenceSec,
    basis: BASIS.regular,
    params: LAUNCH_GRID,
    versions: [{ validFromTs: 0n, validUntilTs: I64_MAX, primary, check: ZERO_POLICY, maxDivergenceBps: 0, checkAdmissionSec: 0 }],
    books: { count: 1, capacity: 256 },
  };
}
