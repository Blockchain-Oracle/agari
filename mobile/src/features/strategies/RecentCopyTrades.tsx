import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import { ago } from "@/features/strategies/names";
import type { FillWire, StrategyWire } from "@/features/strategies/protocol";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { ST, useStrat } from "./ui";

const RECENT_LIMIT = 8;

/**
 * web's features/strategies/RecentCopyTrades.tsx at phone width (the copier and ×N columns are `sm:` only): one row
 * per copier and strategy, newest first, each opening its latest transaction.
 */
export function RecentCopyTrades({ fills, strategies, storeConnected, decimals, symbol, nowMs }: {
  fills: FillWire[];
  strategies: StrategyWire[];
  storeConnected: boolean;
  decimals: number;
  symbol: string;
  nowMs: number;
}) {
  const { t, color } = useStrat();
  const strategyOf = useMemo(() => new Map(strategies.map((s) => [s.strategyId, s])), [strategies]);
  const grouped = useMemo(() => {
    const g = new Map<string, { strategyId: string; owner: string; totalBase: bigint; atSec: number; txHash: string }>();
    for (const f of fills) {
      const key = `${f.strategyId}::${f.owner}`;
      const cur = g.get(key);
      if (!cur) g.set(key, { strategyId: f.strategyId, owner: f.owner, totalBase: BigInt(f.cashDeltaBase), atSec: f.atSec, txHash: f.txHash });
      else {
        cur.totalBase += BigInt(f.cashDeltaBase);
        if (f.atSec > cur.atSec) {
          cur.atSec = f.atSec;
          cur.txHash = f.txHash;
        }
      }
    }
    return [...g.values()].sort((a, b) => b.atSec - a.atSec);
  }, [fills]);
  const empty = !storeConnected ? STRATEGIES.recent.storeOff : grouped.length === 0 ? STRATEGIES.recent.empty : null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[ST.rail, { color: t.ink(0.4) }]} accessibilityRole="header">
          {STRATEGIES.recent.title}
        </Text>
        <View style={[styles.rule, { backgroundColor: t.ink(0.1) }]} />
        <Text style={[ST.mono11, { color: t.ink(0.3) }]}>{fills.length}</Text>
      </View>
      <View style={[styles.rows, { borderColor: t.ink(0.08), backgroundColor: color.ground }]}>
        {empty ? (
          <Text style={[styles.empty, { color: t.ink(0.3) }]}>{empty}</Text>
        ) : (
          grouped.slice(0, RECENT_LIMIT).map((row, i) => {
            const { name, seed } = strategyIdentity(strategyOf.get(row.strategyId) ?? { strategyId: row.strategyId, runner: "", metadata: "" });
            return (
              <Pressable
                key={`${row.strategyId}:${row.owner}`}
                accessibilityRole="link"
                onPress={() => void openExternal(txUrl(row.txHash as Signature))}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.ink(0.05) }, pressed && { backgroundColor: t.ink(0.02) }]}
              >
                <AgentPortrait seed={seed} name={name} size="small" />
                <Text numberOfLines={1} style={[styles.name, { color: color.ink }]}>
                  {name}
                </Text>
                <View style={styles.flex} />
                <Text style={[ST.mono12, { color: t.ink(0.7) }]}>{money(row.totalBase, decimals, symbol)}</Text>
                <Text style={[ST.mono11, styles.when, { color: t.ink(0.3) }]}>{ago(row.atSec * 1000, nowMs)}</Text>
                <Text style={[ST.mono11, styles.arrow, { color: color.accent }]}>↗</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 56 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  rule: { height: 1, flex: 1 },
  rows: { borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  name: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8, width: 105, flexShrink: 1 },
  flex: { flex: 1 },
  when: { width: 56, textAlign: "right", flexShrink: 0 },
  arrow: { width: 16, textAlign: "right", flexShrink: 0 },
  empty: { paddingVertical: 32, paddingHorizontal: 20, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 2.2, textTransform: "uppercase" },
});
