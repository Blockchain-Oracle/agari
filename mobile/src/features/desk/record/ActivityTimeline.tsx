import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { dayKey, dayLabel, namesIn } from "@/features/desk/activity/activity-model";
import { ACTIVITY, FILTERS, type ActivityFilter } from "@/features/desk/activity/copy-activity";
import { RECORD } from "@/features/desk/copy-record";
import { ago, clock } from "@/features/desk/format";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { foldQuietRuns, type RecordRow } from "@/features/desk/record-rows";
import { EmptyState, haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, TimelineDay, TimelineNode, TONE, toneInk, type NodeTone } from "../kit";

const FILTER_TONES: Record<ActivityFilter, readonly NodeTone[] | null> = { all: null, acted: ["acted"], declined: ["declined"], asked: ["asked"], quiet: ["quiet"], problems: ["error", "stopped"] };

function Entry({ record, base, nowSec }: { record: RecordSummaryWire; base: string; nowSec: number }) {
  const { color } = useTheme();
  const tone = TONE[record.outcome];
  const names = namesIn(record.summary);
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(`${base}/decision/${record.seq}` as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${RECORD.outcome[record.outcome]}, #${record.seq}, ${ago(record.decidedAtSec, nowSec)}. ${record.summary}`}
      style={({ pressed }) => [styles.entry, { backgroundColor: pressed ? color.surface2 : color.surface1, borderColor: color.hairline }]}
    >
      <View style={styles.entryHead}>
        <Text style={[TYPE.bodyStrong, { color: toneInk(tone, color) }]}>{RECORD.outcome[record.outcome]}</Text>
        {record.mode === "practice" ? <Text style={[styles.tag, { color: color.accent, borderColor: color.accentDim }]}>{RECORD.list.practiceTag}</Text> : null}
        <Text style={[TYPE.data, styles.meta, { color: color.inkMuted }]}>
          #{record.seq} · {ago(record.decidedAtSec, nowSec)}
        </Text>
      </View>
      <View style={styles.entryBody}>
        {names.length > 0 ? <LogoStack symbols={names} size={18} max={3} /> : null}
        <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{record.summary}</Text>
      </View>
    </Pressable>
  );
}

function QuietRun({ row, base, nowSec, zone }: { row: Extract<RecordRow, { kind: "quiet" }>; base: string; nowSec: number; zone: string | null }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.quiet}>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.quietHead}
      >
        <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{ACTIVITY.quietRun(row.records.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</Text>
        <SymbolView name={open ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }} size={14} tintColor={color.inkMuted} />
      </Pressable>
      {open
        ? row.records.map((r) => (
            <Pressable key={r.seq} onPress={() => router.push(`${base}/decision/${r.seq}` as Href)} accessibilityRole="button" style={[styles.quietLine, { borderTopColor: color.hairline }]}>
              <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{r.summary}</Text>
              <Text style={[TYPE.data, { color: color.inkMuted, fontSize: 11 }]}>
                #{r.seq} · {ago(r.decidedAtSec, nowSec)}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

/**
 * The desk's activity (web's activity/ActivityTimeline.tsx, 21st Activity Timeline #28340): every check a node with
 * its verdict's icon, the companies it named, the reason and its #seq; days headed; quiet runs fold into one node.
 * Shared by the cockpit's Activity tab and the whole record.
 */
export function ActivityTimeline({ records, base, nowSec, zone, empty }: { records: readonly RecordSummaryWire[]; base: string; nowSec: number; zone: string | null; empty?: ReactNode }) {
  const { color } = useTheme();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const counts = useMemo(() => {
    const c: Record<ActivityFilter, number> = { all: records.length, acted: 0, declined: 0, asked: 0, quiet: 0, problems: 0 };
    for (const r of records) {
      const tone = TONE[r.outcome];
      for (const f of FILTERS) if (f !== "all" && FILTER_TONES[f]?.includes(tone)) c[f] += 1;
    }
    return c;
  }, [records]);
  const shown = useMemo(() => {
    const tones = FILTER_TONES[filter];
    return tones ? records.filter((r) => tones.includes(TONE[r.outcome])) : records;
  }, [records, filter]);
  // Quiet runs fold only in the unfiltered view: a "Quiet" filter wants every quiet check as its own node.
  const rows: RecordRow[] = filter === "all" ? foldQuietRuns(shown) : shown.map((record) => ({ kind: "entry", record }));

  if (records.length === 0) return <>{empty ?? <EmptyState why={ACTIVITY.emptyTitle} detail={ACTIVITY.emptyBody} />}</>;
  const nodes: ReactNode[] = [];
  let lastDay = "";
  rows.forEach((row, i) => {
    const atSec = row.kind === "entry" ? row.record.decidedAtSec : row.toSec;
    const key = dayKey(atSec, zone);
    if (key !== lastDay) {
      lastDay = key;
      nodes.push(<TimelineDay key={`day-${key}`}>{dayLabel(atSec, nowSec, zone)}</TimelineDay>);
    }
    const last = i === rows.length - 1;
    nodes.push(
      row.kind === "entry" ? (
        <TimelineNode key={row.record.seq} tone={TONE[row.record.outcome]} index={i} last={last}>
          <Entry record={row.record} base={base} nowSec={nowSec} />
        </TimelineNode>
      ) : (
        <TimelineNode key={`q-${row.records[0]?.seq}`} tone="quiet" index={i} last={last} icon={{ ios: "moon", android: "bedtime" }}>
          <QuietRun row={row} base={base} nowSec={nowSec} zone={zone} />
        </TimelineNode>
      ),
    );
  });
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel={ACTIVITY.filtersAria}>
        {FILTERS.filter((f) => f === "all" || counts[f] > 0).map((f) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => {
                haptic.select();
                setFilter(f);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.filter, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
            >
              <Text style={[TYPE.caption, { color: on ? color.accent : color.ink }]}>{ACTIVITY.filter[f]}</Text>
              <Text style={[TYPE.data, { color: color.inkMuted, fontSize: 11 }]}>{counts[f]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View accessibilityLabel={ACTIVITY.aria}>{nodes}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  grow: { flex: 1 },
  filters: { gap: 8 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1 },
  entry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 6 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tag: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 6, textTransform: "uppercase" },
  meta: { marginLeft: "auto", fontSize: 11.5 },
  entryBody: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  quiet: { paddingTop: 4 },
  quietHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  quietLine: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
});
