import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import { BOARD_PERIODS } from "@/features/leaderboard/protocol";
import { CONTAINER_GUTTER } from "~/features/explore/ExplorePage";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { BOARD_PHONE } from "./words";

/** The Regular lane's tickers, registry order — web's BOARD_TICKERS. */
const BOARD_TICKERS = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);

function Chip({ label, ticker, on, onPress }: { label: string; ticker?: TickerSymbol; on: boolean; onPress: () => void }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? color.accent : t.chipBorder, backgroundColor: on ? color.accentWash : "transparent" }]}
    >
      {ticker ? <AssetDisc asset={ticker} size={16} /> : null}
      <Text style={[styles.chipText, { color: on ? color.ink : color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The phone board's pinned controls: the period as part-08's `.pill-tabs` segment (Session / 24h), the tickers as a
 * sideways chip row, and web's closed-calls meta — sticky under the header while the list scrolls.
 */
export function BoardControls({ board, onBoard, meta }: { board: BoardQuery; onBoard: (board: BoardQuery) => void; meta: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  return (
    <View style={[styles.bar, { backgroundColor: color.ground, borderBottomColor: t.stickyRule }]}>
      <View style={styles.top}>
        <View style={[styles.seg, { backgroundColor: t.segFill, borderColor: t.segBorder }]} accessibilityRole="radiogroup" accessibilityLabel={LEADERBOARD.hero.periodGroup}>
          {BOARD_PERIODS.map((period) => {
            const on = board.period === period;
            return (
              <Pressable
                key={period}
                onPress={() => {
                  haptic.select();
                  onBoard({ ...board, period });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.segTab, on && { backgroundColor: t.segActiveFill }]}
              >
                <Text style={[styles.segText, { color: on ? t.segActiveInk : color.inkMuted }]}>{BOARD_PHONE.periods[period]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.meta, { color: color.inkDisabled }]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
        <Chip label={BOARD_PHONE.allTickers} on={board.ticker === null} onPress={() => onBoard({ ...board, ticker: null })} />
        {BOARD_TICKERS.map((ticker) => (
          <Chip key={ticker} label={ticker} ticker={ticker} on={board.ticker === ticker} onPress={() => onBoard({ ...board, ticker })} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { marginHorizontal: -CONTAINER_GUTTER, paddingHorizontal: CONTAINER_GUTTER, paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderRadius: 999 },
  segTab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999 },
  segText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 14, letterSpacing: 0.44 },
  meta: { flex: 1, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 9.5, lineHeight: 14, letterSpacing: 0.95, textTransform: "uppercase" },
  chipScroll: { marginHorizontal: -CONTAINER_GUTTER },
  chips: { gap: 8, paddingHorizontal: CONTAINER_GUTTER },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderWidth: 1, borderRadius: 999 },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase" },
});
