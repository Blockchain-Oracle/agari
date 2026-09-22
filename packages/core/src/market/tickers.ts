import { z } from "zod";
import { GAP_CADENCE_SEC, type LaneBasis } from "../types/market";
import { toAddress, type Address, type Hash32 } from "../types/primitives";
import { BASKET_SYMBOLS, BASKETS, type BasketSymbol } from "./baskets";

/**
 * The equity universe Agari can list (plan §2.2, D-011).
 *
 * This registry says what each ticker IS: its on-chain series id, feed ids, venue symbols and the
 * verified xStock token. It does not say whether a lane is live. That depends on a signed source
 * covering the Window, which lives in dated policy versions (`services/ops/config/price-sources.json`,
 * mirrored on-chain per Series), so a ticker here can still show "paused: no signed source".
 */

/** The eight PreStocks pre-IPO names (D-100). Series ids 910–917; every mint verified on mainnet 2026-09-19 (Token-2022, 9 dp, scaledUiAmount). */
export const PRE_IPO_SYMBOLS = ["OPENAI", "ANTHROPIC", "SPACEX", "NEURALINK", "ANDURIL", "KALSHI", "POLYMARKET", "FIGUREAI"] as const;
export type PreIpoSymbol = (typeof PRE_IPO_SYMBOLS)[number];

export const TICKER_SYMBOLS = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "QQQ", "VOO", "SPY", ...PRE_IPO_SYMBOLS, ...BASKET_SYMBOLS] as const;
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

/**
 * A PreStocks pre-IPO token (D-100): an SPV claim on a private company, traded 24/7 on Solana. The mint is what the
 * catalogue calls `contract_address`. A pre-IPO name has no exchange listing, so it has no Alpaca symbol, no Pyth feed
 * and no session calendar; its price comes from the PreStocks catalogue and the venue attests it (`SOURCE.attested`).
 */
export interface PreIpoToken {
  /** The catalogue's own symbol, which is also the registry key. */
  symbol: PreIpoSymbol;
  mint: Address;
}

/** An Ondo Global Markets token (Token-2022, 9 dp, ScaledUiAmount): read-only for the holdings hedge (S6 §4), never traded. */
export interface OndoStock {
  symbol: OndoSymbol;
  mint: Address;
}

/** The `--brand-<slug>` custom property in `web/src/styles/icons.css` and the `.mark-<slug>-disc` fill. */
export const BRAND_SLUGS = [
  "tesla", "nvidia", "apple", "microsoft", "meta", "amazon", "google", "invesco", "vanguard", "spdr",
  // Pre-IPO names (D-100): approximate brand colours, chosen for contrast under the typed monogram.
  "openai", "anthropic", "spacex", "neuralink", "anduril", "kalshi", "polymarket", "figure",
  // Baskets (S19, D-124): composed marks over the member discs; the colour is the basket's own.
  "ailabs", "frontier", "predmkts", "defspace", "preall",
] as const;
export type BrandSlug = (typeof BRAND_SLUGS)[number];

/**
 * The asset's own colour (D-085): the registry is the single source, `icons.css` mirrors it as `--brand-<slug>` for
 * the discs, and the share-card canvas reads `hex` by import. For a stock it is the issuer's mark colour as
 * simple-icons records it; for an ETF it is the fund house's, under the typed monogram (no clean SVG exists).
 */
export interface Brand {
  slug: BrandSlug;
  /** `#RRGGBB`, upper-case. */
  hex: string;
}

export interface Ticker {
  symbol: TickerSymbol;
  /**
   * The `ticker: u16` seed of `["series", ticker, cadence, basis]` in agari-events. Permanent: a
   * number is never reused or renumbered, because it is part of every Series address.
   */
  seriesId: number;
  name: string;
  kind: "stock" | "etf" | "preIpo" | "basket";
  /** Alpaca calendar/bars symbol; null for a pre-IPO name, which no exchange lists. */
  alpacaSymbol: string | null;
  /** Pyth `Equity.US.<T>/USD` feed id (Hermes, fetched 2026-09-14). Only TSLA, QQQ and VOO are in the trial; null where Pyth has no feed. */
  pythFeedId: Hash32 | null;
  /** RedStone `redstone-primary-prod` data feed id; null where RedStone has no feed (ETFs). */
  redstoneFeedId: string | null;
  /** In the launch set's Regular lane. SPY is here only as the SPYx token lane's underlying until a signed source exists. */
  launch: boolean;
  xstock: XStock | null;
  /** Mainnet mint verified 2026-09-15 (owner Token-2022, 9 dp, metadata symbol matches; C:01 §3.1). */
  ondo: OndoStock | null;
  /** The PreStocks token for a pre-IPO name; null for every exchange-listed ticker and every basket. */
  preIpo: PreIpoToken | null;
  /** The basket this row is (S19, D-124), whose members and index live in `baskets.ts`; null for every single name. */
  basket: BasketSymbol | null;
  /** Typed on the asset disc when no glyph is drawn (the ETFs), and in the share text. */
  monogram: string;
  brand: Brand;
}

