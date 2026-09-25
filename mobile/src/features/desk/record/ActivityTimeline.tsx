import { router, type Href } from "expo-router";
import { ChevronDown, CircleDashed, Moon } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { dayKey, dayLabel } from "@/features/desk/activity/activity-model";
import { checkRows, groupChecks, TONE, type CheckRow } from "@/features/desk/activity/check-groups";
import { ACTIVITY, FILTERS, type ActivityFilter } from "@/features/desk/activity/copy-activity";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, clock } from "@/features/desk/format";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { FONT } from "~/theme";
import { DkLink, EmptyState, Panel, Timeline, TimelineDay, TimelineNode, useDeskTheme, type NodeTone } from "../kit";
import { CheckCard, Figures } from "./CheckCard";

const FILTER_TONES: Record<ActivityFilter, readonly NodeTone[] | null> = { all: null, acted: ["acted"], declined: ["declined"], asked: ["asked"], quiet: ["quiet"], problems: ["error", "stopped"] };

/** A run of quiet checks folded into one dashed line that opens onto each one. */
function QuietRun({ row, base, nowSec, zone, index }: { row: Extract<CheckRow, { kind: "quiet" }>; base: string; nowSec: number; zone: string | null; index: number }) {
  const { color } = useDeskTheme();
  const [open, setOpen] = useState(false);
  return (
    <TimelineNode icon={Moon} tone="quiet" index={index}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[styles.quiet, { borderColor: color.hairline }]}>
        <Text style={[styles.quietText, { color: color.inkSecondary }]}>{ACTIVITY.quietRun(row.groups.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</Text>
        <ChevronDown size={16} color={color.inkSecondary} style={open ? styles.flip : undefined} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(250)} style={styles.quietList}>
          {row.groups.flatMap((g) =>
            g.lines.map((l) => (
              <Pressable key={l.record.seq} onPress={() => router.push(`${base}/decision/${l.record.seq}` as Href)} accessibilityRole="link" style={({ pressed }) => [styles.quietLine, pressed && { backgroundColor: color.surface2 }]}>
                <Text style={[styles.quietLineText, { color: color.inkSecondary }]}>
                  <Figures text={l.lead} />
                </Text>
                <Text style={[styles.meta, { color: color.inkMuted }]}>
                  {clock(g.atSec, zone)} · {ago(g.atSec, nowSec)}
                </Text>
              </Pressable>
            )),
          )}
        </Animated.View>
      ) : null}
    </TimelineNode>
  );
}

export interface ActivityTimelineProps {
  records: readonly RecordSummaryWire[];
  base: string;
  nowSec: number;
  zone: string | null;
  /** Show the filter chips (the whole record and the Activity tab both do). */
  filters?: boolean;
  empty?: ReactNode;
}

/**
 * The desk's activity (web's activity/ActivityTimeline.tsx, 21st Interactive Timeline #28276 + Agent Activity #29318):
 * the filter chips, then each check as a node on the rail under its day, a card per check; runs of quiet checks fold.
 * Shared by the cockpit's Activity tab and `/record`.
 */
export function ActivityTimeline({ records, base, nowSec, zone, filters = true, empty }: ActivityTimelineProps) {
  const { color } = useDeskTheme();
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

  if (records.length === 0) return <>{empty ?? <EmptyState icon={CircleDashed} title={ACTIVITY.emptyTitle} body={ACTIVITY.emptyBody} />}</>;
  let lastDay = "";
  return (
    <View style={styles.act}>
      {filters ? (
        <View style={styles.filters} accessibilityLabel={ACTIVITY.filtersAria}>
          {FILTERS.filter((f) => f === "all" || counts[f] > 0).map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.filter, on ? { borderColor: color.accent, backgroundColor: color.accentWash } : { borderColor: color.hairline }]}
              >
                <Text style={[styles.filterText, { color: on ? color.ink : color.inkSecondary }]}>{ACTIVITY.filter[f]}</Text>
                <Text style={[styles.count, { color: color.inkMuted }]}>{counts[f]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Timeline label={ACTIVITY.aria}>
        {rows.flatMap((row, i) => {
          const atSec = row.kind === "check" ? row.group.atSec : row.toSec;
          const key = dayKey(atSec, zone);
          const nodes: ReactNode[] = [];
          if (key !== lastDay) {
            lastDay = key;
            nodes.push(<TimelineDay key={`day-${key}`}>{dayLabel(atSec, nowSec, zone)}</TimelineDay>);
          }
          nodes.push(
            row.kind === "check" ? (
              <TimelineNode key={row.group.seqs[0]} tone={row.group.tone} index={i}>
                <CheckCard group={row.group} base={base} nowSec={nowSec} zone={zone} />
              </TimelineNode>
            ) : (
              <QuietRun key={`q-${row.groups[0]?.seqs[0]}`} row={row} base={base} nowSec={nowSec} zone={zone} index={i} />
            ),
          );
          return nodes;
        })}
      </Timeline>
    </View>
  );
}

/** web's RecordPanel.tsx `ActivityTab`: the latest checks on the timeline in a panel, and the way to the whole record. */
export function ActivityTab({ records, base, nowSec, zone }: { records: readonly RecordSummaryWire[]; base: string; nowSec: number; zone: string | null }) {
  return (
    <Panel title={DESK.page.record.title} aside={<DkLink label={COCKPIT.activity.whole} href={`${base}/record`} />}>
      <ActivityTimeline records={records} base={base} nowSec={nowSec} zone={zone} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  act: { gap: 12 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingLeft: 12, paddingRight: 10, borderRadius: 9999, borderWidth: 1 },
  filterText: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20 },
  count: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  quiet: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderStyle: "dashed", borderRadius: 12 },
  quietText: { flex: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  flip: { transform: [{ rotate: "180deg" }] },
  quietList: { gap: 2, marginTop: 6 },
  quietLine: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  quietLineText: { flex: 1, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  meta: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
});
