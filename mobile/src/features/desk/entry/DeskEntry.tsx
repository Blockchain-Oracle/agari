import { DEFAULT_LIMITS, DEFAULT_MONEY } from "@agari/core/desk";
import { BASKET_SYMBOLS } from "@agari/core/market";
import { router } from "expo-router";
import { ArrowRight, Ban, Check, CircleDashed, ShieldCheck, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { RECORD } from "@/features/desk/copy-record";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { pct, usd } from "@/features/desk/format";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { T } from "../studio/kit-bits";
import { scaleIn, slideIn } from "../studio/kit-motion";
import { SharedDeskPreview } from "./SharedDeskPreview";

/** The desk its owner shares for anyone to read (web's `SHARED_DESK_ID`, the judges' link). */
export const SHARED_DESK_ID = "49f67e4d-dab7-4eb4-9882-2d2a2e80a511";

/** desk.css `.dk-control.en-cta`: the hero's two pill links. */
function Cta({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const ink = primary ? color.creamInk : color.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.cta, primary ? { backgroundColor: color.accent, borderColor: color.accent } : { borderColor: pressed ? color.ink : color.hairline }]}
    >
      <Text style={[styles.ctaText, { color: ink }]}>{label}</Text>
      {primary ? <ArrowRight size={16} color={ink} /> : null}
    </Pressable>
  );
}

/** entry.css `.en-rule` / `.en-check`: a pill with its icon. */
function Chip({ icon: Icon, tint, text }: { icon: LucideIcon; tint: string; text: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <Icon size={14} color={tint} />
      <Text style={[styles.chipText, { color: color.ink }]}>{text}</Text>
    </View>
  );
}

function BasketsVisual() {
  return (
    <View style={styles.baskets}>
      {BASKET_SYMBOLS.map((s) => (
        <AssetDisc key={s} asset={s} size={40} />
      ))}
    </View>
  );
}

function LimitsVisual() {
  const { color } = useTheme();
  const rules = [ENTRY.limits.perAction(usd(DEFAULT_MONEY.perActionCapE6, 0)), ENTRY.limits.daily(usd(DEFAULT_MONEY.dailyCapE6, 0)), ENTRY.limits.premium(pct(DEFAULT_LIMITS.maxPremiumBps))];
  return (
    <View style={styles.chips}>
      {rules.map((rule) => (
        <Chip key={rule} icon={ShieldCheck} tint={color.accent} text={rule} />
      ))}
    </View>
  );
}

function ChecksVisual() {
  const { color } = useTheme();
  return (
    <View style={styles.chips}>
      <Chip icon={Check} tint={color.profit} text={RECORD.outcome.would_have_acted} />
      <Chip icon={Ban} tint={color.accent} text={RECORD.outcome.declined} />
      <Chip icon={CircleDashed} tint={color.inkMuted} text={RECORD.outcome.nothing_to_do} />
    </View>
  );
}

/** entry.css `.en-step`: a picture, the number, the title and a line. */
function StepCard({ n, title, body, visual, index }: { n: number; title: string; body: string; visual: ReactNode; index: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : slideIn({ distance: 12, duration: 450, delay: 150 + index * 80 })} style={[styles.step, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={[styles.visual, { backgroundColor: color.surface2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {visual}
      </View>
      <Text style={[styles.stepN, { color: color.accent }]}>{String(n).padStart(2, "0")}</Text>
      <Text style={[styles.stepTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.stepBody, { color: color.inkSecondary }]}>{body}</Text>
    </Animated.View>
  );
}

/**
 * web's entry/DeskEntry.tsx: `/desk` before there is a desk — the hero with the way in, a live card of the shared
 * desk, then what a desk does in three pictures (the baskets' marks, the default limits, the record's verdicts).
 */
export function DeskEntry({ sharedId = SHARED_DESK_ID }: { sharedId?: string | null }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const visuals = [<BasketsVisual key="b" />, <LimitsVisual key="l" />, <ChecksVisual key="c" />];
  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Animated.View entering={reduce ? undefined : slideIn({ distance: 10, duration: 500 })} style={styles.copy}>
          <Text style={[T.eyebrow, { color: color.inkMuted }]}>{ENTRY.eyebrow}</Text>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {ENTRY.title}
          </Text>
          <Text style={[styles.body, { color: color.inkSecondary }]}>{ENTRY.body}</Text>
          <View style={styles.ctas}>
            <Cta label={ENTRY.start} primary onPress={() => router.push("/desk/new")} />
            {sharedId ? <Cta label={ENTRY.see} onPress={() => router.push(`/desk/${sharedId}`)} /> : null}
          </View>
          <Text style={[styles.note, { color: color.inkMuted }]}>{ENTRY.noWallet}</Text>
        </Animated.View>
        {sharedId ? (
          <Animated.View entering={reduce ? undefined : scaleIn({ from: 0.97, duration: 550, delay: 100 })}>
            <SharedDeskPreview id={sharedId} />
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.steps} accessibilityLabel={ENTRY.stepsAria}>
        {ENTRY.steps.map((s, i) => (
          <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} visual={visuals[i]} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28 },
  hero: { gap: 24, paddingTop: 12 },
  copy: { gap: 16 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 34, lineHeight: 34.68, letterSpacing: -1.19 },
  body: { fontFamily: FONT.body, fontSize: 17, lineHeight: 26.35 },
  ctas: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 20, borderRadius: 9999, borderWidth: 1 },
  ctaText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  note: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  steps: { gap: 14 },
  step: { gap: 8, padding: 18, borderWidth: 1, borderRadius: 18 },
  visual: { flexDirection: "row", alignItems: "center", minHeight: 96, marginBottom: 6, padding: 14, borderRadius: 12, overflow: "hidden" },
  baskets: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chips: { flex: 1, gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1 },
  chipText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  stepN: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1 },
  stepTitle: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28.8, letterSpacing: -0.18 },
  stepBody: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20.25 },
});
