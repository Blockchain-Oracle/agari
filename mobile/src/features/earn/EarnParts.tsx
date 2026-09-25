import type { ReserveSheet } from "@agari/core/reserves";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import type { ReserveWords } from "@/features/earn/reserves";
import { FONT } from "~/theme";
import { useEarnParlay } from "./EarnKit";
import { ReservePanel } from "./ReservePanel";

/**
 * web's `features/earn/Hero.tsx` (`.earn-page .page-hero`): "Earn the / <accent>." over the tab's blurb, then the live
 * panel, above the hero's hairline. The hero's 92 px top padding is web's chrome offset (2 px short of it), which
 * the app's chrome already clears, so it starts at the header.
 */
export function EarnHero({ words, sheet, symbol, status }: { words: ReserveWords; sheet: ReserveSheet | null; symbol: string; status?: string }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.hero, { borderBottomColor: t.heroRule }]}>
      <View style={styles.grid}>
        <View>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {EARN.title}
            {"\n"}
            <Text style={{ color: color.accent }}>{words.accent}</Text>.
          </Text>
          <Text style={[styles.blurb, { color: color.inkMuted }]}>{words.blurb}</Text>
        </View>
        <ReservePanel sheet={sheet} symbol={symbol} words={words} status={status} />
      </View>
    </View>
  );
}

/** web's shell `CapabilityPending`'s way out (`CAPABILITY_NEXT` in `components/shell/CapabilityPending.tsx`, a DOM module). */
const CAPABILITY_NEXT = { label: "Make a call on the markets", href: "/markets" } as const;

/**
 * web's `components/shell/CapabilityPending.tsx` (shell.css `.capability-pending`): the eyebrow, the title, the body,
 * what it waits on over a hairline, and the way out.
 */
export function CapabilityPending({ eyebrow, title, dependency, children }: { eyebrow: string; title: string; dependency: string; children: ReactNode }) {
  const { color, name, t } = useEarnParlay();
  return (
    <View style={styles.cp}>
      <Text style={[styles.cpEyebrow, { color: color.accent }]}>{eyebrow}</Text>
      <Text style={[styles.cpTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.cpBody}>{children}</View>
      <Text style={[styles.cpMeta, { color: color.inkMuted, borderTopColor: name === "dark" ? t.sectionRule : color.hairline }]}>Not connected yet · waiting on {dependency}</Text>
      <Pressable onPress={() => router.push(CAPABILITY_NEXT.href)} accessibilityRole="link" hitSlop={8}>
        <Text style={[styles.cpAction, { color: color.accent }]}>{CAPABILITY_NEXT.label} →</Text>
      </Pressable>
    </View>
  );
}

/** A `.cp-body` paragraph. */
export function CpText({ children }: { children: string }) {
  const { color } = useEarnParlay();
  return <Text style={[styles.cpText, { color: color.inkSecondary }]}>{children}</Text>;
}

/** web's `NotDeployed` for the maker vault: CapabilityPending inside the container. */
export function NotDeployed() {
  const { notDeployed } = EARN;
  return (
    <View style={styles.container}>
      <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
        <CpText>{notDeployed.body}</CpText>
        <CpText>{notDeployed.why}</CpText>
      </CapabilityPending>
    </View>
  );
}

/** web's `.ea-paused`: the vermilion-edged note above the cards while new supply is paused. */
export function PausedNote({ body }: { body: string }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.paused, { borderColor: t.pausedBorder, backgroundColor: t.pausedBg }]}>
      <Text style={[styles.pausedTitle, { color: color.accent }]}>{EARN.paused.title}</Text>
      <Text style={[styles.pausedBody, { color: t.pausedBody }]}>{body}</Text>
    </View>
  );
}

/** web's `.ea-msg`: the last write's result, gray-300 with "✓", vermilion otherwise. */
export function Message({ text }: { text: string }) {
  const { color, t } = useEarnParlay();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.msg, { color: text.includes("✓") ? t.gray300 : color.accent }]}>
      {text}
    </Text>
  );
}

/** web's `.pl-slip-empty`: the dashed, mono, uppercase empty card (the vault's §02, the slip's empty states). */
export function SlipEmpty({ text }: { text: string }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.empty, { backgroundColor: t.emptyBg, borderColor: t.emptyBorder }]}>
      <Text style={[styles.emptyText, { color: color.inkDisabled }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 12, borderBottomWidth: 1 },
  grid: { paddingHorizontal: 18, paddingBottom: 14, gap: 20 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 34.5, lineHeight: 34.5, marginVertical: -1.035, letterSpacing: -1.725, paddingTop: 4 },
  blurb: { marginTop: 20, fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  container: { paddingHorizontal: 18 },
  cp: { paddingVertical: 48 },
  cpEyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 1.76, textTransform: "uppercase" },
  cpTitle: { marginTop: 12, fontFamily: FONT.heading, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56 },
  cpBody: { marginTop: 12 },
  cpText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  cpMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, fontFamily: FONT.dataRegular, fontSize: 11 },
  cpAction: { marginTop: 16, fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 1.76, textTransform: "uppercase" },
  paused: { marginBottom: 20, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  pausedTitle: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase" },
  pausedBody: { fontFamily: FONT.body, fontSize: 13, lineHeight: 17.9 },
  msg: { textAlign: "center", marginTop: 0, fontFamily: FONT.dataRegular, fontSize: 12 },
  empty: { padding: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  emptyText: { textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.55, textTransform: "uppercase" },
});
