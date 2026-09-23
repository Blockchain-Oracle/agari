import { shortHex } from "@agari/core/units";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { openProfile, signedPnl, type Spot } from "./board";
import { Portrait } from "./Portrait";

/** Pedestal heights by place, and the order they rise in (third, second, then the champion). */
const HEIGHT = { 1: 104, 2: 76, 3: 58 } as const;
const RISE_DELAY = { 1: 260, 2: 130, 3: 0 } as const;

function Pedestal({ place, height }: { place: 1 | 2 | 3; height: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) grow.value = withDelay(RISE_DELAY[place], withTiming(1, { duration: 420 }));
  }, [reduce, grow, place]);
  const style = useAnimatedStyle(() => ({ height: height * grow.value }));
  const champion = place === 1;
  return (
    <Animated.View
      style={[
        styles.pedestal,
        { backgroundColor: champion ? color.accent : color.surface2, borderColor: champion ? color.accentPressed : color.hairline },
        style,
      ]}
    >
      <Text style={[styles.pedestalRank, { color: champion ? color.onAccent : color.inkMuted }]}>{place}</Text>
    </Animated.View>
  );
}

/** A place nobody holds yet on this board: the pedestal stands, the name stays blank. */
function EmptySpot({ place }: { place: 1 | 2 | 3 }) {
  const { color } = useTheme();
  return (
    <View style={styles.spot} accessible accessibilityLabel={`${LEADERBOARD.podium.ordinals[place]} place: nobody yet`}>
      <View style={[styles.emptyDisc, { borderColor: color.hairline }]} />
      <Text style={[styles.pnl, { color: color.inkMuted }]}>{LEADERBOARD.dash}</Text>
      <View style={[styles.pedestal, styles.emptyPedestal, { height: HEIGHT[place], borderColor: color.hairline }]}>
        <Text style={[styles.pedestalRank, { color: color.inkDisabled }]}>{place}</Text>
      </View>
    </View>
  );
}

// 21st: trophyso/leaderboard-podium — 2nd · 1st · 3rd, avatar with its place badge, name and value over stepped pedestals.
/**
 * web's `Podium` (features/leaderboard/Podium.tsx): the top three by profit in the podium's own order, the champion
 * under the sash with their streak, a challenger and a contender. Each spot opens the trader's profile.
 */
export function Podium({ spots, decimals, symbol }: { spots: readonly Spot[]; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const words = LEADERBOARD.podium;
  return (
    <View style={styles.podium} accessibilityRole="list" accessibilityLabel="Top three by profit">
      {([2, 1, 3] as const).map((place) => {
        const spot = spots.find((s) => s.r === place);
        if (!spot) return <EmptySpot key={place} place={place} />;
        const champion = spot.r === 1;
        const pnl = signedPnl(spot.pnlBase, decimals);
        const eyebrow = champion ? words.streak(spot.bestStreak) : spot.r === 2 ? words.challenger : words.contender;
        return (
          <Pressable
            key={spot.r}
            style={({ pressed }) => [styles.spot, pressed && styles.pressed]}
            onPress={() => {
              haptic.tap();
              openProfile(spot.owner);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${words.ordinals[spot.r]} place, ${shortHex(spot.owner)}, ${pnl} ${symbol}. Open profile`}
          >
            {champion ? (
              <View style={[styles.sash, { backgroundColor: color.accentWash, borderColor: color.accentDim }]}>
                <Text style={[styles.sashText, { color: color.accent }]} numberOfLines={1}>
                  {words.sash}
                </Text>
              </View>
            ) : null}
            <View>
              <Portrait address={spot.owner} size={champion ? 60 : 48} ring={champion ? color.accent : color.borderStrong} />
              <View style={[styles.badge, { backgroundColor: champion ? color.accent : color.surface3, borderColor: color.ground }]}>
                <Text style={[styles.badgeText, { color: champion ? color.onAccent : color.ink }]}>{words.ordinals[spot.r]}</Text>
              </View>
            </View>
            <Text style={[styles.eyebrow, { color: champion ? color.accent : color.inkMuted }]} numberOfLines={1}>
              {eyebrow}
            </Text>
            <Text style={[TYPE.data, { color: color.ink }]} numberOfLines={1}>
              {shortHex(spot.owner, 4, 4)}
            </Text>
            <Text style={[styles.pnl, { color: spot.pnlBase < 0n ? color.loss : color.profit }]} numberOfLines={1} adjustsFontSizeToFit>
              {pnl}
            </Text>
            <Text style={[styles.cur, { color: color.inkMuted }]}>{symbol}</Text>
            <Pedestal place={spot.r} height={HEIGHT[spot.r]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8 },
  spot: { flex: 1, alignItems: "center", gap: 4 },
  pressed: { opacity: 0.85 },
  sash: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  sashText: { fontFamily: FONT.data, fontSize: 9, letterSpacing: 1.2 },
  badge: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    borderWidth: 2,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontFamily: FONT.dataStrong, fontSize: 9.5, letterSpacing: 0.6 },
  eyebrow: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1, marginTop: 8 },
  pnl: { fontFamily: FONT.dataStrong, fontSize: 17, lineHeight: 21 },
  cur: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.8, marginTop: -2 },
  pedestal: {
    alignSelf: "stretch",
    marginTop: 6,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  emptyDisc: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderStyle: "dashed" },
  emptyPedestal: { borderStyle: "dashed" },
  pedestalRank: { fontFamily: FONT.headingHeavy, fontSize: 28, lineHeight: 40 },
});
