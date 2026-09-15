import { z } from "zod";
import type { LaneBasis } from "../types/market";
import { toAddress, type Address, type Hash32 } from "../types/primitives";

/**
 * The equity universe Agari can list (plan §2.2, D-011).
 *
 * This registry says what each ticker IS: its on-chain series id, feed ids, venue symbols and the
 * verified xStock token. It does not say whether a lane is live. That depends on a signed source
 * covering the Window, which lives in dated policy versions (`services/ops/config/price-sources.json`,
 * mirrored on-chain per Series), so a ticker here can still show "paused: no signed source".
 */

export const TICKER_SYMBOLS = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "QQQ", "VOO", "SPY"] as const;
export type TickerSymbol = (typeof TICKER_SYMBOLS)[number];

export const XSTOCK_SYMBOLS = ["TSLAx", "NVDAx", "SPYx", "QQQx"] as const;
export type XStockSymbol = (typeof XSTOCK_SYMBOLS)[number];

export const ONDO_SYMBOLS = ["TSLAon", "NVDAon", "SPYon", "QQQon"] as const;
export type OndoSymbol = (typeof ONDO_SYMBOLS)[number];

/** Signed prints are normalized to this exponent on-chain (price × 10⁻⁸), whatever the source's own. */
export const PRINT_EXPO = -8;

/** A tokenized share traded 24/7 on Solana: the token lane's underlying. Mainnet mint, pinned (impostor tokens exist). */
export interface XStock {
  symbol: XStockSymbol;
  mint: Address;
  /** Switchboard Surge task symbol for the token lane (S6). */
  surgeSymbol: string;
}

/** An Ondo Global Markets token (Token-2022, 9 dp, ScaledUiAmount): read-only for the holdings hedge (S6 §4), never traded. */
export interface OndoStock {
  symbol: OndoSymbol;
  mint: Address;
}

export interface Ticker {
  symbol: TickerSymbol;
  /**
   * The `ticker: u16` seed of `["series", ticker, cadence, basis]` in agari-events. Permanent: a
   * number is never reused or renumbered, because it is part of every Series address.
   */
  seriesId: number;
  name: string;
  kind: "stock" | "etf";
  alpacaSymbol: string;
  /** Pyth `Equity.US.<T>/USD` feed id (Hermes, fetched 2026-09-14). Only TSLA, QQQ and VOO are in the trial. */
  pythFeedId: Hash32;
  /** RedStone `redstone-primary-prod` data feed id; null where RedStone has no feed (ETFs). */
  redstoneFeedId: string | null;
  /** In the launch set's Regular lane. SPY is here only as the SPYx token lane's underlying until a signed source exists. */
  launch: boolean;
  xstock: XStock | null;
  /** Mainnet mint verified 2026-09-15 (owner Token-2022, 9 dp, metadata symbol matches; C:01 §3.1). */
  ondo: OndoStock | null;
  /** Typed on the asset disc until a drawn mark exists. */
  monogram: string;
}

const xstock = (symbol: XStockSymbol, mint: string, surgeSymbol: string): XStock => ({ symbol, mint: toAddress(mint), surgeSymbol });
const ondo = (symbol: OndoSymbol, mint: string): OndoStock => ({ symbol, mint: toAddress(mint) });

