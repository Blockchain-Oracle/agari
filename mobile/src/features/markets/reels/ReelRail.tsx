import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, useAnimatedStyle, useReducedMotion, withSpring } from "react-native-reanimated";
import { FONT, RADIUS, useTheme } from "~/theme";

/** More dots than this and the rail would crowd the card; the rail then stops at the cap. */
const MAX_DOTS = 12;

/**
 * Where the reel is: a column of dots on the right edge, the current one stretched, and — on the first card only —
 * the hint that this is a vertical feed (web's `.reel-hint`: a viewer who never swipes assumes one market is the app).
 */
// 21st: ddoemonn/snap-carousel (the slide indicators)
export function ReelRail({ count, active, hint }: { count: number; active: number; hint: string | null }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const dots = Math.min(count, MAX_DOTS);
  return (
    <>
      <View style={styles.rail} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: dots }, (_, index) => (
          <Dot key={index} on={index === Math.min(active, dots - 1)} reduce={reduce} />
        ))}
      </View>
      {hint ? (
        <Animated.View exiting={reduce ? undefined : FadeOut} style={[styles.hint, { backgroundColor: color.surface3, borderColor: color.hairline }]} pointerEvents="none">
          <SymbolView name={{ ios: "chevron.up", android: "keyboard_arrow_up" }} size={14} tintColor={color.ink} />
          <Text style={[styles.hintText, { color: color.ink }]}>{hint}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

function Dot({ on, reduce }: { on: boolean; reduce: boolean }) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => ({ height: reduce ? (on ? 18 : 6) : withSpring(on ? 18 : 6, { damping: 16 }) }));
  return <Animated.View style={[styles.dot, { backgroundColor: on ? color.accent : color.inkMuted }, style]} />;
}

const styles = StyleSheet.create({
  rail: { position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center", gap: 5 },
  dot: { width: 4, borderRadius: 2 },
  hint: { position: "absolute", alignSelf: "center", bottom: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth },
  hintText: { fontFamily: FONT.bodyStrong, fontSize: 12 },
});
