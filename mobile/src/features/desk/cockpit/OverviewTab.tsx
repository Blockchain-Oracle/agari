import { nameOf } from "@agari/core/desk";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { groupChecks } from "@/features/desk/activity/check-groups";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { pct } from "@/features/desk/format";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { TYPE, useTheme } from "~/theme";
import { Donut, Panel, segColor, type Slice } from "../kit";
import { CheckCard } from "../record/CheckCard";
import { LimitGauges } from "./LimitGauges";
import { NeedsYou } from "./NeedsYou";

const O = COCKPIT.overview;

/** The newest check as the activity timeline draws it (web's `LatestCheck`): a line per company, reasons folded. */
function LatestCheck({ view, base, nowSec, zone }: { view: DeskView; base: string; nowSec: number; zone: string | null }) {
  const { color } = useTheme();
  const group = groupChecks(view.wire.recent.length > 0 ? view.wire.recent : view.wire.latest ? [view.wire.latest] : [])[0];
  if (!group) {
    return (
      <Panel title={O.latest}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{O.noneYet}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{DESK.page.record.empty}</Text>
      </Panel>
    );
  }
  return (
    <Panel
      title={O.latest}
      aside={
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push(`${base}/record` as Href)}>
          <Text style={[TYPE.caption, { color: color.accent }]}>{COCKPIT.activity.whole}</Text>
        </Pressable>
      }
    >
      <CheckCard group={group} base={base} nowSec={nowSec} zone={zone} bare />
    </Panel>
  );
}

/** Now against target (web's `Allocation`): outer ring held now, inner ring the mandate, both figures per name. */
function Allocation({ view }: { view: DeskView }) {
  const { color } = useTheme();
  const targets = view.mandate?.targets;
  const cash = color.inkMuted;
  const nowSlices: Slice[] = view.holdings.map((h) => ({ id: h.symbol, label: h.name, value: h.weightBps, color: segColor(h.symbol, color) }));
  const heldBps = nowSlices.reduce((s, x) => s + x.value, 0);
  const valued = view.plate.totalE6 !== null && heldBps > 0;
  const cashNowBps = valued ? Math.max(0, 10_000 - heldBps) : 10_000;
  const now: Slice[] = [...(valued ? nowSlices : []), { id: "cash", label: O.cash, value: cashNowBps, color: cash }];
  const target: Slice[] = [
    ...(targets?.tokens.map((t) => ({ id: t.symbol, label: nameOf(t.symbol), value: t.weightBps, color: segColor(t.symbol, color) })) ?? []),
    { id: "cash", label: O.cash, value: targets?.cashBps ?? 0, color: cash },
  ];
  const rows = target.map((t) => ({ ...t, now: now.find((n) => n.id === t.id)?.value ?? 0 }));
  return (
    <Panel title={O.allocation}>
      <View style={styles.alloc}>
        <Donut slices={now} size={150} thickness={16} label={O.ringsAria}>
          <Donut slices={target} size={104} thickness={7} label={O.target}>
            <Text style={[TYPE.labelMicro, { color: color.ink }]}>{O.now}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{O.target}</Text>
          </Donut>
        </Donut>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <Text style={styles.grow} />
          <Text style={[TYPE.labelMicro, styles.fig, { color: color.inkMuted }]}>{O.now}</Text>
          <Text style={[TYPE.labelMicro, styles.fig, { color: color.inkMuted }]}>{O.target}</Text>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={styles.legendRow} accessible accessibilityLabel={`${r.label}: now ${pct(r.now)}, target ${pct(r.value)}`}>
            <View style={[styles.swatch, { backgroundColor: r.color }]} />
            <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{r.label}</Text>
            <Text style={[TYPE.data, styles.fig, { color: color.ink }]}>{pct(r.now)}</Text>
            <Text style={[TYPE.data, styles.fig, { color: color.inkMuted }]}>{pct(r.value)}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

/** The Overview tab (web's cockpit/OverviewTab.tsx): what needs you, the latest check, allocation, limits. */
export function OverviewTab({ view, actions, base, zone, nowSec }: { view: DeskView; actions: DeskActions | null; base: string; zone: string | null; nowSec: number }) {
  return (
    <View style={styles.tab}>
      <NeedsYou view={view} actions={actions} zone={zone} nowSec={nowSec} />
      <LatestCheck view={view} base={base} nowSec={nowSec} zone={zone} />
      <Allocation view={view} />
      <LimitGauges view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: 14 },
  grow: { flex: 1 },
  alloc: { alignItems: "center" },
  legend: { gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  fig: { width: 64, textAlign: "right" },
});
