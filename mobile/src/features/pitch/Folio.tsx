import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { PITCH } from "@/features/pitch/copy";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, RADIUS, TYPE } from "~/theme";
import { LIGHT } from "~/theme/palette";

/**
 * web pitch/primitives.tsx: the folio's typographic furniture. The deck is paper in both themes, as on web (the
 * reference's PAPER and PAPER2), so everything inside a sheet draws from the light palette whatever the app's theme.
 */
export const PAPER = LIGHT;

export type Tone = "ink" | "live" | "verm";

const toneInk = (tone: Tone | "mute" | "faint" | undefined): string => {
  if (tone === "live") return PAPER.profit;
  if (tone === "verm") return PAPER.accent;
  if (tone === "mute") return PAPER.inkSecondary;
  if (tone === "faint") return PAPER.inkMuted;
  return PAPER.ink;
};

/** web `Rise`: one element of a slide's staggered entrance. */
export function Rise({ i = 0, children }: { i?: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(i * 80).duration(420)}>{children}</Animated.View>;
}

/** Registration tick at one corner of the sheet (web `Tick`). */
function Tick({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const place = { tl: { top: 8, left: 8 }, tr: { top: 8, right: 8 }, bl: { bottom: 8, left: 8 }, br: { bottom: 8, right: 8 } }[pos];
  return (
    <View style={[styles.tick, place]} pointerEvents="none">
      <View style={[styles.tickV, { backgroundColor: PAPER.inkMuted }]} />
      <View style={[styles.tickH, { backgroundColor: PAPER.inkMuted }]} />
    </View>
  );
}

/** web `pitch-frame`: the paper sheet a slide sits on — ticks at the corners, the brand at the head, the chain at the foot. */
export function Sheet({ paper, children }: { paper?: 2; children: ReactNode }) {
  return (
    <View style={[styles.sheet, { backgroundColor: paper === 2 ? PAPER.surface3 : PAPER.cream, borderColor: PAPER.creamHairline }]}>
      <Tick pos="tl" />
      <Tick pos="tr" />
      <Tick pos="bl" />
      <Tick pos="br" />
      <View style={styles.brand}>
        <AgariMark width={16} height={16} figure={PAPER.ink} />
        <Text style={[styles.brandName, { color: PAPER.ink }]}>{PITCH.brand}</Text>
      </View>
      {children}
      <Mono tone="faint">{PITCH.builtOn}</Mono>
    </View>
  );
}

/** web `Mono`: mono uppercase, wide tracking. */
export function Mono({ children, tone }: { children: ReactNode; tone?: Tone | "mute" | "faint" }) {
  return <Text style={[styles.mono, { color: toneInk(tone) }]}>{children}</Text>;
}

/** web `Kicker`: a vermilion square and the mono line. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <Rise>
      <View style={styles.kicker}>
        <View style={[styles.kickerSquare, { backgroundColor: PAPER.accent }]} />
        <Mono tone="mute">{children}</Mono>
      </View>
    </Rise>
  );
}

/** web `Emph` (the ticket-perforation stub) inside a headline: the word in vermilion, a dashed rule and an eyelet under it. */
export function H1({ lines, inline = "", emph, after = "." }: { lines: readonly string[]; inline?: string; emph: string; after?: string }) {
  return (
    <Rise i={1}>
      <Text style={[styles.h1, { color: PAPER.ink }]} accessibilityRole="header">
        {lines.map((line) => `${line}\n`).join("")}
        {inline}
        <Text style={[styles.emph, { color: PAPER.accent, textDecorationColor: PAPER.accent }]}>{emph}</Text>
        {after}
      </Text>
    </Rise>
  );
}

export function Lead({ children, i = 2 }: { children: ReactNode; i?: number }) {
  return (
    <Rise i={i}>
      <Text style={[TYPE.body, { color: PAPER.inkSecondary }]}>{children}</Text>
    </Rise>
  );
}

/** web `Pill`: a dot and a mono word on a hairline capsule. */
export function Pills({ items, i = 3 }: { items: readonly (readonly [string, Tone])[]; i?: number }) {
  return (
    <Rise i={i}>
      <View style={styles.pills}>
        {items.map(([label, tone]) => (
          <View key={label} style={[styles.pill, { borderColor: PAPER.creamHairline }]}>
            <View style={[styles.pillDot, { backgroundColor: toneInk(tone) }]} />
            <Mono tone={tone === "ink" ? undefined : tone}>{label}</Mono>
          </View>
        ))}
      </View>
    </Rise>
  );
}

export type SpecRow = readonly [string, ReactNode, boolean?];

/** web `SpecPanel` / `Glance`: a titled rule with a vermilion eyelet, then key · dotted leader · value rows. */
export function SpecPanel({ title, badge, badgeTone = "live", rows, i = 3 }: { title: string; badge?: string; badgeTone?: "live" | "verm"; rows: readonly SpecRow[]; i?: number }) {
  return (
    <Rise i={i}>
      <View style={[styles.panel, { backgroundColor: PAPER.surface3, borderColor: PAPER.creamHairline }]}>
        <View style={styles.panelHead}>
          <Mono>{title}</Mono>
          {badge ? <Mono tone={badgeTone}>{badge}</Mono> : null}
        </View>
        <View style={[styles.rule, { backgroundColor: PAPER.creamHairline }]}>
          <View style={[styles.eyelet, { backgroundColor: PAPER.accent }]} />
        </View>
        {rows.map(([key, value, hl], index) => (
          <View key={index} style={styles.specRow}>
            <Mono tone="faint">{key}</Mono>
            <View style={[styles.leader, { borderColor: PAPER.creamHairline }]} />
            {typeof value === "string" ? (
              <Text style={[styles.specVal, { color: hl ? PAPER.accent : PAPER.ink }]}>{value}</Text>
            ) : (
              value
            )}
          </View>
        ))}
      </View>
    </Rise>
  );
}

/** web `CountUp`: the figure counts up once on arrival; under Reduce Motion it lands at once. */
export function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 1400);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduce]);
  return <>{value.toLocaleString("en-US")}</>;
}

