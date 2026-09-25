import { ARCADE } from "@/features/games/arcade/copy";
import { StyleSheet, Text, View } from "react-native";
import { PIXEL_FONT } from "~/theme/web/games";
import { ISLAND, useArcadeTokens } from "./palette";

/**
 * web's `.ar-hud`: the live score in the pixel face (22 px on a phone), the best under it — which climbs with
 * the run once the run passes it — and, on the ride, the combo once it reaches ×2; in the field's own ink,
 * top left, one rim in.
 */
export function ArcadeHud({ score, best, combo }: { score: number; best: number; combo: number | null }) {
  const a = useArcadeTokens();
  return (
    <View style={styles.hud} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.k, { color: a.ink55 }]}>{ARCADE.hud.score.toUpperCase()}</Text>
      <Text style={styles.v}>{ARCADE.fmt(score)}</Text>
      <Text style={[styles.k, { color: a.ink55 }]}>
        {ARCADE.hud.best.toUpperCase()} <Text style={{ color: a.ink85 }}>{ARCADE.fmt(best)}</Text>
      </Text>
      {combo !== null && combo >= 2 ? <Text style={styles.combo}>{ARCADE.hud.combo(combo)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { position: "absolute", top: 14, left: 26, gap: 2, zIndex: 5 },
  k: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  v: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  combo: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.4, color: ISLAND.accent },
});
