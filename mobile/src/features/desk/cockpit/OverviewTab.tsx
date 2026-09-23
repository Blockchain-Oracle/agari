import { nameOf } from "@agari/core/desk";
import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { namesIn } from "@/features/desk/activity/activity-model";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { ago, pct, stamp } from "@/features/desk/format";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Card } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Donut, LogoStack, Panel, segColor, TONE, TONE_ICON, toneInk, toneWash, type Slice } from "../kit";
import { LimitGauges } from "./LimitGauges";
import { NeedsYou } from "./NeedsYou";

const O = COCKPIT.overview;

/** The newest record as a hero card (web's `LatestDecision`): its verdict and icon, the companies, the reason. */
function LatestDecision({ view, base, nowSec, zone }: { view: DeskView; base: string; nowSec: number; zone: string | null }) {
  const { color } = useTheme();
  const r = view.wire.latest;
  if (!r) {
    return (
      <Panel title={O.latest}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{O.noneYet}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{DESK.page.record.empty}</Text>
      </Panel>
    );
  }
  const tone = TONE[r.outcome];
  const names = namesIn(r.summary);
  return (
    <Card onPress={() => router.push(`${base}/decision/${r.seq}` as Href)} accessibilityLabel={`${O.latest}: ${RECORD.outcome[r.outcome]}. ${r.summary}`}>
      <View style={styles.row}>
        <Text style={[TYPE.labelMicro, styles.grow, { color: color.inkMuted }]}>{O.latest}</Text>
        <Text style={[TYPE.data, { color: color.inkMuted }]}>
          #{r.seq} · {ago(r.decidedAtSec, nowSec)}
        </Text>
      </View>
      <View style={styles.latest}>
        <View style={[styles.icon, { backgroundColor: toneWash(tone, color), borderColor: toneInk(tone, color) }]}>
          <SymbolView name={TONE_ICON[tone] as never} size={18} tintColor={toneInk(tone, color)} weight="semibold" />
        </View>
        <View style={styles.grow}>
          <Text style={[TYPE.bodyStrong, { color: toneInk(tone, color) }]}>
            {RECORD.outcome[r.outcome]}
            {r.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}
          </Text>
          <Text style={[TYPE.body, { color: color.ink }]}>{r.summary}</Text>
        </View>
      </View>
      <View style={styles.row}>
        {names.length > 0 ? <LogoStack symbols={names} size={18} /> : null}
        <Text style={[TYPE.caption, styles.grow, { color: color.inkMuted }]}>{stamp(r.decidedAtSec, zone)}</Text>
        <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{O.open} →</Text>
      </View>
    </Card>
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

/** The Overview tab (web's cockpit/OverviewTab.tsx): what needs you, the latest decision, allocation, limits. */
export function OverviewTab({ view, actions, base, zone, nowSec }: { view: DeskView; actions: DeskActions | null; base: string; zone: string | null; nowSec: number }) {
  return (
    <View style={styles.tab}>
      <NeedsYou view={view} actions={actions} zone={zone} nowSec={nowSec} />
      <LatestDecision view={view} base={base} nowSec={nowSec} zone={zone} />
      <Allocation view={view} />
      <LimitGauges view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
  latest: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  alloc: { alignItems: "center" },
  legend: { gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  fig: { width: 64, textAlign: "right" },
});
