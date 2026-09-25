import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import { BOARD_PERIODS } from "@/features/leaderboard/protocol";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";

/** The Regular lane's tickers, registry order — web's BOARD_TICKERS. */
const BOARD_TICKERS = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);

/** part-08's `.asset-tab`: mono caps, a vermilion underline when active; a ticker carries its 16 px mark. */
function AssetTab({ label, ticker, on, onPress }: { label: string; ticker?: TickerSymbol; on: boolean; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.tab, { borderBottomColor: on ? color.accent : "transparent" }]}
    >
      {ticker ? (
        <View style={styles.glyph}>
          <AssetDisc asset={ticker} size={14} />
        </View>
      ) : null}
      <Text style={[styles.tabText, { color: on ? color.ink : color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * web's `BoardFilters` (features/leaderboard/BoardFilters.tsx, board-filters.css ≤640 px): the period tabs, the
 * `/markets` ticker picker scrolling sideways inside the bar, then the closed-calls meta — stacked, 12 apart.
 */
export function BoardFilters({ board, onBoard, meta }: { board: BoardQuery; onBoard: (board: BoardQuery) => void; meta: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = LEADERBOARD.hero;
  return (
    <View style={[styles.bar, { borderBottomColor: t.filterRule }]}>
      <View style={styles.tabs} accessibilityRole="radiogroup" accessibilityLabel={words.periodGroup}>
        {BOARD_PERIODS.map((period) => (
          <AssetTab key={period} label={words.periods[period]} on={board.period === period} onPress={() => onBoard({ ...board, period })} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <AssetTab label="All" on={board.ticker === null} onPress={() => onBoard({ ...board, ticker: null })} />
        {BOARD_TICKERS.map((ticker) => (
          <AssetTab key={ticker} label={ticker} ticker={ticker} on={board.ticker === ticker} onPress={() => onBoard({ ...board, ticker })} />
        ))}
      </ScrollView>
      <Text style={[styles.meta, { color: color.inkDisabled }]}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 28, paddingVertical: 16, gap: 12, borderBottomWidth: 1, alignItems: "flex-start" },
  tabs: { flexDirection: "row", alignItems: "center", gap: 18 },
  tab: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1 },
  glyph: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
});
