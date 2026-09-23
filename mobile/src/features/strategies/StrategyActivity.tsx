import type { RunnerHealth } from "@agari/core/strategies";
import type { VaultGrant } from "@agari/core/vault";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { strategyActivityOf } from "@/features/strategies/activity";
import type { CopyState } from "@/features/strategies/lifecycle";
import { ago } from "@/features/strategies/names";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's features/strategies/StrategyActivity.tsx: the runner's strategy-wide report (resting when the market is
 * closed, watching, held, filled) beside this wallet's own constraint, with the runner's words on request.
 */
export function StrategyActivity({ state, grant, health, nowMs }: {
  state: CopyState;
  grant: VaultGrant | null;
  health: RunnerHealth | null;
  nowMs: number;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const activity = strategyActivityOf({ state, grant, health, nowMs });
  const resting = activity.label === "Resting";
  return (
    <View
      accessibilityLabel="Strategy operation"
      style={[styles.box, { borderColor: resting ? color.accentDim : color.hairline, backgroundColor: color.surface1 }]}
    >
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>The runner · across every subscriber</Text>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Operation · {activity.label}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{activity.detail}</Text>
      {activity.positions ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{activity.positions}</Text> : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{activity.heartbeat}</Text>
      {health?.why ? (
        <>
          <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={10} style={styles.toggle}>
            <Text style={[TYPE.caption, { color: color.accent }]}>
              {open ? "Hide" : "Show"} runner report
              {health.lastTickMs !== null ? ` · ${ago(Math.min(health.lastTickMs, nowMs), nowMs)}` : ""}
            </Text>
          </Pressable>
          {open ? (
            <View style={styles.report}>
              <Text style={[TYPE.data, { color: color.inkSecondary }]} selectable>
                {health.why}
              </Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>This report covers the strategy across its subscribers.</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  toggle: { minHeight: 32, justifyContent: "center" },
  report: { gap: 6 },
});
