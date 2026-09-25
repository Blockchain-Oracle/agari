import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardData } from "@/features/leaderboard/protocol";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { BoardFilters } from "./BoardFilters";

interface Props {
  data: BoardData | null;
  board: BoardQuery;
  onBoard: (board: BoardQuery) => void;
  span: BoardSpan;
  nextExpirySec: number | null;
  nowMs: number;
}

function Meta({ label, children }: { label: string; children: string }) {
  const { color } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${children}`}>
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.big, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

/**
 * web's leaderboard `Hero` (LeaderboardBoard.tsx, part-08 `.lb-hero`, part-15's phone rules): the eyebrow, "The /
 * house / of names." at 51 px, the left-aligned meta column — traders, total staked, the next close — and the tilted
 * board stamp, over the hero rule; then the filter bar.
 */
export function BoardHero({ data, board, onBoard, span, nextExpirySec, nowMs }: Props) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = LEADERBOARD.hero;
  const dash = LEADERBOARD.dash;
  const meta = data?.meta ?? null;
  const traders = meta && meta.rankedTraders > 0 ? meta.rankedTraders.toLocaleString() : dash;
  const staked = meta && meta.totalVolumeBase > 0n ? `${formatBaseUnits(meta.totalVolumeBase, meta.decimals, { maxDp: 0, minDp: 0 })} ${meta.symbol}` : dash;
  const seal = nextExpirySec !== null && nowMs > 0 ? formatClock(remainingSec(nowMs, nextExpirySec)) : dash;
  const filterMeta = meta ? words.closedCalls(meta.closedCalls, span, meta.complete, meta.ticker ?? null) : words.counting;
  return (
    <View style={styles.hero}>
      <View style={[styles.grid, { borderBottomColor: t.heroRule }]}>
        <View>
          <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{words.eyebrow}</Text>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {words.title[0]}
            {"\n"}
            <Text style={{ color: color.accent }}>{words.title[1]}</Text>
            {"\n"}
            {words.title[2]}
          </Text>
        </View>
        <View style={styles.metaCol}>
          <Meta label={words.traders(board.period)}>{traders}</Meta>
          <Meta label={words.staked}>{staked}</Meta>
          <Meta label={words.nextClose}>{seal}</Meta>
          <View style={[styles.stamp, { borderColor: color.accent }]} accessible accessibilityLabel={`${words.stamp(board.period)}, ${words.stampSub(span)}`}>
            <Text style={[styles.stampText, { color: color.accent }]}>{words.stamp(board.period)}</Text>
            <Text style={[styles.stampSub, { color: color.accent }]}>{words.stampSub(span)}</Text>
          </View>
        </View>
      </View>
      <BoardFilters board={board} onBoard={onBoard} meta={filterMeta} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 56 },
  grid: { gap: 24, paddingBottom: 36, borderBottomWidth: 1 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 24 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 51, lineHeight: 45.9, letterSpacing: -2.55, paddingTop: 6 },
  metaCol: { gap: 16 },
  label: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  big: { fontFamily: FONT.heading, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, paddingTop: 2 },
  stamp: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 14, transform: [{ rotate: "-3deg" }] },
  stampText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 12.6, letterSpacing: 1.98, textAlign: "center" },
  stampSub: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 11.2, letterSpacing: 1.76, textAlign: "center", marginTop: 4 },
});