/** web `StatCard`: a large mono figure, a dotted rule, its label and where it came from. */
export function StatCard({ value, label, source, hl, i = 2 }: { value: ReactNode; label: string; source?: string; hl?: boolean; i?: number }) {
  return (
    <Rise i={i}>
      <View style={[styles.stat, { borderColor: PAPER.creamHairline }]}>
        <Text style={[styles.statValue, { color: hl ? PAPER.accent : PAPER.ink }]}>{value}</Text>
        <View style={[styles.leader, styles.statDots, { borderColor: PAPER.creamHairline }]} />
        <Text style={[TYPE.caption, { color: PAPER.ink }]}>{label}</Text>
        {source ? <Mono tone="faint">{source}</Mono> : null}
      </View>
    </Rise>
  );
}

/** web `Tag`: says a visual is a mock, a concept, or not live — never product state. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <View style={[styles.tag, { backgroundColor: PAPER.ink }]}>
      <Text style={[styles.tagText, { color: PAPER.cream }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 20, paddingTop: 18, gap: 16 },
  tick: { position: "absolute", width: 10, height: 10 },
  tickV: { position: "absolute", left: 4.5, top: 0, width: 1, height: 10 },
  tickH: { position: "absolute", top: 4.5, left: 0, width: 10, height: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandName: { fontFamily: FONT.heading, fontSize: 15, letterSpacing: -0.2 },
  mono: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase" },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerSquare: { width: 7, height: 7 },
  h1: { fontFamily: FONT.heading, fontSize: 31, lineHeight: 36, letterSpacing: -0.8 },
  emph: { textDecorationLine: "underline", textDecorationStyle: "dashed" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  panel: { borderRadius: RADIUS.md, borderWidth: 1, padding: 14, gap: 10 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  rule: { height: 1, justifyContent: "center" },
  eyelet: { width: 6, height: 6, borderRadius: 3, marginLeft: -1 },
  specRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  leader: { flex: 1, borderBottomWidth: 1, borderStyle: "dotted", minWidth: 12 },
  specVal: { fontFamily: FONT.bodyStrong, fontSize: 13.5, flexShrink: 1, textAlign: "right", maxWidth: "62%" },
  stat: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, gap: 8 },
  statValue: { fontFamily: FONT.dataStrong, fontSize: 38, lineHeight: 42, letterSpacing: -0.6 },
  statDots: { flex: 0 },
  tag: { alignSelf: "flex-start", borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3 },
  tagText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1.2 },
});
