import type { RunnerHealth } from "@agari/core/strategies";
import type { VaultGrant } from "@agari/core/vault";
import { StyleSheet, Text, View } from "react-native";
import { strategyActivityOf } from "@/features/strategies/activity";
import type { CopyState } from "@/features/strategies/lifecycle";
import { ago } from "@/features/strategies/names";
import { FONT } from "~/theme";
import { Details, useStrat } from "./ui";

/**
 * web's features/strategies/StrategyActivity.tsx (copy-form.css `.copy-runner`): the strategy-wide runner report
 * beside the separate consent label, with the runner's own words folded under "Runner report".
 */
export function StrategyActivity({ state, grant, health, nowMs, style }: {
  state: CopyState;
  grant: VaultGrant | null;
  health: RunnerHealth | null;
  nowMs: number;
  style?: object;
}) {
  const { color } = useStrat();
  const activity = strategyActivityOf({ state, grant, health, nowMs });
  const p = [styles.p, { color: color.inkSecondary }];
  return (
    <View accessibilityLabel="Strategy operation" style={[styles.box, { borderColor: color.hairline, backgroundColor: color.surface2 }, style]}>
      <Text style={[styles.eyebrow, { color: color.inkMuted }]}>The runner · across every subscriber</Text>
      <Text style={[styles.strong, { color: color.ink }]}>Operation · {activity.label}</Text>
      <Text style={p}>{activity.detail}</Text>
      {activity.positions ? <Text style={p}>{activity.positions}</Text> : null}
      <Text style={[p, styles.mt12]}>{activity.heartbeat}</Text>
      {health?.why ? (
        <Details
          style={styles.mt8}
          summaryStyle={[styles.summary, { color: color.ink }]}
          summary={`Runner report${health.lastTickMs !== null ? ` · ${ago(Math.min(health.lastTickMs, nowMs), nowMs)}` : ""}`}
        >
          <Text style={[p, styles.mt8]}>{health.why}</Text>
          <Text style={p}>This report covers the strategy across its subscribers.</Text>
        </Details>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9.5, lineHeight: 15.2, letterSpacing: 1.33, textTransform: "uppercase" },
  strong: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
  p: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  summary: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  mt12: { marginTop: 12 },
  mt8: { marginTop: 8 },
});
