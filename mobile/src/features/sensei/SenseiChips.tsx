import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { chipsFor, SENSEI_STARTERS } from "@/features/sensei/copy";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";

/** web's `.sd-chips`: the follow-ups under Sensei's latest answer, vermilion pills indented past the seal. */
export function SenseiChips({ reply, onPick }: { reply: string; onPick: (chip: string) => void }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(360)} style={styles.chips}>
      {chipsFor(reply).map((chip) => (
        <Pressable
          key={chip}
          onPress={() => onPick(chip)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.chip, { borderColor: t.chipBorder, backgroundColor: t.chipFill }, pressed && styles.pressed]}
        >
          <Text style={[styles.chipText, { color: color.accent }]}>{chip}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

/** web's `.sensei-drawer-starters`: the first turn's questions, quiet pills above the composer. */
export function SenseiStarters({ onPick }: { onPick: (starter: string) => void }) {
  const { name } = useTheme();
  const t = senseiTokens(name);
  return (
    <View style={styles.starters}>
      {SENSEI_STARTERS.map((starter) => (
        <Pressable key={starter} onPress={() => onPick(starter)} accessibilityRole="button" style={[styles.starter, { borderColor: t.starterBorder, backgroundColor: t.starterFill }]}>
          <Text style={[styles.starterText, { color: t.starterInk }]}>{starter}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingVertical: 1, paddingLeft: 35 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  chipText: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20 },
  pressed: { transform: [{ scale: 0.96 }] },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 18, paddingBottom: 10 },
  starter: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  starterText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
});