export const TICKERS: Readonly<Record<TickerSymbol, Ticker>> = {
  TSLA: {
    symbol: "TSLA", seriesId: 1, name: "Tesla", kind: "stock", alpacaSymbol: "TSLA",
    pythFeedId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1", redstoneFeedId: "TSLA", launch: true,
    xstock: xstock("TSLAx", "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", "TSLAX/USD"), ondo: ondo("TSLAon", "KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo"), monogram: "T",
  },
  NVDA: {
    symbol: "NVDA", seriesId: 2, name: "NVIDIA", kind: "stock", alpacaSymbol: "NVDA",
    pythFeedId: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", redstoneFeedId: "NVDA", launch: true,
    xstock: xstock("NVDAx", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", "NVDAX/USD"), ondo: ondo("NVDAon", "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo"), monogram: "N",
  },
  AAPL: {
    symbol: "AAPL", seriesId: 3, name: "Apple", kind: "stock", alpacaSymbol: "AAPL",
    pythFeedId: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688", redstoneFeedId: "AAPL", launch: true,
    xstock: null, ondo: null, monogram: "A",
  },
  MSFT: {
    symbol: "MSFT", seriesId: 4, name: "Microsoft", kind: "stock", alpacaSymbol: "MSFT",
    pythFeedId: "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1", redstoneFeedId: "MSFT", launch: true,
    xstock: null, ondo: null, monogram: "M",
  },
  META: {
    symbol: "META", seriesId: 5, name: "Meta", kind: "stock", alpacaSymbol: "META",
    pythFeedId: "0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe", redstoneFeedId: "META", launch: true,
    xstock: null, ondo: null, monogram: "M",
  },
  AMZN: {
    symbol: "AMZN", seriesId: 6, name: "Amazon", kind: "stock", alpacaSymbol: "AMZN",
    pythFeedId: "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a", redstoneFeedId: "AMZN", launch: true,
    xstock: null, ondo: null, monogram: "A",
  },
  GOOGL: {
    symbol: "GOOGL", seriesId: 7, name: "Alphabet", kind: "stock", alpacaSymbol: "GOOGL",
    pythFeedId: "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6", redstoneFeedId: "GOOGL", launch: true,
    xstock: null, ondo: null, monogram: "G",
  },
  QQQ: {
    symbol: "QQQ", seriesId: 8, name: "Invesco QQQ", kind: "etf", alpacaSymbol: "QQQ",
    pythFeedId: "0x9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d", redstoneFeedId: null, launch: true,
    xstock: xstock("QQQx", "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", "QQQX/USD"), ondo: ondo("QQQon", "HrYNm6jTQ71LoFphjVKBTdAE4uja7WsmLG8VxB8ondo"), monogram: "Q",
  },
  VOO: {
    symbol: "VOO", seriesId: 9, name: "Vanguard S&P 500", kind: "etf", alpacaSymbol: "VOO",
    pythFeedId: "0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179", redstoneFeedId: null, launch: true,
    xstock: null, ondo: null, monogram: "V",
  },
  SPY: {
    symbol: "SPY", seriesId: 10, name: "SPDR S&P 500", kind: "etf", alpacaSymbol: "SPY",
    pythFeedId: "0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5", redstoneFeedId: null, launch: false,
    xstock: xstock("SPYx", "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", "SPYX/USD"), ondo: ondo("SPYon", "k18WJUULWheRkSpSquYGdNNmtuE2Vbw1hpuUi92ondo"), monogram: "S",
  },
};

/** Series ids 11 (COIN) and 12 (MSTR) are reserved for the deferred tickers; they return with a signed source. */
export const RESERVED_SERIES_IDS: Readonly<Record<number, string>> = { 11: "COIN", 12: "MSTR" };

export const LAUNCH_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);
export const TOKEN_LANE_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].xstock !== null);

/** One verified tokenized share of a registry ticker, as the holdings reader keys it (always by mint, never by symbol). */
export interface ShareToken {
  symbol: XStockSymbol | OndoSymbol;
  mint: Address;
  issuer: "xstocks" | "ondo";
  underlying: TickerSymbol;
}

export const SHARE_TOKENS: readonly ShareToken[] = TICKER_SYMBOLS.flatMap((symbol) => {
  const { xstock: x, ondo: o } = TICKERS[symbol];
  return [
    ...(x ? [{ symbol: x.symbol, mint: x.mint, issuer: "xstocks" as const, underlying: symbol }] : []),
    ...(o ? [{ symbol: o.symbol, mint: o.mint, issuer: "ondo" as const, underlying: symbol }] : []),
  ];
});

/**
 * The ops lane key (roller heartbeat, `/session.lanes`): `TSLA-5m` Regular, `TSLA-gap` Gap, `TSLAx-5m` token. Cadences
 * count minutes (`TSLA-60m`), not `formatCadence`'s `1h`, because the soak and web already key Regular lanes that way.
 */
export function laneKey(symbol: TickerSymbol, basis: LaneBasis, cadenceSec: number): string {
  if (basis === "gap") return `${symbol}-gap`;
  const asset = basis === "token" ? (TICKERS[symbol].xstock?.symbol ?? symbol) : symbol;
  return `${asset}-${cadenceSec / 60}m`;
}

export const isTickerSymbol = (v: unknown): v is TickerSymbol => typeof v === "string" && (TICKER_SYMBOLS as readonly string[]).includes(v);

export const tickerSymbolSchema = z.enum(TICKER_SYMBOLS);

const BY_SERIES_ID = new Map(TICKER_SYMBOLS.map((symbol) => [TICKERS[symbol].seriesId, TICKERS[symbol]] as const));

export function tickerBySeriesId(seriesId: number): Ticker | null {
  return BY_SERIES_ID.get(seriesId) ?? null;
}

/** The ticker whose xStock this is, e.g. `TSLAx` → TSLA. */
export function tickerOfXStock(symbol: XStockSymbol): Ticker {
  const found = TICKER_SYMBOLS.map((s) => TICKERS[s]).find((t) => t.xstock?.symbol === symbol);
  if (!found) throw new Error(`no ticker for xStock ${symbol}`);
  return found;
}
