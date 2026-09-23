import { ARCADE } from "@/features/games/arcade/copy";
import { StyleSheet, Text, View } from "react-native";
import { FONT, SPACE } from "~/theme";
import { ISLAND } from "./palette";

/**
 * web's `.ar-hud`: the live score, the best (which climbs with the run once the run passes it) and, on the ride,
 * the combo once it reaches ×2 — in the field's own ink, top left, clear of the grip bar.
 */
export function ArcadeHud({ score, best, combo }: { score: number; best: number; combo: number | null }) {
  return (
    <View style={styles.hud} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.k}>{ARCADE.hud.score.toUpperCase()}</Text>
      <Text style={styles.v}>{ARCADE.fmt(score)}</Text>
      <Text style={styles.k}>
        {ARCADE.hud.best.toUpperCase()} <Text style={styles.bestV}>{ARCADE.fmt(best)}</Text>
      </Text>
      {combo !== null && combo >= 2 ? <Text style={styles.combo}>{ARCADE.hud.combo(combo)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { position: "absolute", top: 10, left: SPACE.gutter + 4, gap: 1 },
  k: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.4, color: ISLAND.inkSoft },
  v: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 25, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  bestV: { color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  combo: { fontFamily: FONT.dataStrong, fontSize: 13, letterSpacing: 1.3, color: ISLAND.accent, fontVariant: ["tabular-nums"] },
});
