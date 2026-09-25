import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { AccentChoice } from "@/features/games/settings";
import { FONT } from "~/theme";
import { Press } from "../frame/Press";
import { useGamesTokens } from "../frame/tokens";

/**
 * games.css `.gm-seg-btn`: a pill radio (Inter 12, 7 × 12 padding), vermilion-washed when on. An accent choice
 * carries its 12 px `.gm-seg-swatch`; `default` (the address's own hue) is the three-way 135° split.
 */
export function Segment({ label, on, onPress, accent }: { label: string; on: boolean; onPress: () => void; accent?: AccentChoice }) {
  const { t, color } = useGamesTokens();
  const swatch = accent === "vermilion" ? color.accent : accent === "up" ? color.profit : accent === "down" ? color.loss : color.inkMuted;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.btn, { borderColor: on ? t.segOnBorder : t.segBorder, backgroundColor: on ? t.segOnBg : "transparent" }]}
    >
      {accent === "default" ? (
        <Svg width={12} height={12} viewBox="0 0 12 12" style={styles.round}>
          <Defs>
            <LinearGradient id="gm-sw" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color.accent} />
              <Stop offset="0.34" stopColor={color.accent} />
              <Stop offset="0.34" stopColor={color.profit} />
              <Stop offset="0.67" stopColor={color.profit} />
              <Stop offset="0.67" stopColor={color.loss} />
              <Stop offset="1" stopColor={color.loss} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={12} height={12} rx={6} fill="url(#gm-sw)" />
        </Svg>
      ) : accent ? (
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
      ) : null}
      <Text style={[styles.text, { color: on ? color.accent : color.inkSecondary }]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  round: { borderRadius: 6 },
  swatch: { width: 12, height: 12, borderRadius: 9999 },
  text: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
});
