import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardData } from "@/features/leaderboard/protocol";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

function MetaTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.tile, { borderColor: color.hairline }]} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
      <Text style={[styles.tileLabel, { color: color.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={[styles.unit, { color: color.inkMuted }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * web's leaderboard hero (LeaderboardBoard.tsx `Hero`): the eyebrow, "The / house / of names." with the vermilion middle
 * word, then the meta column — traders ranked, total staked by the top fifty, the next close — and the board's stamp.
 */
export function BoardHero({ data, board, span, nextExpirySec, nowMs }: {
  data: BoardData | null;
  board: BoardQuery;
  span: BoardSpan;
  nextExpirySec: number | null;
  nowMs: number;
}) {
  const { color } = useTheme();
  const words = LEADERBOARD.hero;
  const dash = LEADERBOARD.dash;
  const meta = data?.meta ?? null;
  const traders = meta && meta.rankedTraders > 0 ? meta.rankedTraders.toLocaleString() : dash;
  const staked = meta && meta.totalVolumeBase > 0n ? formatBaseUnits(meta.totalVolumeBase, meta.decimals, { maxDp: 0, minDp: 0 }) : dash;
  const seal = nextExpirySec !== null && nowMs > 0 ? formatClock(remainingSec(nowMs, nextExpirySec)) : dash;
  return (
    <View style={styles.hero}>
      <View style={styles.eyebrow}>
        <View style={[styles.dash, { backgroundColor: color.accent }]} />
        <Text style={[styles.eyebrowText, { color: color.accent }]}>{words.eyebrow.toUpperCase()}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
          {words.title[0]}
          {"\n"}
          <Text style={{ color: color.accent }}>{words.title[1]}</Text>
          {"\n"}
          {words.title[2]}
        </Text>
        <View style={[styles.stamp, { borderColor: color.accent }]} accessible accessibilityLabel={`${words.stamp(board.period)}, ${words.stampSub(span)}`}>
          <Text style={[styles.stampText, { color: color.accent }]}>{words.stamp(board.period)}</Text>
          <Text style={[styles.stampSub, { color: color.accent }]}>{words.stampSub(span)}</Text>
        </View>
      </View>
      <View style={styles.tiles}>
        <MetaTile label={words.traders(board.period)} value={traders} />
        <MetaTile label={words.staked} value={staked} unit={staked === dash ? undefined : meta?.symbol} />
        <MetaTile label={words.nextClose} value={seal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dash: { width: 18, height: 1.5 },
  eyebrowText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  stamp: {
    borderWidth: 1.5,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    transform: [{ rotate: "-6deg" }],
    marginBottom: 8,
  },
  stampText: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1.2 },
  stampSub: { fontFamily: FONT.data, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6 },
  tileLabel: { fontFamily: FONT.body, fontSize: 11, lineHeight: 14 },
  tileValue: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 22 },
  unit: { fontFamily: FONT.data, fontSize: 10 },
});
