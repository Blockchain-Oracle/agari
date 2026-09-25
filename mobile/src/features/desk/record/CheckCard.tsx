import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { figureParts, type CheckGroup, type CheckLine } from "@/features/desk/activity/check-groups";
import { ACTIVITY } from "@/features/desk/activity/copy-activity";
import { RECORD } from "@/features/desk/copy-record";
import { ago, clock } from "@/features/desk/format";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, toneInk, toneWash, type NodeTone } from "../kit";

/** A line's text with its figures set in the data face, so "29.9%" and "$250" stand out on a scan (web's `Figures`). */
export function Figures({ text, style }: { text: string; style: object }) {
  return (
    <Text style={style}>
      {figureParts(text).map((p, i) =>
        p.figure ? (
          <Text key={i} style={styles.figure}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

function Line({ line, base, open }: { line: CheckLine; base: string; open: boolean }) {
  const { color } = useTheme();
  const tone = line.tone;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(`${base}/decision/${line.record.seq}` as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${RECORD.outcome[line.record.outcome]}. ${line.lead}`}
      style={({ pressed }) => [styles.line, pressed && { backgroundColor: color.surface2 }]}
    >
      <View style={styles.mark}>
        {line.symbol ? <LogoStack symbols={[line.symbol]} size={20} max={1} /> : <SymbolView name={{ ios: "circle.dashed", android: "radio_button_unchecked" }} size={16} tintColor={color.inkMuted} />}
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={[styles.badge, { color: badgeInk(tone, color), backgroundColor: toneWash(tone, color) }]}>{RECORD.outcome[line.record.outcome]}</Text>
          {line.repeats > 1 ? <Text style={[styles.tag, { color: color.inkMuted, borderColor: color.hairline }]}>{ACTIVITY.repeats(line.repeats)}</Text> : null}
        </View>
        <Figures text={line.lead} style={[styles.lead, { color: color.ink }]} />
        {open && line.rest !== "" ? <Figures text={line.rest} style={[styles.rest, { color: color.inkSecondary }]} /> : null}
      </View>
    </Pressable>
  );
}

function badgeInk(tone: NodeTone, color: ReturnType<typeof useTheme>["color"]): string {
  return tone === "quiet" || tone === "neutral" ? color.inkMuted : toneInk(tone, color);
}

/**
 * One check as a card (web's activity/CheckCard.tsx): the time, then a line per company with its verdict as a badge
 * and the fact in one sentence, figures picked out. The reasons stay folded until "Why" opens them; each line opens
 * its full decision.
 */
export function CheckCard({ group, base, nowSec, zone, bare = false }: { group: CheckGroup; base: string; nowSec: number; zone: string | null; bare?: boolean }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const why = group.lines.some((l) => l.rest !== "");
  const practice = group.lines.some((l) => l.record.mode === "practice");
  const first = Math.min(...group.seqs);
  const last = Math.max(...group.seqs);
  const border = group.tone === "acted" ? color.profit : group.tone === "asked" ? color.warning : color.hairline;
  return (
    <View style={bare ? styles.bare : [styles.card, { backgroundColor: color.surface1, borderColor: border }]}>
      <View style={styles.head}>
        <Text style={[styles.time, { color: color.ink }]}>{clock(group.atSec, zone)}</Text>
        {practice ? <Text style={[styles.tag, { color: color.accent, borderColor: color.accentDim }]}>{RECORD.list.practiceTag}</Text> : null}
        <Text style={[styles.meta, { color: color.inkMuted }]}>
          {ago(group.atSec, nowSec)} · #{first === last ? first : `${first}–${last}`}
        </Text>
      </View>
      <View style={styles.lines}>
        {group.lines.map((l) => (
          <Line key={l.record.seq} line={l} base={base} open={open} />
        ))}
      </View>
      {why ? (
        <Pressable
          onPress={() => {
            haptic.select();
            setOpen((o) => !o);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          style={styles.why}
        >
          <Text style={[TYPE.caption, styles.whyText, { color: color.inkSecondary }]}>{open ? ACTIVITY.hideWhy : ACTIVITY.why}</Text>
          <SymbolView name={open ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }} size={12} tintColor={color.inkSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderWidth: 1, borderRadius: RADIUS.lg },
  bare: { gap: 8 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  time: { fontFamily: FONT.dataStrong, fontSize: 13 },
  meta: { fontFamily: FONT.data, fontSize: 11.5 },
  tag: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 6, textTransform: "uppercase" },
  lines: { gap: 2 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 8, borderRadius: 9 },
  mark: { width: 24, minHeight: 22, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 4 },
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  badge: { fontFamily: FONT.dataStrong, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, overflow: "hidden" },
  lead: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19.5 },
  rest: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 },
  figure: { fontFamily: FONT.dataStrong, fontVariant: ["tabular-nums"] },
  why: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginLeft: 34, paddingVertical: 2 },
  whyText: { fontFamily: FONT.bodyStrong, fontSize: 12 },
});
