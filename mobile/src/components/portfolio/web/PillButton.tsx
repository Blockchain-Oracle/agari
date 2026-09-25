import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { portfolioTokens } from "~/theme/web/portfolio";

/**
 * yosuku `.btn .btn-primary` (part-03): the vermilion pill — Inter 600 13 px, 0.02em, padding 11/22, light ink in both
 * themes; scale 0.98 while pressed. `block` is `max-sm:w-full`.
 */
export function PillButton({ label, onPress, block, disabled, style }: { label: string; onPress: () => void; block?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { name, color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.pill, { backgroundColor: color.accent }, block ? styles.block : styles.inline, disabled ? styles.off : null, pressed ? styles.pressed : null, style]}
    >
      <Text style={[styles.label, { color: portfolioTokens(name).btnPrimaryInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  label: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 15, letterSpacing: 0.26 },
  off: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
});
