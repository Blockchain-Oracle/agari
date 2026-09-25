import { Image } from "expo-image";
import { Code, ExternalLink } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { DEMO } from "@/features/demo/copy";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { demoTokens } from "~/theme/web/explore/demo";

/** web DemoBlocks `Reveal`: the reference's rise (opacity 0, y 28 → in, 700 ms, ease [0.22, 1, 0.36, 1]). */
export function Reveal({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Animated.View entering={FadeInDown.duration(700).easing(Easing.bezier(0.22, 1, 0.36, 1).factory())} style={style}>
      {children}
    </Animated.View>
  );
}

/** `.demo-eyebrow`: mono, 0.34em, vermilion at 80 %. */
export function Eyebrow({ children }: { children: string }) {
  const { name } = useTheme();
  return <Text style={[styles.eyebrow, { color: demoTokens(name).eyebrow }]}>{children}</Text>;
}

/** `.demo-h1` / `.demo-h2` / `.demo-close-h2` with the `Serif` half in Noto Serif JP and vermilion. */
export function Headline({ lead, serif, level }: { lead: string; serif: string; level: "h1" | "h2" | "close" }) {
  const { color } = useTheme();
  return (
    <Text style={[styles[level], { color: color.ink }]} accessibilityRole="header">
      {lead}
      <Text style={[styles.serif, { color: color.accent }]}>{serif}</Text>
    </Text>
  );
}

/** `.demo-kicker`: the section's lucide glyph (20) and its mono line. */
export function Kicker({ icon: Icon, children }: { icon: typeof Code; children: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.kicker}>
      <Icon size={20} color={color.accent} />
      <Text style={[styles.kickerText, { color: color.accent }]}>{children}</Text>
    </View>
  );
}

/** `.demo-body` (46ch; `.wide` 52ch). */
export function Body({ children, wide = false }: { children: string; wide?: boolean }) {
  const { color } = useTheme();
  return <Text style={[styles.body, { color: color.inkSecondary, maxWidth: wide ? 440 : 390 }]}>{children}</Text>;
}

/** `.demo-proof-note`: mono 11 in gray-500. */
export function ProofNote({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[styles.proofNote, { color: color.inkMuted }]}>{children}</Text>;
}

/** `.demo-inline-link`: mono 13 vermilion with the 16 px arrow, opening a native screen. */
export function InlineLink({ label, icon: Icon, onPress, flush = false }: { label: string; icon: typeof Code; onPress: () => void; flush?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={[styles.inline, flush ? null : styles.inlineTop]}>
      <Text style={[styles.inlineText, { color: color.accent }]}>{label}</Text>
      <Icon size={16} color={color.accent} />
    </Pressable>
  );
}

/**
 * web `ProofLink` / `ProofCode`: the external-link glyph, the label and the first eight characters of the hash in
 * gray-600. A devnet proof opens on Solana Explorer; a fork proof prints where it ran instead.
 */
export function ProofLink({ label, reference, href, note }: { label: string; reference: string; href: string | null; note?: string }) {
  const { color } = useTheme();
  const Icon = href ? ExternalLink : Code;
  const row = (
    <View style={styles.proofLink}>
      <Icon size={14} color={color.inkSecondary} />
      <Text style={[styles.proofText, styles.proofLabel, { color: color.inkSecondary }]}>{label}</Text>
      <Text style={[styles.proofText, { color: color.inkDisabled }]}>{reference.slice(0, 8)}…</Text>
      {note ? <Text style={[styles.proofText, { color: color.inkDisabled }]}>{note}</Text> : null}
    </View>
  );
  if (!href) return row;
  return (
    <Pressable onPress={() => void openExternal(href)} accessibilityRole="link" accessibilityLabel={`${label}, open on Solana Explorer`}>
      {row}
    </Pressable>
  );
}

/** web's `/demo/*.png` captures, bundled in assets/explore. */
const SHOTS = {
  markets: require("../../../assets/explore/markets.png"),
  reel: require("../../../assets/explore/reel.png"),
  sensei: require("../../../assets/explore/sensei.png"),
} as const;

/** web `Frame`: a dated capture of the running product (`/demo/*.png`), 16 px radius over the frame shadow. */
export function Frame({ shot, alt, phone = false }: { shot: keyof typeof SHOTS; alt: string; phone?: boolean }) {
  const { name, color } = useTheme();
  const t = demoTokens(name);
  return (
    <View style={phone ? styles.phoneFrame : null}>
      <View style={[styles.frameImg, { borderColor: t.hair10, boxShadow: t.frameShadow, aspectRatio: phone ? 780 / 1688 : 2560 / 1600 }]}>
        <Image source={SHOTS[shot]} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={alt} />
      </View>
      <Text style={[styles.caption, { color: color.inkDisabled }]}>{DEMO.frame.caption(DEMO.capturedOn)}</Text>
    </View>
  );
}

/** `.demo-cta` (vermilion pill) and `.demo-cta.ghost` (15 % hairline); `big` is the close's 14×24 / 16 px size. */
export function Cta({ label, onPress, primary = false, big = false, lead: Lead, trail: Trail }: { label: string; onPress: () => void; primary?: boolean; big?: boolean; lead?: typeof Code; trail?: typeof Code }) {
  const { name, color } = useTheme();
  const t = demoTokens(name);
  const ink = primary ? color.onAccent : color.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [
        styles.cta,
        big && styles.ctaBig,
        primary ? { backgroundColor: pressed ? color.accentPressed : color.accent, borderColor: "transparent" } : { borderColor: t.hair15 },
      ]}
    >
      {Lead ? <Lead size={16} color={ink} /> : null}
      <Text style={[styles.ctaText, big && styles.ctaTextBig, { color: ink }]}>{label}</Text>
      {Trail ? <Trail size={16} color={ink} /> : null}
    </Pressable>
  );
}

const MONO = { fontFamily: FONT.dataRegular } as const;

const styles = StyleSheet.create({
  eyebrow: { ...MONO, fontSize: 11, lineHeight: 17.6, letterSpacing: 3.74, textTransform: "uppercase" },
  h1: { fontFamily: FONT.headingHeavy, fontSize: 33, lineHeight: 35, letterSpacing: -0.825, marginTop: 20, marginBottom: 8 },
  h2: { fontFamily: FONT.headingHeavy, fontSize: 27, lineHeight: 30, marginTop: 16 },
  close: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 34, textAlign: "center" },
  serif: { fontFamily: FONT.stamp, fontStyle: "italic", letterSpacing: 0 },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerText: { ...MONO, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24.375, marginTop: 16 },
  proofNote: { ...MONO, fontSize: 11, lineHeight: 17.6, marginTop: 16 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  inlineTop: { marginTop: 24 },
  inlineText: { ...MONO, fontSize: 13, lineHeight: 20.8 },
  proofLink: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  proofText: { ...MONO, fontSize: 12, lineHeight: 19.2 },
  proofLabel: { flexShrink: 1 },
  phoneFrame: { width: "100%", maxWidth: 300, alignSelf: "center" },
  frameImg: { width: "100%", borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  caption: { ...MONO, fontSize: 10, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 10 },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 9999, borderWidth: 1 },
  ctaBig: { paddingVertical: 14, paddingHorizontal: 24 },
  ctaText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  ctaTextBig: { fontSize: 16, lineHeight: 25.6 },
});
