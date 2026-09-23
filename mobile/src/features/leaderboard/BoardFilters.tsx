import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import { BOARD_PERIODS } from "@/features/leaderboard/protocol";
import { haptic, Segmented } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

export type BoardScope = "all" | "friends";

/** The Regular lane's tickers, registry order — web's BOARD_TICKERS. */
const BOARD_TICKERS = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);

function TickerChip({ ticker, on, onPress }: { ticker: TickerSymbol | null; on: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const label = ticker ?? "All";
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={ticker ? `${ticker} board` : "All tickers"}
      style={[styles.chip, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
    >
      {ticker ? <AssetDisc asset={ticker} size={20} /> : null}
      <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * web's `BoardFilters` (features/leaderboard/BoardFilters.tsx): whose calls (everyone or the people you follow), the
 * board period, the ticker picker `/markets` uses, and the meta line — closed calls and how much the scan covers.
 */
export function BoardFilters({ board, onBoard, scope, onScope, meta }: {
  board: BoardQuery;
  onBoard: (board: BoardQuery) => void;
  scope: BoardScope;
  onScope: (scope: BoardScope) => void;
  meta: string;
}) {
  const { color } = useTheme();
  const words = LEADERBOARD.hero;
  return (
    <View style={styles.wrap}>
      <Segmented
        label={words.scopeGroup}
        value={scope}
        onChange={onScope}
        options={(["all", "friends"] as const).map((value) => ({ value, label: words.scopes[value] }))}
      />
      {scope === "all" ? (
        <>
          <Segmented
            label={words.periodGroup}
            value={board.period}
            onChange={(period) => onBoard({ ...board, period })}
            options={BOARD_PERIODS.map((value) => ({ value, label: words.periods[value] }))}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
            <TickerChip ticker={null} on={board.ticker === null} onPress={() => onBoard({ ...board, ticker: null })} />
            {BOARD_TICKERS.map((ticker) => (
              <TickerChip key={ticker} ticker={ticker} on={board.ticker === ticker} onPress={() => onBoard({ ...board, ticker })} />
            ))}
          </ScrollView>
          <Text style={[styles.meta, { color: color.inkMuted }]}>{meta}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  meta: { fontFamily: FONT.data, fontSize: 11.5, letterSpacing: 0.4 },
});
