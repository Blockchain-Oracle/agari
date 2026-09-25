import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { dayKey, dayLabel } from "@/features/desk/activity/activity-model";
import { checkRows, groupChecks, type CheckRow } from "@/features/desk/activity/check-groups";
import { ACTIVITY, FILTERS, type ActivityFilter } from "@/features/desk/activity/copy-activity";
import { ago, clock } from "@/features/desk/format";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { EmptyState, haptic } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { TimelineDay, TimelineNode, TONE, type NodeTone } from "../kit";
import { CheckCard, Figures } from "./CheckCard";

const FILTER_TONES: Record<ActivityFilter, readonly NodeTone[] | null> = { all: null, acted: ["acted"], declined: ["declined"], asked: ["asked"], quiet: ["quiet"], problems: ["error", "stopped"] };

function QuietRun({ row, base, nowSec, zone }: { row: Extract<CheckRow, { kind: "quiet" }>; base: string; nowSec: number; zone: string | null }) {
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
        <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{ACTIVITY.quietRun(row.groups.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</Text>
        <SymbolView name={open ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }} size={14} tintColor={color.inkMuted} />
      </Pressable>
      {open
        ? row.groups.flatMap((g) =>
            g.lines.map((l) => (
              <Pressable key={l.record.seq} onPress={() => router.push(`${base}/decision/${l.record.seq}` as Href)} accessibilityRole="button" style={[styles.quietLine, { borderTopColor: color.hairline }]}>
                <Figures text={l.lead} style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]} />
                <Text style={[TYPE.data, { color: color.inkMuted, fontSize: 11 }]}>
                  {clock(g.atSec, zone)} · {ago(g.atSec, nowSec)}
                </Text>
              </Pressable>
            )),
          )
        : null}
    </View>
  );
}

/**
 * The desk's activity (web's activity/ActivityTimeline.tsx, 21st Activity Timeline #28340): each check is one node (a
 * check writes a record per company it looked at): its time, then a card with a line per company, verdict as a badge,
 * the fact in one sentence, reasons folded. Days are headed; runs of quiet checks fold into one node that opens.
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
  const rows: CheckRow[] = useMemo(() => {
    const groups = groupChecks(shown);
    return filter === "all" ? checkRows(groups) : groups.map((group) => ({ kind: "check", group }));
  }, [shown, filter]);

  if (records.length === 0) return <>{empty ?? <EmptyState why={ACTIVITY.emptyTitle} detail={ACTIVITY.emptyBody} />}</>;
  const nodes: ReactNode[] = [];
  let lastDay = "";
  rows.forEach((row, i) => {
    const atSec = row.kind === "check" ? row.group.atSec : row.toSec;
    const key = dayKey(atSec, zone);
    if (key !== lastDay) {
      lastDay = key;
      nodes.push(<TimelineDay key={`day-${key}`}>{dayLabel(atSec, nowSec, zone)}</TimelineDay>);
    }
    const last = i === rows.length - 1;
    nodes.push(
      row.kind === "check" ? (
        <TimelineNode key={row.group.seqs[0]} tone={row.group.tone} index={i} last={last}>
          <CheckCard group={row.group} base={base} nowSec={nowSec} zone={zone} />
        </TimelineNode>
      ) : (
        <TimelineNode key={`q-${row.groups[0]?.seqs[0]}`} tone="quiet" index={i} last={last} icon={{ ios: "moon", android: "bedtime" }}>
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
  quiet: { paddingTop: 4 },
  quietHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  quietLine: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
});
