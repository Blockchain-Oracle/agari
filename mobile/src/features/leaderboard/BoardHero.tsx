import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardData } from "@/features/leaderboard/protocol";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { BOARD_PHONE } from "./words";

interface Props {
  data: BoardData | null;
  board: BoardQuery;
  span: BoardSpan;
  nextExpirySec: number | null;
  nowMs: number;
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  return (
    <View style={[styles.tile, { borderColor: t.spotBorder, backgroundColor: t.spotFill }]} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
      <Text style={[styles.tileLabel, { color: color.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
        {unit ? <Text style={[styles.unit, { color: color.inkMuted }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * The phone board's header (web's `.lb-hero` language at a phone size): the mono eyebrow with the tilted date stamp
 * at its right, "The house of names." on one line at 32 pt with the vermilion middle word, then traders, total staked
 * and the next close as one row of compact tiles.
 */
export function BoardHero({ data, board, span, nextExpirySec, nowMs }: Props) {
  const { color } = useTheme();
  const words = LEADERBOARD.hero;
  const dash = LEADERBOARD.dash;
  const meta = data?.meta ?? null;
  const traders = meta && meta.rankedTraders > 0 ? meta.rankedTraders.toLocaleString() : dash;
  const staked = meta && meta.totalVolumeBase > 0n ? formatBaseUnits(meta.totalVolumeBase, meta.decimals, { maxDp: 0, minDp: 0 }) : dash;
  const seal = nextExpirySec !== null && nowMs > 0 ? formatClock(remainingSec(nowMs, nextExpirySec)) : dash;
  return (
    <View style={styles.hero}>
      <View style={styles.eyebrowRow}>
        <Text style={[styles.eyebrow, { color: color.inkMuted }]} numberOfLines={1}>
          {BOARD_PHONE.eyebrow}
        </Text>
        <View style={[styles.stamp, { borderColor: color.accent }]} accessible accessibilityLabel={`${words.stamp(board.period)}, ${words.stampSub(span)}`}>
          <Text style={[styles.stampText, { color: color.accent }]}>{words.stampSub(span)}</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        {words.title[0]} <Text style={{ color: color.accent }}>{words.title[1]}</Text> {words.title[2]}
      </Text>
      <View style={styles.tiles}>
        <Tile label={BOARD_PHONE.stats.traders} value={traders} />
        <Tile label={BOARD_PHONE.stats.staked} value={staked} unit={staked === dash ? undefined : meta?.symbol} />
        <Tile label={BOARD_PHONE.stats.close} value={seal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 20, paddingBottom: 14, gap: 10 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  // web's `.stamp`: a 1 px vermilion frame, 3° off square, mono 9 at 0.22em.
  stamp: { borderWidth: 1, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 7, transform: [{ rotate: "-3deg" }] },
  stampText: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 11.2, letterSpacing: 1.6 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 32, lineHeight: 36, letterSpacing: -1.28 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 4 },
  tile: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 10, gap: 4 },
  tileLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 12.6, letterSpacing: 0.9, textTransform: "uppercase" },
  tileValue: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 24, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 0 },
});
