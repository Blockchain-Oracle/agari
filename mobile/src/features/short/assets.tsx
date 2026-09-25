import { basketOf, isBasketSymbol, TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { basketLine, lineNumbers, markLine, type DeskMarks } from "@/features/desk/useDeskMarks";
import { basisRaw, feedRawToOracleRaw, pointsLine, usdLine } from "@/features/markets/hero/units";
import type { ShortStock } from "@/features/short/useShortWindows";
import { FONT, useTheme } from "~/theme";

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

/**
 * web's `PriceLine` (`.sh-asset-price`): the live price in the asset's own unit — dollars, or points for a basket — in
 * mono 600; a quiet surface-2 bar the size the caller gives while nothing is known.
 */
export function PriceLine({ asset, style, pending = { width: 64, height: 12 } }: { asset: TickerSymbol; style?: StyleProp<TextStyle>; pending?: { width: number; height: number } }) {
  const { color } = useTheme();
  const price = useAssetPrice(asset);
  const raw = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  if (raw === null) return <View style={{ width: pending.width, height: pending.height, borderRadius: 4, backgroundColor: color.surface2 }} />;
  return (
    <Text style={[styles.price, { color: color.ink }, style]} numberOfLines={1}>
      {basketOf(asset) ? pointsLine(raw) : usdLine(raw)}
    </Text>
  );
}

const styles = StyleSheet.create({
  price: { fontFamily: FONT.dataStrong, fontSize: 12.5, lineHeight: 20, fontVariant: ["tabular-nums"] },
});
