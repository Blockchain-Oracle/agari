import { formatBaseUnits, shortHex } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { openProfile, record, type FieldRow } from "./board";
import { Portrait } from "./Portrait";
import { BOARD_PHONE } from "./words";

function Row({ row, decimals, mine }: { row: FieldRow; decimals: number; mine: boolean }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const { trader, rank } = row;
  const up = trader.pnlBase >= 0n;
  const { wins, losses } = record(trader);
  const pnl = `${up ? "+" : ""}${formatBaseUnits(trader.pnlBase, decimals)}`;
  return (
    <Pressable
      onPress={() => openProfile(trader.owner)}
      accessibilityRole="link"
      accessibilityLabel={`Rank ${rank}, ${shortHex(trader.owner)}, ${pnl}, ${BOARD_PHONE.record(wins, losses, trader.winRatePct)}. Open their record`}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.rowBorder }, mine && { backgroundColor: color.accentWash }, pressed && { backgroundColor: t.rowPressed }]}
    >
      <Text style={[styles.rank, { color: mine ? color.accent : color.inkMuted }]}>{String(rank).padStart(2, "0")}</Text>
      <Portrait
        id={`rank-${trader.owner}`}
        address={trader.owner}
        size={34}
        stops={t.bzPortrait}
        border={t.bzPortraitBorder}
        borderWidth={1}
        ink={t.bzPortraitInk}
        fontFamily={FONT.heading}
        fontSize={13}
      />
      <View style={styles.who}>
        <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
          {shortHex(trader.owner)}
        </Text>
        <Text style={[styles.rec, { color: color.inkMuted }]} numberOfLines={1}>
          {BOARD_PHONE.record(wins, losses, trader.winRatePct)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.pnl, { color: up ? color.profit : color.loss }]} numberOfLines={1}>
          {pnl}
        </Text>
        <View style={[styles.track, { backgroundColor: t.barTrack }]} accessible={false}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, trader.winRatePct))}%`, backgroundColor: color.accent }]} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The phone field: ranks four to fifty as dense 62 pt rows — rank, portrait, name over the win–loss record, profit in
 * green or red over a win-rate bar. Your own row takes the vermilion wash; a row opens that trader's record.
 */
export function RankList({ rows, decimals, address }: { rows: readonly FieldRow[]; decimals: number; address: string | null }) {
  return (
    <View>
      {rows.map((row) => (
        <Row key={row.trader.owner} row={row} decimals={decimals} mine={row.trader.owner === address} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, height: 62, paddingHorizontal: 4, borderBottomWidth: 1 },
  rank: { width: 22, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  who: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  rec: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
  right: { alignItems: "flex-end", gap: 6 },
  pnl: { fontFamily: FONT.data, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  track: { width: 48, height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
});
