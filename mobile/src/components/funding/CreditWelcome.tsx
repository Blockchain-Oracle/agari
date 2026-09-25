import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Sparkles, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { CREDITED_EVENT, FUNDING, OPEN_FUNDS_EVENT } from "@/features/funding/copy";
import { haptic } from "~/components/kit";
import type { CreditedDetail } from "~/web-shims/credited";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";

/** How many screens currently draw the welcome themselves (the Add-money modal sits above the root host). */
let localHosts = 0;

/**
 * web `CreditWelcome`: the one-time card when an address is credited for the first time — the profit-ringed badge
 * with Sparkles, "You're funded", the amount, and "Let's go →" — gone by itself after eight seconds. `local` marks the
 * copy drawn inside the Add-money modal, which a native modal would otherwise cover.
 */
export function CreditWelcome({ local = false }: { local?: boolean }) {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const reduce = useReducedMotion();
  const [credit, setCredit] = useState<CreditedDetail | null>(null);

  useEffect(() => {
    if (local) localHosts += 1;
    const sub = DeviceEventEmitter.addListener(CREDITED_EVENT, (detail: CreditedDetail) => {
      if (!detail?.firstTime) return;
      if (!local && localHosts > 0) return;
      haptic.success();
      setCredit(detail);
    });
    return () => {
      sub.remove();
      if (local) localHosts -= 1;
    };
  }, [local]);

  useEffect(() => {
    if (!credit) return;
    const timer = setTimeout(() => setCredit(null), 8_000);
    return () => clearTimeout(timer);
  }, [credit]);

  if (!credit) return null;
  const close = () => setCredit(null);
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.root}>
      <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.creditScrim }]} onPress={close} accessibilityLabel={FUNDING.welcome.close} />
      <Animated.View
        entering={reduce ? FadeIn : ZoomIn.springify().damping(20).stiffness(280)}
        accessibilityViewIsModal
        style={[styles.card, { backgroundColor: t.creditPaper, borderColor: t.creditBorder, shadowColor: color.profit }]}
      >
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={FUNDING.welcome.close} hitSlop={8} style={styles.close}>
          <X size={16} color={color.inkDisabled} />
        </Pressable>
        <Animated.View entering={reduce ? undefined : ZoomIn.delay(50).springify().damping(12).stiffness(240)} style={[styles.badge, { borderColor: t.creditBadgeRing, backgroundColor: t.creditBadgeFill, shadowColor: color.profit }]}>
          <Sparkles size={24} color={color.profit} />
        </Animated.View>
        <Text style={[styles.eyebrow, { color: t.creditEyebrow }]}>{FUNDING.welcome.eyebrow}</Text>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {FUNDING.welcome.title(credit.amountText, credit.symbol)}
        </Text>
        <Text style={[styles.body, { color: color.inkSecondary }]}>{FUNDING.welcome.body}</Text>
        <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? color.accentPressed : t.vermilion }]}>
          <Text style={[styles.ctaText, { color: t.vermilionInk }]}>{FUNDING.welcome.cta}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The root's half of web's funding announcements: `openFunds()` (an out-of-gas error, a ticket's short balance) opens
 * the Add-money modal, and a first credit anywhere else raises the welcome. Mounted once, above every screen.
 */
export function FundingHost() {
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(OPEN_FUNDS_EVENT, () => router.push("/funds"));
    return () => sub.remove();
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <CreditWelcome />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%", maxWidth: 384, borderRadius: 16, borderWidth: 1, alignItems: "center",
    paddingTop: 28, paddingHorizontal: 24, paddingBottom: 24, shadowOpacity: 0.18, shadowRadius: 45, shadowOffset: { width: 0, height: 24 },
  },
  close: { position: "absolute", top: 14, right: 14, borderRadius: 999, padding: 4 },
  badge: {
    width: 56, height: 56, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16,
    shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.6, marginTop: 6, textAlign: "center" },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21.1, marginTop: 8, marginBottom: 20, textAlign: "center" },
  cta: { alignSelf: "stretch", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
});