const xstock = (symbol: XStockSymbol, mint: string, surgeSymbol: string): XStock => ({ symbol, mint: toAddress(mint), surgeSymbol });
const ondo = (symbol: OndoSymbol, mint: string): OndoStock => ({ symbol, mint: toAddress(mint) });
const brand = (slug: BrandSlug, hex: string): Brand => ({ slug, hex });
const preIpo = (symbol: PreIpoSymbol, mint: string): PreIpoToken => ({ symbol, mint: toAddress(mint) });

/**
 * A basket row (S19, D-124): a registry ticker like any other so lanes, the roller, the maker, the hub and the cover
 * card key it by symbol, with every single-name field null; its members, weights and index live in `baskets.ts`.
 */
const BASKET_ROWS: Readonly<Record<BasketSymbol, Ticker>> = Object.fromEntries(
  BASKET_SYMBOLS.map((symbol) => {
    const b = BASKETS[symbol];
    const row: Ticker = {
      symbol, seriesId: b.seriesId, name: b.name, kind: "basket", alpacaSymbol: null,
      pythFeedId: null, redstoneFeedId: null, launch: false,
      xstock: null, ondo: null, preIpo: null, basket: symbol, monogram: b.monogram, brand: b.brand,
    };
    return [symbol, row] as const;
  }),
) as Record<BasketSymbol, Ticker>;

