/**
 * The one line that names where a price comes from, beside the price (S25): "Settles on Pyth · TSLA/USD", "Settles on
 * RedStone · NVDA/USD", "Prices from PreStocks · mint Prew…rpgF", "Index of 2 PreStocks prices". Pure, so the hero, the
 * hubs and the tests say the same thing.
 *
 * The source is read, never assumed. A Window carries its Series policy's primary source (`EventMarket.printSource`, the
 * opening print's source once recorded), so when a policy version changes source the next Window's line follows it with
 * no edit here. A pre-IPO name and a basket are PreStocks by construction (D-100, D-124), so their line is the registry's.
 * A source that the ticker cannot have (Pyth on a name with no Pyth feed, Switchboard off the token lane), or no source at
 * all (a Series whose policy was not read), yields no line rather than a wrong one.
 */
import { SOLANA_EXPLORER_URL } from "@agari/core/constants";
import { basketOf, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneSet, PrintSource } from "@agari/core/types";

export type SourceProvider = "pyth" | "redstone" | "switchboard" | "prestocks";

export interface SourceLabel {
  provider: SourceProvider;
  /** "Settles on Pyth · TSLA/USD" */
  text: string;
  /** The feed's own page (Pyth Terminal) or the mint on Solana Explorer; null where no public page is pinned. */
  href: string | null;
}

/** Pyth Terminal's feed page; `/` is `%2F` (`Equity.US.TSLA%2FUSD`), the form Pyth's own links use. */
export const pythFeedUrl = (pythSymbol: string): string => `https://app.pyth.com/explore/${encodeURIComponent(pythSymbol)}`;

/** A mainnet mint on Solana Explorer: PreStocks tokens live on mainnet whatever cluster the venue runs on. */
export const mainnetAddressUrl = (address: string): string => `${SOLANA_EXPLORER_URL}/address/${address}`;

const shortMint = (mint: string): string => `${mint.slice(0, 4)}…${mint.slice(-4)}`;

export const SOURCE_COPY = {
  settles: (provider: string, feed: string) => `Settles on ${provider} · ${feed}`,
  preIpo: (mint: string) => `Prices from PreStocks · mint ${mint}`,
  basket: (count: number) => `Index of ${count} PreStocks prices`,
} as const;

/** The registry's own line for an asset whose source is fixed by what it is: a pre-IPO name, a basket or a valuation lane. */
function kindLabel(asset: TickerSymbol): SourceLabel | null {
  const ticker = TICKERS[asset];
  const basket = basketOf(asset);
  if (basket) return { provider: "prestocks", text: SOURCE_COPY.basket(basket.members.length), href: null };
  if (ticker.kind === "preIpo" && ticker.preIpo) {
    const mint = ticker.preIpo.mint;
    return { provider: "prestocks", text: SOURCE_COPY.preIpo(shortMint(mint)), href: mainnetAddressUrl(mint) };
  }
  if (ticker.kind === "valuation" && ticker.valuationOf && ticker.pythIndexFeedId) {
    const feed = `Equity.Index.${ticker.valuationOf}/USD`;
    return { provider: "pyth", text: SOURCE_COPY.settles("Pyth", `${ticker.valuationOf}/USD index`), href: pythFeedUrl(feed) };
  }
  return null;
}

/** An exchange-listed name's line for one signed source, or null when the ticker has no feed on it. */
function listedLabel(asset: TickerSymbol, source: PrintSource | null, lane: EventMarket["lane"]): SourceLabel | null {
  if (source === null) return null;
  const ticker = TICKERS[asset];
  const pair = `${asset}/USD`;
  // The token lane prices the xStock; the Regular and Gap lanes price the stock's own print.
  if (lane === "token") {
    return source === "switchboard" && ticker.xstock ? { provider: "switchboard", text: SOURCE_COPY.settles("Switchboard", ticker.xstock.symbol), href: null } : null;
  }
  if (source === "pyth" && ticker.pythFeedId) return { provider: "pyth", text: SOURCE_COPY.settles("Pyth", pair), href: pythFeedUrl(`Equity.US.${pair}`) };
  if (source === "redstone" && ticker.redstoneFeedId) return { provider: "redstone", text: SOURCE_COPY.settles("RedStone", pair), href: null };
  return null;
}

/** The line for one Window, from its policy's primary source. */
export function windowSourceLabel(market: Pick<EventMarket, "asset" | "lane" | "printSource">): SourceLabel | null {
  return kindLabel(market.asset) ?? listedLabel(market.asset, market.printSource, market.lane);
}

/**
 * The line for an asset with no Window in view (the closed hero, a ticker hub): the registry's for a pre-IPO name or a
 * basket, else the newest listed stock-price Window's (Regular or Gap) for this asset. Null when no such Window is
 * listed: an asset between lanes names no source rather than guess one.
 */
export function assetSourceLabel(asset: TickerSymbol, laneSet: Pick<LaneSet, "lanes"> | null): SourceLabel | null {
  const fixed = kindLabel(asset);
  if (fixed) return fixed;
  let newest: EventMarket | null = null;
  for (const lane of laneSet?.lanes ?? []) {
    if (lane.basis === "token") continue;
    for (const market of lane.markets) {
      if (market.asset === asset && (newest === null || market.tradingStartSec > newest.tradingStartSec)) newest = market;
    }
  }
  return newest ? windowSourceLabel(newest) : null;
}

/** A pre-IPO name or a basket: priced from the PreStocks catalogue and attested by the venue (D-100, D-124). */
export function isPreStocksAsset(asset: string | null): boolean {
  if (asset === null || !(asset in TICKERS)) return false;
  const kind = TICKERS[asset as TickerSymbol].kind;
  return kind === "preIpo" || kind === "basket";
}

const PRINT_SOURCE_NAME: Record<Exclude<PrintSource, "attested">, string> = { pyth: "Pyth", redstone: "RedStone", switchboard: "Switchboard" };

/**
 * The name a recorded print's source goes by on every surface (the proof page, the verdict, the share card): an attested
 * print on a PreStocks asset is PreStocks' price under Agari's signature; only an attested print on anything else is the
 * opt-in demo-data path (D-056).
 */
export function printSourceName(source: PrintSource, asset: string | null): string {
  if (source !== "attested") return PRINT_SOURCE_NAME[source];
  return isPreStocksAsset(asset) ? "PreStocks" : "Attested demo";
}
