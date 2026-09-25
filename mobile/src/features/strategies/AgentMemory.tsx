import { formatCadence } from "@agari/core/copy";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { DECISION } from "@/features/strategies/decision-copy";
import { ago } from "@/features/strategies/names";
import type { DecisionWire, StrategyWire } from "@/features/strategies/protocol";
import { DecisionDetail } from "./DecisionDetail";
import { ST, useStrat } from "./ui";

const M = STRATEGIES.drawer.memory;
const H = STRATEGIES.drawer.agentHow;

function MemoryRow({ d, nowMs, onOpen }: { d: DecisionWire; nowMs: number; onOpen: () => void }) {
  const { t, color } = useStrat();
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  const outcomeInk = d.outcome === "won" ? color.accent : d.outcome === "lost" ? t.ink(0.6) : t.ink(0.3);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${DECISION.open}: ${ago(d.decidedAtMs, nowMs)}, ${call}`}
      style={({ pressed }) => [styles.row, { borderTopColor: t.ink(0.06) }, pressed && { backgroundColor: t.ink(0.04) }]}
    >
      <View style={styles.rowTop}>
        <Text numberOfLines={1} style={[ST.mono10, styles.shrink, { color: t.ink(0.4) }]}>
          {ago(d.decidedAtMs, nowMs)}
          {d.intervalSec !== null && ` · ${d.asset ?? "Window"} ${formatCadence(d.intervalSec)}`}
        </Text>
        <View style={styles.rowRight}>
          {d.outcome ? <Text style={[ST.mono10, styles.outcome, { color: outcomeInk }]}>{M.outcome[d.outcome]}</Text> : null}
          <Text style={[ST.mono10, { color: t.vermilion }]}>→</Text>
        </View>
      </View>
      <View style={styles.callLine}>
        <Text style={[ST.mono11, { color: d.gate === "failed" ? t.ink(0.5) : color.ink }]}>{call}</Text>
        <Text style={[ST.mono11, { color: d.gate === "trade" ? color.accent : t.ink(0.5) }]}>→ {ruling}</Text>
      </View>
      <Text numberOfLines={2} style={[ST.textXs, styles.mt4, { color: color.inkSecondary }]}>
        “{d.why}”
      </Text>
      {d.gate !== "trade" ? <Text style={[ST.mono10, styles.mt2, { color: t.ink(0.35) }]}>{d.gateReason}</Text> : null}
    </Pressable>
  );
}

/**
 * web's features/strategies/AgentMemory.tsx: the drawer's "◈ agent memory" — the model by name, then the last
 * Windows it read with the gate's ruling and how each settled. Each row opens that decision in full.
 */
export function AgentMemory({ agent, agentName, storeConnected, decimals, symbol, nowMs }: {
  agent: NonNullable<StrategyWire["agent"]>; agentName: string; storeConnected: boolean; decimals: number; symbol: string; nowMs: number;
}) {
  const { t, color } = useStrat();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = agent.decisions.find((d) => d.marketId === openId) ?? null;
  return (
    <View style={[styles.box, { borderColor: t.vermilionA(0.3) }]}>
      <Text style={[ST.meta, styles.eyebrow, { color: color.accent }]}>{M.eyebrow}</Text>
      <Text style={[ST.drawerBody, { color: t.ink(0.7) }]}>{M.body}</Text>
      <Text numberOfLines={1} style={[ST.mono10, styles.mt6, { color: t.ink(0.4) }]}>
        {agent.model ? H.model(agent.model) : H.noModel}
      </Text>
      {agent.decisions.length === 0 ? (
        <Text style={[ST.mono11, styles.mt8, { color: color.inkMuted }]}>{storeConnected ? M.empty : M.storeOff}</Text>
      ) : (
        <View style={styles.mt8}>
          {agent.decisions.map((d) => (
            <MemoryRow key={d.marketId} d={d} nowMs={nowMs} onOpen={() => setOpenId(d.marketId)} />
          ))}
        </View>
      )}
      <DecisionDetail decision={open} agentName={agentName} decimals={decimals} symbol={symbol} nowMs={nowMs} onClose={() => setOpenId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 },
  eyebrow: { marginBottom: 6, letterSpacing: 1.8 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  row: { paddingVertical: 10, borderTopWidth: 1, borderRadius: 4 },
  rowTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  shrink: { flexShrink: 1 },
  rowRight: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 0 },
  outcome: { textTransform: "uppercase", letterSpacing: 1.2 },
  callLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8, marginTop: 4 },
});
