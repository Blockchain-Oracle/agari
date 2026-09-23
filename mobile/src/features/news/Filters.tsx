import { isTokenOnlyKind, TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Sentiment } from "@/features/news/protocol";
import { haptic, Segmented } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, SPACE, useTheme } from "~/theme";

/** The tickers the wire can narrow to — web's /api/news reads company news for exactly these (route.ts `LISTED`). */
export const NEWS_SYMBOLS: readonly TickerSymbol[] = TICKER_SYMBOLS.filter((symbol) => !isTokenOnlyKind(TICKERS[symbol].kind));

export type ToneFilter = "all" | Sentiment;

const TONES: readonly { value: ToneFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "positive", label: "Bullish" },
  { value: "negative", label: "Bearish" },
  { value: "neutral", label: "Neutral" },
];

/**
 * web's `/news?symbol=` as a touch control: a strip of the listed tickers (each with its mark) that narrows the wire to
 * one company's news, and a tone filter over the headlines already read.
 */
export function NewsFilters({ symbol, onSymbol, tone, onTone }: {
  symbol: TickerSymbol | null;
  onSymbol: (symbol: TickerSymbol | null) => void;
  tone: ToneFilter;
  onTone: (tone: ToneFilter) => void;
}) {
  const { color } = useTheme();
  const chip = (value: TickerSymbol | null) => {
    const on = value === symbol;
    return (
      <Pressable
        key={value ?? "all"}
        onPress={() => {
          if (on) return;
          haptic.select();
          onSymbol(value);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={value ? `${TICKERS[value].name} news` : "All market news"}
        style={[
          styles.chip,
          { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline },
        ]}
      >
        {value ? <AssetDisc asset={value} size={20} /> : null}
        <Text style={[styles.chipText, { color: on ? color.accent : color.ink }]}>{value ?? "All"}</Text>
      </Pressable>
    );
  };
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.bleed}
        accessibilityRole="tablist"
        accessibilityLabel="Narrow the wire to one ticker"
      >
        {chip(null)}
        {NEWS_SYMBOLS.map(chip)}
      </ScrollView>
      <Segmented options={TONES} value={tone} onChange={onTone} label="Filter by tone" />
    </>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -SPACE.gutter },
  strip: { gap: 8, paddingHorizontal: SPACE.gutter },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: { fontFamily: FONT.dataStrong, fontSize: 13 },
});
