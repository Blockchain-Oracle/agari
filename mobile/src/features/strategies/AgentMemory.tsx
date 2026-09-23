import { formatCadence } from "@agari/core/copy";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { ago } from "@/features/strategies/names";
import type { DecisionWire, StrategyWire } from "@/features/strategies/protocol";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";

const M = STRATEGIES.drawer.memory;
const H = STRATEGIES.drawer.agentHow;

/** One Window the agent read: when, its call, the gate's ruling, the Window's own settlement. */
function MemoryRow({ d, nowMs }: { d: DecisionWire; nowMs: number }) {
  const { color } = useTheme();
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  const outcomeInk = d.outcome === "won" ? color.accent : d.outcome === "lost" ? color.inkSecondary : color.inkMuted;
  return (
    <View style={[styles.row, { borderTopColor: color.hairline }]}>
      <View style={styles.rowHead}>
        {d.asset ? <AssetDisc asset={d.asset} size={20} /> : null}
        <Text style={[TYPE.caption, styles.when, { color: color.inkMuted }]} numberOfLines={1}>
          {ago(d.decidedAtMs, nowMs)}
          {d.intervalSec !== null ? ` · ${d.asset ?? "Window"} ${formatCadence(d.intervalSec)}` : ""}
        </Text>
        {d.outcome ? <Text style={[TYPE.labelMicro, { color: outcomeInk }]}>{M.outcome[d.outcome]}</Text> : null}
      </View>
      <Text style={[TYPE.data, { color: d.gate === "failed" ? color.inkMuted : color.ink }]}>
        {call} <Text style={{ color: d.gate === "trade" ? color.accent : color.inkMuted }}>→ {ruling}</Text>
      </Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>“{d.why}”</Text>
      {d.gate !== "trade" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{d.gateReason}</Text> : null}
    </View>
  );
}

/** web's features/strategies/AgentMemory.tsx: the model by name, then the last Windows it read with the gate's ruling. */
export function AgentMemory({ agent, storeConnected, nowMs }: {
  agent: NonNullable<StrategyWire["agent"]>;
  storeConnected: boolean;
  nowMs: number;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.box, { borderColor: color.accentDim }]}>
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{M.eyebrow}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{M.body}</Text>
      <Text style={[TYPE.data, { color: color.inkMuted }]} numberOfLines={1}>
        {agent.model ? H.model(agent.model) : H.noModel}
      </Text>
      {agent.decisions.length === 0 ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{storeConnected ? M.empty : M.storeOff}</Text>
      ) : (
        agent.decisions.map((d) => <MemoryRow key={d.marketId} d={d} nowMs={nowMs} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  when: { flex: 1 },
});
