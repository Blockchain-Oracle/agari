import { basketOf, isBasketSymbol, TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { basketLine, lineNumbers, markLine, type DeskMarks } from "@/features/desk/useDeskMarks";
import { basisRaw, feedRawToOracleRaw, pointsLine, usdLine } from "@/features/markets/hero/units";
import type { ShortStock } from "@/features/short/useShortWindows";
import { Skeleton } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

/** web's `nameOfAsset` (`features/short/ShortAssetCard.tsx`): the registry's name, else the symbol. */
export const nameOfAsset = (asset: string): string => (asset in TICKERS ? TICKERS[asset as TickerSymbol].name : asset);

/** web's `lineOf`: the week's line for a PreStocks name or a basket; listed stocks have no hourly marks. */
export function lineOf(stock: ShortStock, marks: DeskMarks | null): number[] {
  if (stock.kind === "basket" && isBasketSymbol(stock.asset)) return lineNumbers(basketLine(marks, stock.asset));
  if (stock.kind === "preIpo" && stock.asset in TICKERS && TICKERS[stock.asset as TickerSymbol].kind === "preIpo") {
    return lineNumbers(markLine(marks, stock.asset as never));
  }
  return [];
}

/** web's `PriceLine`: the live price in the asset's own unit — dollars, or points for a basket. */
export function PriceLine({ asset, style }: { asset: TickerSymbol; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  const price = useAssetPrice(asset);
  const raw = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  if (raw === null) return <Skeleton width={56} height={12} />;
  return (
    <Text style={[TYPE.data, { color: color.ink }, style]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
      {basketOf(asset) ? pointsLine(raw) : usdLine(raw)}
    </Text>
  );
}