export const TICKERS: Readonly<Record<TickerSymbol, Ticker>> = {
  TSLA: {
    symbol: "TSLA", seriesId: 1, name: "Tesla", kind: "stock", alpacaSymbol: "TSLA",
    pythFeedId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1", redstoneFeedId: "TSLA", launch: true,
    xstock: xstock("TSLAx", "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", "TSLAX/USD"), ondo: ondo("TSLAon", "KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo"), preIpo: null, basket: null, monogram: "T", brand: brand("tesla", "#CC0000"),
  },
  NVDA: {
    symbol: "NVDA", seriesId: 2, name: "NVIDIA", kind: "stock", alpacaSymbol: "NVDA",
    pythFeedId: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", redstoneFeedId: "NVDA", launch: true,
    xstock: xstock("NVDAx", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", "NVDAX/USD"), ondo: ondo("NVDAon", "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo"), preIpo: null, basket: null, monogram: "N", brand: brand("nvidia", "#76B900"),
  },
  AAPL: {
    symbol: "AAPL", seriesId: 3, name: "Apple", kind: "stock", alpacaSymbol: "AAPL",
    pythFeedId: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688", redstoneFeedId: "AAPL", launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "A", brand: brand("apple", "#111111"),
  },
  MSFT: {
    symbol: "MSFT", seriesId: 4, name: "Microsoft", kind: "stock", alpacaSymbol: "MSFT",
    pythFeedId: "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1", redstoneFeedId: "MSFT", launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "M", brand: brand("microsoft", "#0078D4"),
  },
  META: {
    symbol: "META", seriesId: 5, name: "Meta", kind: "stock", alpacaSymbol: "META",
    pythFeedId: "0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe", redstoneFeedId: "META", launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "M", brand: brand("meta", "#0467DF"),
  },
  AMZN: {
    symbol: "AMZN", seriesId: 6, name: "Amazon", kind: "stock", alpacaSymbol: "AMZN",
    pythFeedId: "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a", redstoneFeedId: "AMZN", launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "A", brand: brand("amazon", "#FF9900"),
  },
  GOOGL: {
    symbol: "GOOGL", seriesId: 7, name: "Alphabet", kind: "stock", alpacaSymbol: "GOOGL",
    pythFeedId: "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6", redstoneFeedId: "GOOGL", launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "G", brand: brand("google", "#4285F4"),
  },
  QQQ: {
    symbol: "QQQ", seriesId: 8, name: "Invesco QQQ", kind: "etf", alpacaSymbol: "QQQ",
    pythFeedId: "0x9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d", redstoneFeedId: null, launch: true,
    xstock: xstock("QQQx", "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", "QQQX/USD"), ondo: ondo("QQQon", "HrYNm6jTQ71LoFphjVKBTdAE4uja7WsmLG8VxB8ondo"), preIpo: null, basket: null, monogram: "Q", brand: brand("invesco", "#0A2240"),
  },
  VOO: {
    symbol: "VOO", seriesId: 9, name: "Vanguard S&P 500", kind: "etf", alpacaSymbol: "VOO",
    pythFeedId: "0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179", redstoneFeedId: null, launch: true,
    xstock: null, ondo: null, preIpo: null, basket: null, monogram: "V", brand: brand("vanguard", "#96151D"),
  },
  SPY: {
    symbol: "SPY", seriesId: 10, name: "SPDR S&P 500", kind: "etf", alpacaSymbol: "SPY",
    pythFeedId: "0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5", redstoneFeedId: null, launch: false,
    xstock: xstock("SPYx", "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", "SPYX/USD"), ondo: ondo("SPYon", "k18WJUULWheRkSpSquYGdNNmtuE2Vbw1hpuUi92ondo"), preIpo: null, basket: null, monogram: "S", brand: brand("spdr", "#1F3A5F"),
  },
  /**
   * The first pre-IPO listing (D-100/D-101). Series id 910 matches `PRESTOCKS_TICKER_BASE`. No Alpaca symbol, no Pyth
   * feed and no RedStone feed exist for a private company, so its lane is attested-primary with no cross-check and it
   * never appears in the earnings calendar or the Pyth spot feed.
   */
  OPENAI: {
    symbol: "OPENAI", seriesId: 910, name: "OpenAI", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("OPENAI", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"), basket: null,
    monogram: "O", brand: brand("openai", "#412991"),
  },
  ANTHROPIC: {
    symbol: "ANTHROPIC", seriesId: 911, name: "Anthropic", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"), basket: null,
    monogram: "A", brand: brand("anthropic", "#D97757"),
  },
  SPACEX: {
    symbol: "SPACEX", seriesId: 912, name: "SpaceX", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("SPACEX", "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"), basket: null,
    monogram: "S", brand: brand("spacex", "#005288"),
  },
  NEURALINK: {
    symbol: "NEURALINK", seriesId: 913, name: "Neuralink", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("NEURALINK", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S"), basket: null,
    monogram: "N", brand: brand("neuralink", "#111111"),
  },
  ANDURIL: {
    symbol: "ANDURIL", seriesId: 914, name: "Anduril", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("ANDURIL", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"), basket: null,
    monogram: "A", brand: brand("anduril", "#1F2A44"),
  },
  KALSHI: {
    symbol: "KALSHI", seriesId: 915, name: "Kalshi", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("KALSHI", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua"), basket: null,
    monogram: "K", brand: brand("kalshi", "#00C389"),
  },
  POLYMARKET: {
    symbol: "POLYMARKET", seriesId: 916, name: "Polymarket", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("POLYMARKET", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP"), basket: null,
    monogram: "P", brand: brand("polymarket", "#1652F0"),
  },
  FIGUREAI: {
    symbol: "FIGUREAI", seriesId: 917, name: "Figure AI", kind: "preIpo", alpacaSymbol: null,
    pythFeedId: null, redstoneFeedId: null, launch: false,
    xstock: null, ondo: null, preIpo: preIpo("FIGUREAI", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd"), basket: null,
    monogram: "F", brand: brand("figure", "#F26522"),
  },
  ...BASKET_ROWS,
};

/** Series ids 11 (COIN) and 12 (MSTR) are reserved for the deferred tickers; they return with a signed source. */
export const RESERVED_SERIES_IDS: Readonly<Record<number, string>> = { 11: "COIN", 12: "MSTR" };

export const LAUNCH_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);
export const TOKEN_LANE_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].xstock !== null);
/** Pre-IPO names: no exchange listing, so no NYSE clock and no signed equity source (D-100). */
export const PRE_IPO_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].preIpo !== null);
/** Baskets of pre-IPO names (S19): like a pre-IPO name they list only on the 24/7 lane, on an index the venue signs. */
export const BASKET_TICKERS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].basket !== null);

