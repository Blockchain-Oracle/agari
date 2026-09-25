import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT } from "~/theme";
import { Press } from "./Press";
import { useGamesTokens } from "./tokens";

export type CtaVariant = "primary" | "quiet" | "leave";

interface Props {
  label: string;
  onPress: () => void;
  variant?: CtaVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * duel.css `.du-cta`: the games' commit button — vermilion, 48 tall, radius 8, Sora 700 14 in cream ink, with the
 * games.css lip (a light top edge, a dark bottom edge and a 2 px step beneath) that flattens while pressed.
 * `quiet` is `.du-cta--quiet` (hairline, ink); `leave` is `.du-cta--leave` (the loss wash).
 */
export function Cta({ label, onPress, variant = "primary", disabled, busy, style, accessibilityLabel }: Props) {
  const { t, color } = useGamesTokens();
  const off = disabled || busy;
  const ground: ViewStyle =
    variant === "primary"
      ? { backgroundColor: color.accent, borderColor: "transparent" }
      : variant === "leave"
        ? { backgroundColor: t.ctaLeaveBg, borderColor: t.ctaLeaveBorder }
        : { backgroundColor: "transparent", borderColor: color.hairline };
  const ink = variant === "primary" ? t.ctaInk : variant === "leave" ? color.loss : color.ink;
  return (
    <Press
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={(pressed) => [styles.cta, ground, variant === "primary" && !pressed && [styles.drop, { shadowColor: t.ctaDrop }], off && styles.off, style]}
    >
      {(pressed) => (
        <>
          {variant === "primary" ? (
            <View pointerEvents="none" style={styles.lips}>
              <View style={[styles.lipTop, { backgroundColor: pressed ? t.ctaLipBottom : t.ctaLipTop }]} />
              <View style={[styles.lipBottom, { backgroundColor: pressed ? "transparent" : t.ctaLipBottom }]} />
            </View>
          ) : null}
          {busy ? <ActivityIndicator color={ink} /> : <Text style={[styles.label, { color: ink }]}>{label}</Text>}
        </>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  cta: { alignSelf: "stretch", minHeight: 48, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  lips: { ...StyleSheet.absoluteFill, borderRadius: 7, overflow: "hidden" },
  drop: { shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  off: { opacity: 0.45 },
  lipTop: { position: "absolute", top: 0, left: 0, right: 0, height: 1 },
  lipBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2 },
  label: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.28 },
});
