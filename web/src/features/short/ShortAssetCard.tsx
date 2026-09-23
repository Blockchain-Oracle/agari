"use client";

import { basketOf, isBasketSymbol, TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import { Sparkline } from "@/components/ui/desk-kit";
import { basketLine, lineNumbers, markLine, type DeskMarks } from "@/features/desk/useDeskMarks";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { basisRaw, feedRawToOracleRaw, pointsLine, usdLine } from "@/features/markets/hero/units";
import { SHORT } from "./copy";
import { opensAt, type ShortStock } from "./useShortWindows";

/** The asset's name as people say it: the registry's, else the symbol (an unlisted token keeps its ticker). */
export const nameOfAsset = (asset: string): string => (asset in TICKERS ? TICKERS[asset as TickerSymbol].name : asset);

/** The seven-day line for a PreStocks name or a basket; listed stocks have no hourly marks, so they draw none. */
function lineOf(stock: ShortStock, marks: DeskMarks | null): number[] {
  if (stock.kind === "basket" && isBasketSymbol(stock.asset)) return lineNumbers(basketLine(marks, stock.asset));
  if (stock.kind === "preIpo" && stock.asset in TICKERS && TICKERS[stock.asset as TickerSymbol].kind === "preIpo") return lineNumbers(markLine(marks, stock.asset as never));
  return [];
}

/** The live price in the asset's own unit: dollars for a stock or a PreStocks name, points for a basket. */
function PriceLine({ asset }: { asset: TickerSymbol }) {
  const price = useAssetPrice(asset);
  const raw = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  if (raw === null) return <span className="sh-asset-price sh-asset-price--pending" aria-hidden />;
  return <span className="sh-asset-price numbers">{basketOf(asset) ? pointsLine(raw) : usdLine(raw)}</span>;
}

/** One asset in the picker, as a 21st icon-card radio (#28351): its mark, name, kind, live price and week, and whether it trades now. */
export function assetCardParts(stock: ShortStock, marks: DeskMarks | null) {
  const { picker } = SHORT;
  const live = stock.liveCount > 0;
  const next = stock.windows[0];
  return {
    media: <AssetDisc asset={stock.asset} className="sh-asset-mark" />,
    title: nameOfAsset(stock.asset),
    body: (
      <>
        <span className="sh-asset-sub">
          <span className="sh-asset-tag">${stock.asset}</span>
          <span className="sh-asset-kind" data-kind={stock.kind}>{picker.kind[stock.kind]}</span>
        </span>
        <span className="sh-asset-when" data-live={live ? "" : undefined}>
          <span className="sh-asset-when-dot" aria-hidden />
          {live ? picker.liveNow : next ? picker.opens(opensAt(next.tradingStartSec)) : picker.closed}
        </span>
      </>
    ),
    footer: (
      <>
        <PriceLine asset={stock.asset} />
        <Sparkline values={lineOf(stock, marks)} width={72} height={22} className="sh-asset-spark" />
      </>
    ),
  };
}