/** A kind that has no exchange session and so lists only on the 24/7 token lane: a pre-IPO name or a basket of them. */
export const isTokenOnlyKind = (kind: Ticker["kind"]): boolean => kind === "preIpo" || kind === "basket";

/**
 * Tokenized shares of a launch ticker that no lane prices: a wallet holding one hedges the underlying's Regular or Gap
 * Window (S6 §4), so the holdings reader keeps them while `xstock` — which decides the 24/7 token lane — stays null.
 *
 * Mints from C:01 §3.1 (xStocks `api.xstocks.fi/api/v2/public/assets`; Ondo via Jupiter's verified `ondo` tag), each
 * checked on mainnet through Helius on 2026-09-15: Token-2022, 8 dp (xStocks) / 9 dp (Ondo), DAS symbol and name match,
 * `scaledUiAmountConfig` present, and the mint, freeze and multiplier authorities equal to the issuer's already-verified
 * TSLAx / TSLAon mints (D-011, D-058).
 */
const HEDGE_ONLY_SHARES = [
  { symbol: "AAPLx", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", issuer: "xstocks", underlying: "AAPL" },
  { symbol: "MSFTx", mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", issuer: "xstocks", underlying: "MSFT" },
  { symbol: "METAx", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", issuer: "xstocks", underlying: "META" },
  { symbol: "AMZNx", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", issuer: "xstocks", underlying: "AMZN" },
  { symbol: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", issuer: "xstocks", underlying: "GOOGL" },
  { symbol: "AAPLon", mint: "123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo", issuer: "ondo", underlying: "AAPL" },
  { symbol: "GOOGLon", mint: "bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo", issuer: "ondo", underlying: "GOOGL" },
] as const satisfies readonly { symbol: string; mint: string; issuer: "xstocks" | "ondo"; underlying: TickerSymbol }[];

export type HedgeShareSymbol = (typeof HEDGE_ONLY_SHARES)[number]["symbol"];
/** Every verified share token's symbol: the token lane's four xStocks, their Ondo twins, the hedge-only shares, and the PreStocks tokens (whose symbol is the ticker itself). */
export type ShareSymbol = XStockSymbol | OndoSymbol | HedgeShareSymbol | PreIpoSymbol;

/** Who issued a verified share token. `prestocks` tokens are read-only for the cover card, like the hedge-only shares. */
export const SHARE_ISSUERS = ["xstocks", "ondo", "prestocks"] as const;
export type ShareIssuer = (typeof SHARE_ISSUERS)[number];

/** One verified tokenized share of a registry ticker, as the holdings reader keys it (always by mint, never by symbol). */
export interface ShareToken {
  symbol: ShareSymbol;
  mint: Address;
  issuer: ShareIssuer;
  underlying: TickerSymbol;
  /** True for the four xStocks the token lane prices; the rest are read-only for the hedge. */
  traded: boolean;
}

export const SHARE_TOKENS: readonly ShareToken[] = [
  ...TICKER_SYMBOLS.flatMap((symbol) => {
    const { xstock: x, ondo: o, preIpo: p } = TICKERS[symbol];
    return [
      ...(x ? [{ symbol: x.symbol, mint: x.mint, issuer: "xstocks" as const, underlying: symbol, traded: true }] : []),
      ...(o ? [{ symbol: o.symbol, mint: o.mint, issuer: "ondo" as const, underlying: symbol, traded: false }] : []),
      ...(p ? [{ symbol: p.symbol, mint: p.mint, issuer: "prestocks" as const, underlying: symbol, traded: false }] : []),
    ];
  }),
  ...HEDGE_ONLY_SHARES.map((share) => ({ ...share, mint: toAddress(share.mint), traded: false })),
];

/**
 * The ops lane key (roller heartbeat, `/session.lanes`): `TSLA-5m` Regular, `TSLA-gap` Gap, `TSLAx-5m` token. Cadences
 * count minutes (`TSLA-60m`), not `formatCadence`'s `1h`, because the soak and web already key Regular lanes that way.
 */
/**
 * Whether a ticker may be listed on a lane at all (D-103). A pre-IPO name has no exchange session, so only the 24/7
 * token lane exists for it: the roller, the maker and the lane keys all refuse it on Regular and Gap. The drive-only
 * Series 910 (OPENAI, basis Regular) is what this guards against — rolled on the NYSE clock it would void every Window.
 */
export const laneListable = (symbol: TickerSymbol, basis: LaneBasis): boolean => !isTokenOnlyKind(TICKERS[symbol].kind) || basis === "token";

/** The asset a 24/7 Window prices (D-103): the xStock of a listed ticker, the PreStocks token of a pre-IPO name, the basket itself, else null. */
export function tokenLaneAsset(symbol: TickerSymbol): XStockSymbol | PreIpoSymbol | BasketSymbol | null {
  const t = TICKERS[symbol];
  return t.xstock?.symbol ?? t.preIpo?.symbol ?? t.basket ?? null;
}

export function laneKey(symbol: TickerSymbol, basis: LaneBasis, cadenceSec: number): string {
  // An off-lane key names no lane: `parseLaneKey` returns null for it, so no clock is ever derived from it.
  if (!laneListable(symbol, basis)) return `#${symbol}-${basis}-${cadenceSec}`;
  if (basis === "gap") return `${symbol}-gap`;
  const asset = basis === "token" ? (tokenLaneAsset(symbol) ?? symbol) : symbol;
  return `${asset}-${cadenceSec / 60}m`;
}

export interface LaneKeyParts {
  symbol: TickerSymbol;
  basis: LaneBasis;
  cadenceSec: number;
}

/** The inverse of `laneKey`: `TSLA-60m` → Regular 3,600 s, `TSLA-gap` → Gap, `TSLAx-5m` → the TSLA token lane. Null for anything else. */
export function parseLaneKey(key: string): LaneKeyParts | null {
  const dash = key.lastIndexOf("-");
  if (dash <= 0) return null;
  const asset = key.slice(0, dash);
  const tail = key.slice(dash + 1);
  if (tail === "gap") return isTickerSymbol(asset) && laneListable(asset, "gap") ? { symbol: asset, basis: "gap", cadenceSec: GAP_CADENCE_SEC } : null;
  const minutes = /^(\d+)m$/.exec(tail);
  if (!minutes) return null;
  const cadenceSec = Number(minutes[1]) * 60;
  if (cadenceSec <= 0) return null;
  // A bare pre-IPO or basket symbol is its 24/7 lane (it has no other), a bare listed ticker is its Regular lane.
  if (isTickerSymbol(asset)) return { symbol: asset, basis: isTokenOnlyKind(TICKERS[asset].kind) ? "token" : "regular", cadenceSec };
  const underlying = TICKER_SYMBOLS.map((s) => TICKERS[s]).find((t) => t.xstock?.symbol === asset);
  return underlying ? { symbol: underlying.symbol, basis: "token", cadenceSec } : null;
}

export const isTickerSymbol = (v: unknown): v is TickerSymbol => typeof v === "string" && (TICKER_SYMBOLS as readonly string[]).includes(v);

export const tickerSymbolSchema = z.enum(TICKER_SYMBOLS);

const BY_SERIES_ID = new Map(TICKER_SYMBOLS.map((symbol) => [TICKERS[symbol].seriesId, TICKERS[symbol]] as const));

export function tickerBySeriesId(seriesId: number): Ticker | null {
  return BY_SERIES_ID.get(seriesId) ?? null;
}

/**
 * The registry ticker an asset symbol identifies — itself, or the underlying of a verified share token (`TSLAx`,
 * `TSLAon`) — and which token it is, so a token lane wears the stock's mark with the issuer's badge. Null for
 * an asset the registry does not know.
 */
export function assetTicker(symbol: string): { ticker: Ticker; token: ShareToken["issuer"] | null } | null {
  if (isTickerSymbol(symbol)) return { ticker: TICKERS[symbol], token: null };
  const share = SHARE_TOKENS.find((t) => t.symbol === symbol);
  return share ? { ticker: TICKERS[share.underlying], token: share.issuer } : null;
}

/** The ticker whose xStock this is, e.g. `TSLAx` → TSLA. */
export function tickerOfXStock(symbol: XStockSymbol): Ticker {
  const found = TICKER_SYMBOLS.map((s) => TICKERS[s]).find((t) => t.xstock?.symbol === symbol);
  if (!found) throw new Error(`no ticker for xStock ${symbol}`);
  return found;
}
