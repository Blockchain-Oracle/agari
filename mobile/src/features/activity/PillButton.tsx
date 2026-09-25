import { Pressable, StyleSheet, Text } from "react-native";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

/**
 * yosuku part-03 `.btn.btn-primary`: the vermilion pill (radius 999, 11 × 22 padding, Inter 600 13 px, tracking
 * 0.02em, line-height 1), cream label in light (part-14). Pressed scales as web's hover does.
 */
export function PillButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { name } = useTheme();
  const t = activityTokens(name);
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.pill, { backgroundColor: t.pillFill, opacity: disabled ? 0.5 : 1 }, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.label, { color: t.pillInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  pressed: { transform: [{ scale: 1.02 }] },
  label: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 15, letterSpacing: 0.26, textAlign: "center" },
});
