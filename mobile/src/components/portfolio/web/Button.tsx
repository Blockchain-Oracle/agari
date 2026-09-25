import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";

export type WebButtonVariant = "default" | "secondary" | "outline" | "ghost" | "link" | "blocked";
export type WebButtonSize = "default" | "sm" | "xs" | "lg";

/** web `components/ui/button.tsx` sizes: h-(--button-primary-height) 48 · h-touch 44 · h-8 · the Ticket CTA 52; text-base 15 / text-sm 13.125. */
const SIZE: Record<WebButtonSize, { height: number; padX: number; fontSize: number; lineHeight: number; gap: number }> = {
  default: { height: 48, padX: 16, fontSize: 15, lineHeight: 22.5, gap: 8 },
  sm: { height: 44, padX: 12, fontSize: 13.125, lineHeight: 18.75, gap: 6 },
  xs: { height: 32, padX: 8, fontSize: 11.25, lineHeight: 15, gap: 4 },
  lg: { height: 52, padX: 20, fontSize: 15, lineHeight: 22.5, gap: 8 },
};

interface WebButtonProps {
  label: string;
  onPress?: () => void;
  variant?: WebButtonVariant;
  size?: WebButtonSize;
  disabled?: boolean;
  /** `w-full`: the button fills its row. */
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * web's shadcn `Button` as it computes: rounded-md (8), a transparent 1 px border, Inter 500, disabled at opacity 0.5,
 * pressed one pixel down (`active:translate-y-px`). `blocked` is web's `BlockedButton`: the blocker IS the label.
 */
export function WebButton({ label, onPress, variant = "default", size = "default", disabled, block, icon, trailing, style, accessibilityLabel }: WebButtonProps) {
  const { color } = useTheme();
  const s = SIZE[size];
  const fill = { default: color.accent, secondary: color.surface2, outline: color.ground, ghost: "transparent", link: "transparent", blocked: color.surface2 }[variant];
  const ink = { default: color.onAccent, secondary: color.ink, outline: color.ink, ghost: color.ink, link: color.accent, blocked: color.inkDisabled }[variant];
  const border = variant === "outline" || variant === "blocked" ? color.hairline : "transparent";
  const off = disabled || variant === "blocked";
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off }}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, paddingHorizontal: s.padX, gap: s.gap, backgroundColor: fill, borderColor: border },
        block ? styles.block : styles.inline,
        disabled && variant !== "blocked" ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        numberOfLines={variant === "blocked" ? 2 : 1}
        style={[styles.label, { fontSize: s.fontSize, lineHeight: s.lineHeight, color: ink }, variant === "link" ? styles.underline : null]}
      >
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1 },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  label: { fontFamily: FONT.bodyMedium, textAlign: "center", flexShrink: 1 },
  underline: { textDecorationLine: "underline" },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 1 }] },
});
