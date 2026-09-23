import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, RADIUS, useTheme, type Palette } from "~/theme";
import { haptic } from "./haptics";

/** web's components/ui/button.tsx variants and heights: 44 touch floor, 48 primary, 52 the ticket CTA. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "profit" | "loss";
export type ButtonSize = "sm" | "md" | "lg";

const HEIGHT: Record<ButtonSize, number> = { sm: 44, md: 48, lg: 52 };

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A leading SF Symbol / Material Symbol. */
  icon?: SymbolViewProps["name"];
  /** A trailing glyph such as "→"; drawn in the label's colour. */
  trailing?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch across the row (the default); false sizes to the label. */
  block?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function tones(variant: ButtonVariant, color: Palette) {
  switch (variant) {
    case "primary":
      return { bg: color.accent, pressed: color.accentPressed, ink: color.onAccent, border: "transparent" };
    case "secondary":
      return { bg: color.surface2, pressed: color.surface3, ink: color.ink, border: "transparent" };
    case "outline":
      return { bg: "transparent", pressed: color.surface2, ink: color.ink, border: color.borderStrong };
    case "ghost":
      return { bg: "transparent", pressed: color.surface2, ink: color.accent, border: "transparent" };
    case "destructive":
      return { bg: color.lossWash, pressed: color.lossWash, ink: color.loss, border: "transparent" };
    case "profit":
      return { bg: color.profit, pressed: color.profit, ink: color.ground, border: "transparent" };
    case "loss":
      return { bg: color.loss, pressed: color.loss, ink: color.ground, border: "transparent" };
  }
}

export function Button({ label, onPress, variant = "primary", size = "md", icon, trailing, loading, disabled, block = true, accessibilityHint, style }: Props) {
  const { color } = useTheme();
  const tone = tones(variant, color);
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: pressed ? tone.pressed : tone.bg, borderColor: tone.border, opacity: disabled ? 0.45 : 1 },
        block ? styles.block : styles.inline,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.ink} /> : icon ? <SymbolView name={icon} size={17} tintColor={tone.ink} /> : null}
      <Text style={[styles.label, size === "sm" && styles.labelSm, { color: tone.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing && !loading ? <View style={styles.trailing}>{typeof trailing === "string" ? <Text style={[styles.label, { color: tone.ink }]}>{trailing}</Text> : trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: RADIUS.md, borderWidth: 1 },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  pressed: { transform: [{ translateY: 1 }] },
  label: { fontFamily: FONT.bodyStrong, fontSize: 16 },
  labelSm: { fontSize: 14 },
  trailing: { marginLeft: "auto" },
});
