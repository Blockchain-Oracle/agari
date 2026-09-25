import { router, type Href } from "expo-router";
import { ChevronDown, CircleDashed } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { figureParts, type CheckGroup, type CheckLine } from "@/features/desk/activity/check-groups";
import { ACTIVITY } from "@/features/desk/activity/copy-activity";
import { RECORD } from "@/features/desk/copy-record";
import { ago, clock } from "@/features/desk/format";
import { FONT } from "~/theme";
import { LogoStack, useDeskTheme, type NodeTone } from "../kit";

/** A line's text with its figures set in the data weight, so "29.9%" and "$250" stand out on a scan. */
export function Figures({ text }: { text: string }) {
  return (
    <>
      {figureParts(text).map((p, i) =>
        p.figure ? (
          <Text key={i} style={styles.figure}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** `.act-badge`: the verdict in its tone on its wash. */
export function Badge({ tone, children }: { tone: NodeTone; children: string }) {
  const { color, t } = useDeskTheme();
  const [ink, bg] =
    tone === "acted" ? [color.profit, t.badgeActed]
    : tone === "declined" ? [color.accent, color.accentWash]
    : tone === "asked" ? [color.warning, t.badgeAsked]
    : tone === "error" || tone === "stopped" ? [color.loss, t.badgeLoss]
    : tone === "quiet" ? [color.inkMuted, color.surface2]
    : [color.inkSecondary, color.surface2];
  return <Text style={[styles.badge, { color: ink, backgroundColor: bg }]}>{children}</Text>;
}

/** `.act-tag`: a small hairline chip ("practice", "×2"). */
export function Tag({ children }: { children: string }) {
  const { color } = useDeskTheme();
  return <Text style={[styles.tag, { color: color.inkMuted, borderColor: color.hairline }]}>{children}</Text>;
}

/** `.act-line`: one company's verdict and fact; it opens that record's full decision. */
function Line({ line, base, open }: { line: CheckLine; base: string; open: boolean }) {
  const { color } = useDeskTheme();
  return (
    <Pressable onPress={() => router.push(`${base}/decision/${line.record.seq}` as Href)} accessibilityRole="link" style={({ pressed }) => [styles.line, pressed && { backgroundColor: color.surface2 }]}>
      <View style={styles.mark}>{line.symbol ? <LogoStack symbols={[line.symbol]} size="sm" max={1} /> : <CircleDashed size={16} color={color.inkMuted} />}</View>
      <View style={styles.lineText}>
        <View style={styles.lineTop}>
          <Badge tone={line.tone}>{RECORD.outcome[line.record.outcome]}</Badge>
          {line.repeats > 1 ? <Tag>{ACTIVITY.repeats(line.repeats)}</Tag> : null}
        </View>
        <Text style={[styles.lead, { color: color.ink }]}>
          <Figures text={line.lead} />
        </Text>
        {open && line.rest !== "" ? (
          <Text style={[styles.rest, { color: color.inkSecondary }]}>
            <Figures text={line.rest} />
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * One check as a card (web's activity/CheckCard.tsx, 21st Activity Feed #29394): the time, then a line per company with
 * its verdict and the fact, figures picked out; the reasons stay folded until "Why". `bare` drops the card's frame, as
 * web's `.cp-card > .act-check` does inside the cockpit's Latest check.
 */
export function CheckCard({ group, base, nowSec, zone, bare = false }: { group: CheckGroup; base: string; nowSec: number; zone: string | null; bare?: boolean }) {
  const { color, t } = useDeskTheme();
  const [open, setOpen] = useState(false);
  const why = group.lines.some((l) => l.rest !== "");
  const practice = group.lines.some((l) => l.record.mode === "practice");
  const first = Math.min(...group.seqs);
  const last = Math.max(...group.seqs);
  const border = group.tone === "acted" ? t.checkActed : group.tone === "asked" ? t.checkAsked : color.hairline;
  return (
    <View style={[styles.check, !bare && [styles.framed, { borderColor: border, backgroundColor: color.surface1 }]]}>
      <View style={styles.head}>
        <Text style={[styles.time, { color: color.ink }]}>{clock(group.atSec, zone)}</Text>
        {practice ? <Tag>{RECORD.list.practiceTag}</Tag> : null}
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
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={styles.why}>
          <Text style={[styles.whyText, { color: color.inkSecondary }]}>{open ? ACTIVITY.hideWhy : ACTIVITY.why}</Text>
          <ChevronDown size={16} color={color.inkSecondary} style={open ? styles.flip : undefined} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { fontFamily: FONT.bodyStrong, fontVariant: ["tabular-nums"] },
  badge: { alignSelf: "flex-start", overflow: "hidden", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999, fontFamily: FONT.bodyStrong, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.63, textTransform: "uppercase" },
  tag: { overflow: "hidden", paddingVertical: 1, paddingHorizontal: 7, borderRadius: 9999, borderWidth: 1, fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  check: { gap: 8 },
  framed: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  time: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  meta: { marginLeft: "auto", fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  lines: { gap: 2 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 8, borderRadius: 9 },
  mark: { width: 24, minHeight: 22, alignItems: "center", justifyContent: "center" },
  lineText: { flex: 1, minWidth: 0, gap: 4 },
  lineTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  lead: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19.575 },
  rest: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 },
  why: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginLeft: 34, paddingVertical: 2 },
  whyText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  flip: { transform: [{ rotate: "180deg" }] },
});
