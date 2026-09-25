import { nameOf } from "@agari/core/desk";
import { CircleDashed } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { groupChecks } from "@/features/desk/activity/check-groups";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { pct } from "@/features/desk/format";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { brandColor, DkLink, Donut, DT, EmptyState, Panel, useDeskTheme, type Slice } from "../kit";
import { CheckCard } from "../record/CheckCard";
import { LimitGauges } from "./LimitGauges";
import { NeedsYou } from "./NeedsYou";

const O = COCKPIT.overview;

/** The newest check as the activity timeline draws it, and the way to the rest. */
function LatestCheck({ view, base, nowSec, zone }: { view: DeskView; base: string; nowSec: number; zone: string | null }) {
  const group = groupChecks(view.wire.recent.length > 0 ? view.wire.recent : view.wire.latest ? [view.wire.latest] : [])[0];
  if (!group) {
    return (
      <Panel title={O.latest}>
        <EmptyState icon={CircleDashed} title={O.noneYet} body={DESK.page.record.empty} />
      </Panel>
    );
  }
  return (
    <Panel title={O.latest} aside={<DkLink label={COCKPIT.activity.whole} href={`${base}/record`} />}>
      <CheckCard group={group} base={base} nowSec={nowSec} zone={zone} bare />
    </Panel>
  );
}

/** Now against target as two rings (outer: held now, inner: the mandate) and a legend with both figures per name. */
function Allocation({ view }: { view: DeskView }) {
  const { color } = useDeskTheme();
  const cash = color.inkMuted;
  const targets = view.mandate?.targets;
  const nowSlices: Slice[] = view.holdings.map((h) => ({ id: h.symbol, label: h.name, value: h.weightBps, color: brandColor(h.symbol, color) }));
  const heldBps = nowSlices.reduce((s, x) => s + x.value, 0);
  const valued = view.plate.totalE6 !== null && heldBps > 0;
  const cashNowBps = valued ? Math.max(0, 10_000 - heldBps) : 10_000;
  const now: Slice[] = [...(valued ? nowSlices : []), { id: "cash", label: O.cash, value: cashNowBps, color: cash }];
  const target: Slice[] = [...(targets?.tokens.map((t) => ({ id: t.symbol, label: nameOf(t.symbol), value: t.weightBps, color: brandColor(t.symbol, color) })) ?? []), { id: "cash", label: O.cash, value: targets?.cashBps ?? 0, color: cash }];
  const rows = target.map((t) => ({ ...t, now: now.find((n) => n.id === t.id)?.value ?? 0 }));
  return (
    <Panel title={O.allocation}>
      <View style={styles.allocBody}>
        <Donut slices={now} size={176} thickness={18} label={O.ringsAria}>
          <Donut slices={target} size={124} thickness={8} label={O.target}>
            <View style={styles.center}>
              <Text style={[DT.statLabel, { color: color.inkMuted }]}>{O.now}</Text>
              <Text style={[styles.centerSub, { color: color.inkMuted }]}>{O.target}</Text>
            </View>
          </Donut>
        </Donut>
        <View style={styles.legend}>
          <View style={styles.legendHead}>
            <View style={styles.legendName} />
            <Text style={[styles.headText, { color: color.inkMuted }]}>{O.now}</Text>
            <Text style={[styles.headText, { color: color.inkMuted }]}>{O.target}</Text>
          </View>
          {rows.map((r) => (
            <View key={r.id} style={[styles.legendRow, { borderTopColor: color.hairline }]}>
              <View style={styles.legendName}>
                <View style={[styles.swatch, { backgroundColor: r.color }]} />
                <Text style={[styles.legendText, { color: color.ink }]} numberOfLines={1}>{r.label}</Text>
              </View>
              <Text style={[styles.fig, { color: color.ink }]}>{pct(r.now)}</Text>
              <Text style={[styles.fig, { color: color.inkMuted }]}>{pct(r.value)}</Text>
            </View>
          ))}
        </View>
      </View>
    </Panel>
  );
}

/** web's cockpit/OverviewTab.tsx at phone width: one column of Needs you, the latest check, allocation and the limits. */
export function OverviewTab({ view, actions, base, zone, nowSec }: { view: DeskView; actions: DeskActions | null; base: string; zone: string | null; nowSec: number }) {
  return (
    <View style={styles.overview}>
      <NeedsYou view={view} actions={actions} zone={zone} nowSec={nowSec} />
      <LatestCheck view={view} base={base} nowSec={nowSec} zone={zone} />
      <Allocation view={view} />
      <LimitGauges view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { gap: 16 },
  allocBody: { alignItems: "center", gap: 20 },
  center: { alignItems: "center", gap: 1 },
  centerSub: { fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.7 },
  legend: { alignSelf: "stretch", gap: 2 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 7, paddingBottom: 2 },
  headText: { width: 64, textAlign: "right", fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderTopWidth: 1 },
  legendName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  fig: { width: 64, textAlign: "right", fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
});
