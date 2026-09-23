import { describeTargets, nameOf } from "@agari/core/desk";
import { router } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { limitSentences } from "@/features/desk/draft";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, Panel, PartitionBar, segColor } from "../kit";
import { basketOf } from "./CockpitHeader";

const R = COCKPIT.rules;
/** `limitSentences` returns the seven rules in a fixed order: wander, one company, one action, a day, premium, loss, ask. */
const RULE_ICONS: readonly SymbolViewProps["name"][] = [
  { ios: "water.waves", android: "waves" },
  { ios: "chart.pie", android: "pie_chart" },
  { ios: "dollarsign.circle", android: "paid" },
  { ios: "calendar.badge.clock", android: "calendar_clock" },
  { ios: "chart.line.uptrend.xyaxis", android: "trending_up" },
  { ios: "exclamationmark.shield", android: "gpp_maybe" },
  { ios: "hand.raised", android: "front_hand" },
];

/** The Rules tab (web's MandatePanel.tsx `RulesTab`): the basket, each limit with who enforces it, notes, the promise. */
export function RulesTab({ view }: { view: DeskView }) {
  const { color } = useTheme();
  const M = DESK.page.mandate;
  const m = view.mandate;
  const b = basketOf(view);
  return (
    <View style={styles.tab}>
      {m ? (
        <Panel title={R.basket} aside={M.version(view.wire.mandate?.version ?? 1)}>
          <View style={styles.basket}>
            <LogoStack symbols={b.members} size={30} max={5} names={b.members.map((s) => nameOf(s as never))} />
            <View style={styles.grow}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{b.name}</Text>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{describeTargets(m.targets)}</Text>
            </View>
          </View>
          <PartitionBar
            label={describeTargets(m.targets)}
            height={10}
            slices={[
              ...m.targets.tokens.map((t) => ({ id: t.symbol, label: nameOf(t.symbol), value: t.weightBps, color: segColor(t.symbol, color) })),
              { id: "cash", label: COCKPIT.overview.cash, value: m.targets.cashBps, color: color.inkMuted },
            ]}
          />
        </Panel>
      ) : null}
      {m
        ? limitSentences(m).map((s, i) => {
            const program = s.by === "program";
            return (
              <View key={s.text} style={[styles.rule, { backgroundColor: color.surface1, borderColor: program ? color.accentDim : color.hairline }]}>
                <SymbolView name={RULE_ICONS[i] ?? RULE_ICONS[0]!} size={18} tintColor={color.inkSecondary} />
                <View style={styles.ruleText}>
                  <Text style={[TYPE.body, { color: color.ink }]}>{s.text}</Text>
                  <View style={[styles.badge, { backgroundColor: program ? color.accentWash : color.surface2 }]}>
                    <SymbolView name={program ? { ios: "checkmark.shield", android: "verified_user" } : { ios: "cpu", android: "memory" }} size={11} tintColor={program ? color.accent : color.inkSecondary} />
                    <Text style={[TYPE.caption, styles.badgeText, { color: program ? color.accent : color.inkSecondary }]}>{program ? R.program : R.code}</Text>
                  </View>
                </View>
              </View>
            );
          })
        : null}
      {m && view.isOwner ? (
        <Panel title={M.notes}>
          <Text style={[TYPE.body, { color: m.notes ? color.ink : color.inkMuted }]}>{m.notes || M.noNotes}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{M.editNote}</Text>
          <Button label={R.edit} variant="outline" icon={{ ios: "pencil", android: "edit" }} onPress={() => router.push("/desk/new?edit=1")} />
        </Panel>
      ) : null}
      <Panel title={DESK.promise.title}>
        {DESK.promise.points.map((point) => (
          <View key={point} style={styles.point}>
            <SymbolView name={{ ios: "checkmark.shield", android: "verified_user" }} size={15} tintColor={color.profit} />
            <Text style={[TYPE.body, styles.grow, { color: color.ink }]}>{point}</Text>
          </View>
        ))}
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.promise.worstCase}</Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: 10 },
  grow: { flex: 1 },
  basket: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12 },
  ruleText: { flex: 1, gap: 6, alignItems: "flex-start" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11 },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
