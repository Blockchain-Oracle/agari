import { shortHex } from "@agari/core/units";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardRanking } from "@/features/leaderboard/protocol";
import { haptic } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { openProfile, signedPnl, type FieldRow } from "./board";
import { Portrait } from "./Portrait";

/** One ranked trader: rank, portrait, name, the reference's cell meta, the signed profit. Opens their profile. */
export function RankRow({ rank, trader, decimals, you, meta }: { rank: number | string; trader: BoardRanking; decimals: number; you: boolean; meta: string }) {
  const { color } = useTheme();
  const pnl = signedPnl(trader.pnlBase, decimals);
  const name = you ? `${LEADERBOARD.you.name(shortHex(trader.owner))}` : shortHex(trader.owner);
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        openProfile(trader.owner);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${name}, ${pnl}. ${meta}. Open profile`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: color.hairline },
        you && { backgroundColor: color.accentWash },
        pressed && { backgroundColor: color.surface1 },
      ]}
    >
      <Text style={[styles.rank, { color: you ? color.accent : color.inkMuted }]}>{typeof rank === "number" ? String(rank).padStart(2, "0") : rank}</Text>
      <Portrait address={trader.owner} size={34} />
      <View style={styles.text}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: color.inkMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[TYPE.data, { color: trader.pnlBase < 0n ? color.loss : color.profit }]}>{pnl}</Text>
    </Pressable>
  );
}

function Divider({ label }: { label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.rule, { backgroundColor: color.hairline }]} />
      <Text style={[styles.dividerText, { color: color.inkMuted }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: color.hairline }]} />
    </View>
  );
}

/**
 * web's `Banzuke` (features/leaderboard/Banzuke.tsx): ranks four to fifty under the reference's strip, split into the
 * same tiers ("RANK & FILE", "THE LONG TAIL"). Web lays two traders a row east and west; a phone reads one a row.
 */
export function FieldList({ rows, decimals, span, address }: { rows: readonly FieldRow[]; decimals: number; span: BoardSpan; address: string | null }) {
  const { color } = useTheme();
  const words = LEADERBOARD.field;
  return (
    <View>
      <View style={[styles.strip, { borderColor: color.hairline }]}>
        <Text style={[styles.stripText, { color: color.inkMuted }]}>{words.strip.ranks}</Text>
        <Text style={[styles.stripText, styles.stripCenter, { color: color.inkSecondary }]} numberOfLines={1}>
          {words.strip.center(span)}
        </Text>
      </View>
      {rows.map((row, i) => {
        const previous = i > 0 ? (rows[i - 1] as FieldRow).tier : row.tier;
        const changed = i > 0 && row.tier !== previous;
        return (
          <Fragment key={row.trader.owner}>
            {changed && row.tier === 4 ? <Divider label={words.dividers.rankAndFile} /> : null}
            {changed && row.tier === 5 ? <Divider label={words.dividers.longTail} /> : null}
            <RankRow
              rank={row.rank}
              trader={row.trader}
              decimals={decimals}
              you={row.trader.owner === address}
              meta={words.cellMeta(row.rank, row.trader.tradeCount, row.trader.winRatePct)}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { fontFamily: FONT.dataStrong, fontSize: 13, width: 24 },
  text: { flex: 1, gap: 2 },
  meta: { fontFamily: FONT.data, fontSize: 11.5 },
  strip: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  stripText: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.2 },
  stripCenter: { flexShrink: 1, textAlign: "right" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6 },
});
