import { formatBaseUnits, shortHex } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { openProfile, record, type Spot } from "./board";
import { Portrait } from "./Portrait";

/** Pedestal heights, 2-1-3, and portrait sizes: the champion stands tallest. */
const PEDESTAL = { 1: 64, 2: 44, 3: 32 } as const;
const AVATAR = { 1: 56, 2: 44, 3: 44 } as const;

function Step({ spot, decimals, symbol }: { spot: Spot; decimals: number; symbol: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = LEADERBOARD.podium;
  const first = spot.r === 1;
  const up = spot.pnlBase >= 0n;
  const { wins, losses } = record(spot);
  return (
    <Pressable
      onPress={() => openProfile(spot.owner)}
      accessibilityRole="link"
      accessibilityLabel={`${words.ordinals[spot.r]}, ${shortHex(spot.owner)}, ${up ? "+" : ""}${formatBaseUnits(spot.pnlBase, decimals)} ${symbol}. Open their record`}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      {first ? (
        <View style={[styles.crown, { backgroundColor: color.accent }]}>
          <Text style={[styles.crownText, { color: t.firstOrdInk }]}>{words.ordinals[1]}</Text>
        </View>
      ) : null}
      <Portrait
        id={`podium-${spot.r}`}
        address={spot.owner}
        size={AVATAR[spot.r]}
        stops={first ? t.fire : t.gold}
        border={first ? t.firstPortraitBorder : t.portraitBorder}
        borderWidth={2}
        ink={t.portraitInk}
        fontFamily={FONT.heading}
        fontSize={Math.round(AVATAR[spot.r] * 0.4)}
      />
      <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
        {shortHex(spot.owner, 4, 4)}
      </Text>
      <Text style={[styles.pnl, { color: up ? color.profit : color.loss }]} numberOfLines={1} adjustsFontSizeToFit>
        {up ? "+" : ""}
        {formatBaseUnits(spot.pnlBase, decimals)}
      </Text>
      <Text style={[styles.rec, { color: color.inkMuted }]} numberOfLines={1}>
        {wins}–{losses}
      </Text>
      <View
        style={[
          styles.pedestal,
          { height: PEDESTAL[spot.r], borderColor: first ? t.firstBorder : t.spotBorder, backgroundColor: first ? color.accentWash : t.spotFill },
        ]}
      >
        <Text style={[styles.rank, { color: first ? color.accent : color.inkDisabled }]}>{spot.r}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The phone podium: the top three side by side on 2-1-3 pedestals (web's podium order), each with its gradient
 * portrait, short name, profit in green or red and win–loss record; ~200 pt tall. A spot opens that trader's record.
 */
export function Podium({ spots, decimals, symbol }: { spots: readonly Spot[]; decimals: number; symbol: string }) {
  return (
    <View style={styles.podium}>
      {spots.map((spot) => (
        <Step key={spot.r} spot={spot} decimals={decimals} symbol={symbol} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  step: { flex: 1, minWidth: 0, alignItems: "center" },
  pressed: { opacity: 0.7 },
  crown: { borderRadius: 2, paddingVertical: 2, paddingHorizontal: 6, marginBottom: 6 },
  crownText: { fontFamily: FONT.dataStrong, fontSize: 9, lineHeight: 12, letterSpacing: 1.6 },
  name: { marginTop: 6, fontFamily: FONT.heading, fontSize: 13, lineHeight: 18, letterSpacing: -0.13 },
  pnl: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 20, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  rec: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 14, letterSpacing: 0.6, marginBottom: 6 },
  pedestal: { alignSelf: "stretch", borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: "center", justifyContent: "center" },
  rank: { fontFamily: FONT.headingHeavy, fontSize: 22, lineHeight: 26 },
});
