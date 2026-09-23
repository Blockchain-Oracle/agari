import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme, type Palette } from "~/theme";
import type { Glyph } from "./symbols";

/** web's `hiw-card` tones: plain, mint (the example, the pre-open promise, the CTA) and blue (architecture, the desk). */
export type HiwTone = "plain" | "mint" | "blue";

export function toneInk(tone: HiwTone | "mint" | "blue", color: Palette): string {
  if (tone === "mint") return color.profit;
  if (tone === "blue") return color.info;
  return color.accent;
}

/** web rise.ts: the reference's staggered rise, as a Reanimated entrance (Reduce Motion is honoured by Reanimated). */
export function Rise({ i = 0, children }: { i?: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 80).duration(360)}>{children}</Animated.View>;
}

/** web `hiw-label`: the section heading, an optional glyph before it, blue where web uses `hiw-label-blue`. */
export function SectionLabel({ title, glyph, blue }: { title: string; glyph?: Glyph; blue?: boolean }) {
  const { color } = useTheme();
  const ink = blue ? color.info : color.accent;
  return (
    <View style={styles.label}>
      {glyph ? <SymbolView name={glyph} size={16} tintColor={ink} style={styles.labelGlyph} /> : <View style={[styles.labelSquare, { backgroundColor: ink }]} />}
      <Text style={[styles.labelText, { color: ink }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

/** web `hiw-card`: a plate on a hairline, washed in its tone where web tints it. */
export function HiwCard({ tone = "plain", children }: { tone?: HiwTone; children: ReactNode }) {
  const { color } = useTheme();
  const bg = tone === "mint" ? color.profitWash : color.surface1;
  const border = tone === "mint" ? color.profit : tone === "blue" ? color.info : color.hairline;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>{children}</View>;
}

/** web `hiw-card-head`: the icon well and the card title. */
export function CardHead({ glyph, title, tone = "plain" }: { glyph?: Glyph; title: string; tone?: HiwTone }) {
  const { color } = useTheme();
  const ink = toneInk(tone, color);
  return (
    <View style={styles.head}>
      {glyph ? (
        <View style={[styles.well, { backgroundColor: color.surface2 }]}>
          <SymbolView name={glyph} size={18} tintColor={ink} />
        </View>
      ) : null}
      <Text style={[TYPE.title, styles.headTitle, { color: color.ink }]}>{title}</Text>
    </View>
  );
}

/** web `hiw-fee-title`: a smaller heading inside a card. */
export function FeeTitle({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[TYPE.title, styles.feeTitle, { color: color.ink }]}>{children}</Text>;
}

/** web `hiw-body`. */
export function Body({ children, dim }: { children: ReactNode; dim?: boolean }) {
  const { color } = useTheme();
  return <Text style={[TYPE.body, { color: dim ? color.inkMuted : color.inkSecondary }]}>{children}</Text>;
}

/** web `hiw-example-tag`: the small mono caption (a lane's clock, "Worked example — not a live quote"). */
export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: HiwTone }) {
  const { color } = useTheme();
  return <Text style={[styles.tag, { color: tone === "plain" ? color.inkMuted : toneInk(tone, color) }]}>{children}</Text>;
}

/** web `hiw-params`: a definition list, the word in mono ink and its meaning after a colon. */
export function Definitions({ rows }: { rows: readonly (readonly [string, string])[] }) {
  const { color } = useTheme();
  return (
    <View style={[styles.defs, { borderTopColor: color.hairline }]}>
      {rows.map(([word, meaning]) => (
        <View key={word} style={[styles.def, { borderBottomColor: color.hairline }]}>
          <Text style={[TYPE.data, styles.defWord, { color: color.ink }]}>{word}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{meaning}</Text>
        </View>
      ))}
    </View>
  );
}

export interface StepItem {
  key: string;
  label?: string;
  /** A small tag under the label (the desk's kind of work). */
  tag?: string;
  tagTone?: HiwTone;
  body: string;
}

// 21st: sean0205/vertical-titled-stepper — numbered indicators joined by a rail, completed steps filled.
/**
 * web `hiw-steps` (the settlement process, the pre-open promise, the desk's order) as a vertical stepper: every step's
 * words are always shown; tapping a step walks the rail to it, filling each indicator up to it.
 */
export function VStepper({ steps, tone = "plain" }: { steps: readonly StepItem[]; tone?: HiwTone }) {
  const { color } = useTheme();
  const [active, setActive] = useState(0);
  const ink = toneInk(tone, color);
  return (
    <View>
      {steps.map((step, index) => {
        const done = index <= active;
        const last = index === steps.length - 1;
        return (
          <Pressable
            key={step.key}
            onPress={() => {
              haptic.select();
              setActive(index);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Step ${index + 1}${step.label ? `: ${step.label}` : ""}. ${step.body}`}
            accessibilityState={{ selected: index === active }}
            style={styles.step}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: ink, backgroundColor: done ? ink : color.ground }]}>
                <Text style={[styles.dotText, { color: done ? (tone === "plain" ? color.onAccent : color.ground) : ink }]}>{index + 1}</Text>
              </View>
              {last ? null : <View style={[styles.line, { backgroundColor: index < active ? ink : color.hairline }]} />}
            </View>
            <View style={[styles.stepBody, !last && styles.stepGap]}>
              {step.label ? <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{step.label}</Text> : null}
              {step.tag ? <Tag tone={step.tagTone}>{step.tag}</Tag> : null}
              <Body>{step.body}</Body>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20 },
  labelGlyph: { width: 16, height: 16 },
  labelSquare: { width: 7, height: 7 },
  labelText: { fontFamily: FONT.data, fontSize: 11.5, letterSpacing: 1.8 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  well: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  headTitle: { flexShrink: 1 },
  feeTitle: { fontSize: 16, lineHeight: 21 },
  tag: { fontFamily: FONT.data, fontSize: 11.5, letterSpacing: 0.6 },
  defs: { borderTopWidth: StyleSheet.hairlineWidth },
  def: { paddingVertical: 10, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  defWord: { fontSize: 13 },
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dotText: { fontFamily: FONT.dataStrong, fontSize: 12 },
  line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  stepBody: { flex: 1, gap: 4, paddingTop: 3 },
  stepGap: { paddingBottom: 20 },
});
