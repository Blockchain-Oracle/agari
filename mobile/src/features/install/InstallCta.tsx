import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { openExternal } from "~/lib/external";
import { SITE_URL } from "~/lib/env";
import { FONT, useTheme } from "~/theme";
import { APP_INSTALL } from "./copy";

/** web's TrayArrow: an arrow descending into a tray — 'get', not 'share'. */
function TrayArrow({ ink }: { ink: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * web's `InstallCta` (features/install/InstallCta.tsx) in its expander state: the vermilion pill toggles, in place,
 * web's numbered `.dl-steps` (the other devices Agari installs on) and, once published, the native builds' links as
 * `.dl-hint` lines. This phone already has the app, so the steps point elsewhere.
 */
export function InstallCta() {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? color.accentPressed : color.accent }]}
      >
        <Text style={[styles.ctaText, { color: color.onAccent }]}>{APP_INSTALL.cta}</Text>
        <TrayArrow ink={color.onAccent} />
      </Pressable>
      {open ? (
        <View style={styles.steps}>
          {APP_INSTALL.steps(SITE_URL).map((step, i) => (
            <View key={step} style={styles.step}>
              <Text style={[styles.num, { color: color.accent }]}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[styles.stepText, { color: color.inkSecondary }]}>{step}</Text>
            </View>
          ))}
          {APP_INSTALL.builds.map((build) => (
            <Pressable key={build.label} onPress={() => void openExternal(build.url)} accessibilityRole="link">
              <Text style={[styles.hint, { color: color.accent }]}>{build.label} ↗</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 12, marginTop: 34, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 999 },
  ctaText: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 25.6, letterSpacing: -0.16 },
  // .dl-steps: 18 above, 8 apart, 46ch wide; each li a baseline row, 12 apart, with its vermilion mono counter.
  steps: { marginTop: 18, gap: 8, maxWidth: 360 },
  step: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  num: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  stepText: { flex: 1, fontFamily: FONT.body, fontSize: 14.72, lineHeight: 22.08 },
  // .dl-hint's 0.9rem at 1.55, as vermilion links (web's `.pitch-link-verm` tone for an outside link).
  hint: { marginTop: 6, fontFamily: FONT.body, fontSize: 14.4, lineHeight: 22.32 },
});
