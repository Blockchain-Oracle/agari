import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

/** x-card.css `.xc-step`: a numbered ring (a profit tick once done) and the step's body, hairline above, dimmed until it is reachable. */
export function Step({ index, label, done, dim, children }: { index: number; label: string; done?: boolean; dim?: boolean; children: ReactNode }) {
  const { name, color } = useTheme();
  const t = activityTokens(name);
  return (
    <View style={[styles.step, { borderTopColor: t.xcLine }, dim ? styles.dim : null]}>
      <View style={[styles.n, { borderColor: done ? color.profit : t.xcLine }]}>
        <Text style={[styles.nText, { color: done ? color.profit : color.inkSecondary }]}>{done ? "✓" : index}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, { color: color.ink }]}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

/** `.xc-done`: the profit dot and a line in profit ink. */
export function Done({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.done}>
      <View style={[styles.dot, { backgroundColor: color.profit }]} />
      <Text style={[styles.doneText, { color: color.profit }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** `.xc-hint`: gray-400 at 14 px. */
export function Hint({ text }: { text: string }) {
  return <Text style={[styles.hint, { color: useTheme().color.inkSecondary }]}>{text}</Text>;
}

/** `.xc-x-btn`: the ink pill (white on the ground in dark), the X glyph when it signs in with X. */
export function XPill({ label, onPress, glyph, disabled, hint }: { label: string; onPress: () => void; glyph?: boolean; disabled?: boolean; hint?: string }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.xBtn, { backgroundColor: color.ink }, disabled ? styles.muted : null, pressed ? styles.pressed : null]}
    >
      {glyph ? (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill={color.ground}>
          <Path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4l13.2 17.3Z" />
        </Svg>
      ) : null}
      <Text style={[styles.xText, { color: color.ground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 16, paddingVertical: 22, borderTopWidth: 1 },
  dim: { opacity: 0.5 },
  n: { width: 30, height: 30, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  nText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 25.6, marginBottom: 12 },
  done: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  doneText: { flexShrink: 1, fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  hint: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  xBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 22 },
  xText: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  muted: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
