import { formatBaseUnits, shortHex } from "@agari/core/units";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardRanking } from "@/features/leaderboard/protocol";
import { FONT, useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import type { BanzukeRow } from "./board";
import { Portrait } from "./Portrait";

/** web's Noto Serif JP 300 on `.bz-portrait`; the lightest face the app loads. */
const JP_LIGHT = "NotoSerifJP_500Medium";

/** part-09 per tier (ranks 4–7, 8–12, the tail): row floor, centre numeral, portrait. */
const TIER = {
  3: { minHeight: 60, center: 20, portrait: 36, glyph: 14 },
  4: { minHeight: 48, center: 16, portrait: 28, glyph: 12 },
  5: { minHeight: 36, center: 13, portrait: 22, glyph: 10 },
} as const;

function Cell({ trader, tier, side, decimals }: { trader: BoardRanking | null; tier: 3 | 4 | 5; side: "east" | "west"; decimals: number }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const gray300 = exploreTokens(name).gray300;
  if (!trader) return <View style={styles.cell} />;
  const size = TIER[tier];
  const tail = tier === 5;
  const pnl = (
    <Text style={[styles.pnl, { color: tail ? gray300 : color.accent, fontSize: tail ? 12 : 14 }]}>
      {trader.pnlBase >= 0n ? "+" : ""}
      {formatBaseUnits(trader.pnlBase, decimals)}
    </Text>
  );
  const who = (
    <Text style={[styles.name, { color: tail ? gray300 : color.ink }]} numberOfLines={1}>
      {shortHex(trader.owner)}
    </Text>
  );
  const portrait = (
    <Portrait
      id={`bz-${trader.owner}`}
      address={trader.owner}
      size={size.portrait}
      stops={t.bzPortrait}
      border={t.bzPortraitBorder}
      borderWidth={1}
      ink={t.bzPortraitInk}
      fontFamily={JP_LIGHT}
      fontSize={size.glyph}
    />
  );
  return (
    <View style={[styles.cell, side === "east" ? styles.east : styles.west]}>
      {side === "east" ? (
        <>
          {pnl}
          <View style={styles.text}>{who}</View>
          {portrait}
        </>
      ) : (
        <>
          {portrait}
          <View style={styles.text}>{who}</View>
          {pnl}
        </>
      )}
    </View>
  );
}

/**
 * web's `Banzuke` (features/leaderboard/Banzuke.tsx, part-08/09 `.banzuke-*`, part-15 ≤720 px): ranks four to fifty
 * two to a row, east and west about the 50 px rank column, in the tiers the dividers name; handles, meta and trends are
 * hidden on a phone as web hides them.
 */
export function Banzuke({ rows, decimals, span }: { rows: readonly BanzukeRow[]; decimals: number; span: BoardSpan }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const x = exploreTokens(name);
  const words = LEADERBOARD.field;
  const centerInk = { 3: x.gray300, 4: color.inkMuted, 5: color.inkDisabled } as const;
  return (
    <View style={[styles.wrap, { borderColor: t.wrapBorder, backgroundColor: color.ground }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="bz-lines" width="40" height="40" patternUnits="userSpaceOnUse">
            <Rect y="39" width="40" height="1" fill={t.wrapLine} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bz-lines)" />
      </Svg>
      <View style={[styles.strip, { backgroundColor: t.stripFill, borderBottomColor: t.stripBorder }]}>
        <Text style={[styles.mono10, { color: color.inkMuted }]}>{words.strip.ranks}</Text>
        <Text style={[styles.stripCenter, { color: color.accent }]}>{words.strip.center(span)}</Text>
        <Text style={[styles.mono10, { color: color.inkMuted }]}>{words.strip.right}</Text>
      </View>
      <View style={[styles.grid, { borderBottomColor: t.headBorder }]}>
        <Text style={[styles.mono10, styles.headSide, styles.right, { color: color.inkMuted }]}>{words.heads.east}</Text>
        <Text style={[styles.mono10, styles.headCenter, { color: color.inkDisabled, borderColor: t.centerBorder }]}>{words.heads.center}</Text>
        <Text style={[styles.mono10, styles.headSide, { color: color.inkMuted }]}>{words.heads.west}</Text>
      </View>
      {rows.map((row, i) => {
        const previous = i > 0 ? (rows[i - 1] as BanzukeRow).tier : row.tier;
        const divider = i > 0 && row.tier !== previous ? (row.tier === 4 ? words.dividers.rankAndFile : row.tier === 5 ? words.dividers.longTail : null) : null;
        return (
          <Fragment key={row.rank}>
            {divider ? (
              <Text style={[styles.mono10, styles.divider, { color: color.inkDisabled, backgroundColor: t.dividerFill, borderColor: t.dividerBorder }]}>{divider}</Text>
            ) : null}
            <View style={[styles.grid, { minHeight: TIER[row.tier].minHeight, borderBottomColor: t.rowBorder }]}>
              <Cell trader={row.east} tier={row.tier} side="east" decimals={decimals} />
              <View style={[styles.center, { backgroundColor: t.centerFill, borderColor: t.centerBorder }]}>
                <Text style={[styles.centerText, { fontSize: TIER[row.tier].center, color: centerInk[row.tier] }]} adjustsFontSizeToFit numberOfLines={1}>
                  {row.label}
                </Text>
              </View>
              <Cell trader={row.west} tier={row.tier} side="west" decimals={decimals} />
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, borderWidth: 1, borderRadius: 4, overflow: "hidden" },
  strip: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, gap: 8 },
  mono10: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
  stripCenter: { flex: 1, textAlign: "center", fontFamily: FONT.stamp, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.4 },
  grid: { flexDirection: "row", borderBottomWidth: 1 },
  headSide: { flex: 1, paddingVertical: 12, paddingHorizontal: 24 },
  right: { textAlign: "right" },
  headCenter: { width: 50, paddingVertical: 12, textAlign: "center", borderLeftWidth: 1, borderRightWidth: 1 },
  divider: { paddingVertical: 12, paddingHorizontal: 24, textAlign: "center", borderTopWidth: 1, borderBottomWidth: 1 },
  cell: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, gap: 8 },
  east: { justifyContent: "flex-end" },
  west: { justifyContent: "flex-start" },
  text: { flexShrink: 1, minWidth: 0 },
  name: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8, letterSpacing: -0.13 },
  pnl: { fontFamily: FONT.dataRegular, flexShrink: 0, fontVariant: ["tabular-nums"] },
  center: { width: 50, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderRightWidth: 1 },
  centerText: { fontFamily: FONT.stamp },
});
