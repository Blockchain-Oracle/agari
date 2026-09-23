import { DEFAULT_LIMITS, DEFAULT_MONEY } from "@agari/core/desk";
import { BASKET_SYMBOLS } from "@agari/core/market";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { RECORD } from "@/features/desk/copy-record";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { pct, usd } from "@/features/desk/format";
import { Button } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Eyebrow, TONE_ICON, toneInk, type NodeTone } from "../kit";
import { SharedDeskPreview } from "./SharedDeskPreview";

/** The desk its owner shares for anyone to read (web's `SHARED_DESK_ID`, the judges' link). */
export const SHARED_DESK_ID = "49f67e4d-dab7-4eb4-9882-2d2a2e80a511";

function StepCard({ n, title, body, visual, index }: { n: number; title: string; body: string; visual: ReactNode; index: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(450).delay(150 + index * 80)}
      style={[styles.step, { backgroundColor: color.surface1, borderColor: color.hairline }]}
    >
      <View style={styles.visual}>{visual}</View>
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{String(n).padStart(2, "0")}</Text>
      <Text style={[TYPE.title, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{body}</Text>
    </Animated.View>
  );
}

function BasketsVisual() {
  return (
    <View style={styles.discs}>
      {BASKET_SYMBOLS.map((s) => (
        <AssetDisc key={s} asset={s} size={34} />
      ))}
    </View>
  );
}

function LimitsVisual() {
  const { color } = useTheme();
  const rules = [ENTRY.limits.perAction(usd(DEFAULT_MONEY.perActionCapE6, 0)), ENTRY.limits.daily(usd(DEFAULT_MONEY.dailyCapE6, 0)), ENTRY.limits.premium(pct(DEFAULT_LIMITS.maxPremiumBps))];
  return (
    <View style={styles.rules}>
      {rules.map((rule) => (
        <View key={rule} style={[styles.rule, { borderColor: color.hairline }]}>
          <SymbolView name={{ ios: "checkmark.shield", android: "verified_user" }} size={14} tintColor={color.profit} />
          <Text style={[TYPE.data, { color: color.ink }]}>{rule}</Text>
        </View>
      ))}
    </View>
  );
}

function ChecksVisual() {
  const { color } = useTheme();
  const checks: Array<[NodeTone, string]> = [
    ["acted", RECORD.outcome.would_have_acted],
    ["declined", RECORD.outcome.declined],
    ["quiet", RECORD.outcome.nothing_to_do],
  ];
  return (
    <View style={styles.rules}>
      {checks.map(([tone, text]) => (
        <View key={text} style={styles.check}>
          <SymbolView name={TONE_ICON[tone] as never} size={14} tintColor={toneInk(tone, color)} />
          <Text style={[TYPE.caption, { color: toneInk(tone, color) }]}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * `/desk` before there is a desk (web/src/features/desk/entry/DeskEntry.tsx): what a desk does in three pictures,
 * a live card of the shared desk, and the way into the studio.
 */
export function DeskEntry() {
  const { color } = useTheme();
  const visuals = [<BasketsVisual key="b" />, <LimitsVisual key="l" />, <ChecksVisual key="c" />];
  return (
    <>
      <View style={styles.hero}>
        <Eyebrow text={ENTRY.eyebrow} />
        <Text style={[TYPE.headline, styles.title, { color: color.ink }]} accessibilityRole="header">
          {ENTRY.title}
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ENTRY.body}</Text>
        <Button label={ENTRY.start} size="lg" trailing="→" onPress={() => router.push("/desk/new")} />
        <Button label={ENTRY.see} variant="outline" onPress={() => router.push(`/desk/${SHARED_DESK_ID}`)} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{ENTRY.noWallet}</Text>
      </View>
      <SharedDeskPreview id={SHARED_DESK_ID} />
      <View accessibilityLabel={ENTRY.stepsAria} style={styles.steps}>
        {ENTRY.steps.map((s, i) => (
          <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} visual={visuals[i]} index={i} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 12 },
  title: { fontSize: 28, lineHeight: 33 },
  steps: { gap: 12 },
  step: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  visual: { minHeight: 44, justifyContent: "center", marginBottom: 6 },
  discs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rules: { gap: 6 },
  rule: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  check: { flexDirection: "row", alignItems: "center", gap: 8 },
});
