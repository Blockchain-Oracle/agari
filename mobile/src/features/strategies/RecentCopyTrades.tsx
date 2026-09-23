import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import { ago, shortAddress } from "@/features/strategies/names";
import type { FillWire, StrategyWire } from "@/features/strategies/protocol";
import { EmptyState, haptic, SectionHeader } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { Glyph } from "./Glyph";

const RECENT_LIMIT = 8;

interface Group {
  strategyId: string;
  owner: string;
  count: number;
  totalBase: bigint;
  atSec: number;
  txHash: string;
}

/** Collapsed by copier and strategy, so one person's repeats read "copied ×N · total" (web's grouping). */
function grouped(fills: readonly FillWire[]): Group[] {
  const groups = new Map<string, Group>();
  for (const f of fills) {
    const key = `${f.strategyId}::${f.owner}`;
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, { strategyId: f.strategyId, owner: f.owner, count: 1, totalBase: BigInt(f.cashDeltaBase), atSec: f.atSec, txHash: f.txHash });
      continue;
    }
    cur.count += 1;
    cur.totalBase += BigInt(f.cashDeltaBase);
    if (f.atSec > cur.atSec) {
      cur.atSec = f.atSec;
      cur.txHash = f.txHash;
    }
  }
  return [...groups.values()].sort((a, b) => b.atSec - a.atSec);
}

/** web's features/strategies/RecentCopyTrades.tsx: the latest confirmed copy-trades, each opening its transaction. */
export function RecentCopyTrades({ fills, strategies, storeConnected, decimals, symbol, nowMs }: {
  fills: readonly FillWire[];
  strategies: readonly StrategyWire[];
  storeConnected: boolean;
  decimals: number;
  symbol: string;
  nowMs: number;
}) {
  const { color } = useTheme();
  const byId = useMemo(() => new Map(strategies.map((s) => [s.strategyId, s])), [strategies]);
  const rows = useMemo(() => grouped(fills), [fills]);
  return (
    <View style={styles.wrap}>
      <SectionHeader title={STRATEGIES.recent.title} aside={String(fills.length)} />
      {!storeConnected ? (
        <EmptyState why={STRATEGIES.recent.storeOff} />
      ) : rows.length === 0 ? (
        <EmptyState why={STRATEGIES.recent.empty} />
      ) : (
        <View style={[styles.list, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
          {rows.slice(0, RECENT_LIMIT).map((t, i) => {
            const { name, seed } = strategyIdentity(byId.get(t.strategyId) ?? { strategyId: t.strategyId, runner: "", metadata: "" });
            return (
              <Pressable
                key={`${t.strategyId}:${t.owner}`}
                onPress={() => {
                  haptic.tap();
                  void openExternal(explorerUrl("tx", t.txHash));
                }}
                accessibilityRole="link"
                accessibilityLabel={`${name}, ${shortAddress(t.owner)}, ${money(t.totalBase, decimals, symbol)}, ${ago(t.atSec * 1000, nowMs)}. Opens the transaction.`}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline }, pressed && { backgroundColor: color.surface2 }]}
              >
                <AgentPortrait seed={seed} name={name} size="small" />
                <View style={styles.who}>
                  <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
                    {shortAddress(t.owner)}
                    {t.count > 1 ? ` · ${STRATEGIES.recent.copied(t.count)}` : ""}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[TYPE.data, { color: color.ink }]}>{money(t.totalBase, decimals, symbol)}</Text>
                  <View style={styles.when}>
                    <Text style={[TYPE.caption, { color: color.inkMuted }]}>{ago(t.atSec * 1000, nowMs)}</Text>
                    <Glyph name="external" size={11} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  list: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 56, paddingVertical: 8 },
  who: { flex: 1, minWidth: 0 },
  right: { alignItems: "flex-end" },
  when: { flexDirection: "row", alignItems: "center", gap: 4 },
});
