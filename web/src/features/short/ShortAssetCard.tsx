"use client";

import { basketOf, isBasketSymbol, TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import { basketLine, lineNumbers, markLine, type DeskMarks } from "@/features/desk/useDeskMarks";
import { basisRaw, feedRawToOracleRaw, pointsLine, usdLine } from "@/features/markets/hero/units";
import type { ShortStock } from "./useShortWindows";

/** The asset's name as people say it: the registry's, else the symbol (an unlisted token keeps its ticker). */
export const nameOfAsset = (asset: string): string => (asset in TICKERS ? TICKERS[asset as TickerSymbol].name : asset);

/** The seven-day line for a PreStocks name or a basket; listed stocks have no hourly marks, so they draw none. */
export function lineOf(stock: ShortStock, marks: DeskMarks | null): number[] {
  if (stock.kind === "basket" && isBasketSymbol(stock.asset)) return lineNumbers(basketLine(marks, stock.asset));
  if (stock.kind === "preIpo" && stock.asset in TICKERS && TICKERS[stock.asset as TickerSymbol].kind === "preIpo") return lineNumbers(markLine(marks, stock.asset as never));
  return [];
}

/** The live price in the asset's own unit: dollars for a stock or a PreStocks name, points for a basket. */
export function PriceLine({ asset }: { asset: TickerSymbol }) {
  const price = useAssetPrice(asset);
  const raw = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  if (raw === null) return <span className="sh-asset-price sh-asset-price--pending" aria-hidden />;
  return <span className="sh-asset-price numbers">{basketOf(asset) ? pointsLine(raw) : usdLine(raw)}</span>;
}
