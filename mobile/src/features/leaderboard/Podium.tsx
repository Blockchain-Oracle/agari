import { formatBaseUnits, shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import type { Spot } from "./board";
import { Portrait } from "./Portrait";

/** part-08 sizes: the champion's card runs larger on every line. */
const SIZE = {
  first: { rank: 240, rankLh: 192, rankLs: -14.4, portrait: 112, glyph: 44, glyphLs: 0.88, name: 30, nameLh: 48, nameLs: -0.6, pnl: 56, pnlLs: -2.24 },
  other: { rank: 180, rankLh: 144, rankLs: -10.8, portrait: 88, glyph: 34, glyphLs: 0.68, name: 22, nameLh: 35.2, nameLs: -0.44, pnl: 36, pnlLs: -1.44 },
} as const;

function SpotCard({ spot, decimals, symbol }: { spot: Spot; decimals: number; symbol: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = LEADERBOARD.podium;
  const first = spot.r === 1;
  const s = first ? SIZE.first : SIZE.other;
  const sign = spot.pnlBase >= 0n ? "+" : "";
  const figure = formatBaseUnits(spot.pnlBase, decimals);
  return (
    <View
      style={[styles.spot, { borderColor: first ? t.firstBorder : t.spotBorder, backgroundColor: first ? t.firstFill : t.spotFill }]}
      accessible
      accessibilityLabel={`${words.ordinals[spot.r]}, ${shortHex(spot.owner)}, ${sign}${figure} ${symbol}`}
    >
      {first ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="podium-glow" cx="100%" cy="0%" r="100%" fx="100%" fy="0%">
              <Stop offset="0" stopColor={t.firstGlow} />
              <Stop offset="0.6" stopColor={t.firstGlowClear} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#podium-glow)" />
        </Svg>
      ) : null}
      <Text style={[styles.rank, { color: first ? t.firstRank : t.rank, fontSize: s.rank, lineHeight: s.rankLh, letterSpacing: s.rankLs }]}>{spot.r}</Text>
      {first ? (
        <View style={[styles.sash, { backgroundColor: color.accent, shadowColor: t.sashShadow }]}>
          <Text style={[styles.sashText, { color: t.sashInk }]}>{words.sash}</Text>
        </View>
      ) : null}
      <View style={styles.eyebrow}>
        <Text style={[styles.ord, first ? { backgroundColor: color.accent, color: t.firstOrdInk } : { backgroundColor: t.ordFill, color: t.ordInk }]}>
          {words.ordinals[spot.r]}
        </Text>
        <Text style={[styles.eyebrowText, { color: color.inkMuted }]}>
          {first ? words.streak(spot.bestStreak) : spot.r === 2 ? words.challenger : words.contender}
        </Text>
      </View>
      <View style={styles.portrait}>
        <Portrait
          id={`podium-${spot.r}`}
          address={spot.owner}
          size={s.portrait}
          stops={first ? t.fire : t.gold}
          border={first ? t.firstPortraitBorder : t.portraitBorder}
          borderWidth={2}
          ink={t.portraitInk}
          fontFamily={FONT.heading}
          fontSize={s.glyph}
          letterSpacing={s.glyphLs}
        />
      </View>
      <Text style={[styles.name, { color: color.ink, fontSize: s.name, lineHeight: s.nameLh, letterSpacing: s.nameLs }]} numberOfLines={1}>
        {shortHex(spot.owner)}
      </Text>
      <View style={styles.pnl}>
        {sign ? (
          <Text style={[styles.pnlText, { color: color.accent, fontSize: s.pnl * 0.55, transform: [{ translateY: -s.pnl * 0.55 * 0.16 }], marginRight: s.pnl * 0.55 * 0.05 }]}>
            {sign}
          </Text>
        ) : null}
        <Text style={[styles.pnlText, { color: color.accent, fontSize: s.pnl, lineHeight: s.pnl, letterSpacing: s.pnlLs }]}>{figure}</Text>
        <Text
          style={[
            styles.cur,
            { color: color.inkMuted, fontSize: s.pnl * 0.32, letterSpacing: s.pnl * 0.32 * 0.06, marginLeft: s.pnl * 0.32 * 0.4, transform: [{ translateY: -s.pnl * 0.32 * 0.6 }] },
          ]}
        >
          {symbol}
        </Text>
      </View>
    </View>
  );
}

/**
 * web's `Podium` (features/leaderboard/Podium.tsx, part-08 `.podium-*`) at phone width: one column, 12 apart, in the
 * podium's own [2nd, 1st, 3rd] order — the champion's card with its sash, fire portrait and radial glow.
 */
export function Podium({ spots, decimals, symbol }: { spots: readonly Spot[]; decimals: number; symbol: string }) {
  return (
    <View style={styles.podium}>
      {spots.map((spot) => (
        <SpotCard key={spot.r} spot={spot} decimals={decimals} symbol={symbol} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { gap: 12 },
  spot: { borderWidth: 1, borderRadius: 4, paddingTop: 28, paddingHorizontal: 28, paddingBottom: 24, overflow: "hidden" },
  rank: { position: "absolute", top: 14, right: 18, fontFamily: FONT.headingHeavy },
  sash: {
    position: "absolute",
    top: 22,
    left: -36,
    width: 160,
    paddingVertical: 4,
    transform: [{ rotate: "-32deg" }],
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 3,
  },
  sashText: { fontFamily: FONT.dataStrong, fontSize: 9, lineHeight: 14.4, letterSpacing: 2.16, textAlign: "center" },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ord: { fontFamily: FONT.dataStrong, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 2, overflow: "hidden" },
  eyebrowText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
  portrait: { marginTop: 22, alignSelf: "flex-start" },
  name: { marginTop: 18, fontFamily: FONT.heading },
  pnl: { marginTop: 24, flexDirection: "row", alignItems: "baseline" },
  pnlText: { fontFamily: FONT.headingHeavy },
  // web: 800, the pnl's weight inherited; the heaviest mono loaded.
  cur: { fontFamily: FONT.dataStrong },
});
