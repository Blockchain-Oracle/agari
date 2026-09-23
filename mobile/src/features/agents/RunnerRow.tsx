import type { AgentRow } from "@agari/core/strategies";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AGENTS } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import { ago, shortAddress } from "@/features/strategies/names";
import type { StrategyWire } from "@/features/strategies/protocol";
import { Card, haptic, Pill } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "../strategies/AgentPortrait";
import { openStrategy } from "../strategies/Catalogue";

const D = AGENTS.desk;

/** One runner on web's /agents board: rank, portrait, its strategies, and four figures read off the registry. */
export function RunnerRow({ row, rank, editions, decimals, symbol, nowMs }: {
  row: AgentRow;
  rank: number;
  editions: readonly StrategyWire[];
  decimals: number;
  symbol: string;
  nowMs: number;
}) {
  const { color } = useTheme();
  const top = rank === 1;
  const identity = editions.length === 1 ? strategyIdentity(editions[0]!) : { name: `Runner ${shortAddress(row.runner)}`, seed: `runner:${row.runner}` };
  return (
    <Card tone={top ? "accent" : "plain"}>
      <View style={styles.head}>
        <Text style={[TYPE.dataLg, { color: top ? color.accent : color.inkMuted }]}>{String(rank).padStart(2, "0")}</Text>
        <AgentPortrait seed={identity.seed} name={identity.name} size="row" />
        <View style={styles.who}>
          <Pressable onPress={() => void openExternal(explorerUrl("address", row.runner))} accessibilityRole="link" accessibilityLabel={`${identity.name}, runner on Solana Explorer`} hitSlop={6}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
              {identity.name}
            </Text>
          </Pressable>
          <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
            {D.strategies(row.strategies)} · {D.subscribers(row.subscribers)}
          </Text>
        </View>
        {top ? <Pill label={D.top} tone="accent" /> : null}
      </View>
      <View style={styles.figures}>
        <Figure label={D.entrusted} value={`${money(row.capitalEntrustedBase, decimals)} ${symbol}`} accent />
        <Figure label={D.copyTrades} value={String(row.copyTrades)} />
        <Figure label={D.maxPerTrade} value={money(row.maxStakePerTradeBase, decimals)} />
        <Figure label={D.lastActive} value={ago(row.lastActiveSec * 1000, nowMs)} />
      </View>
      <View style={styles.editions}>
        {editions.map((card) => (
          <Pressable
            key={card.strategyId}
            onPress={() => {
              haptic.tap();
              openStrategy(card);
            }}
            accessibilityRole="link"
            style={styles.edition}
          >
            <Text style={[TYPE.labelMicro, { color: color.accent }]}>{strategyIdentity(card).name} →</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.figure}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TYPE.data, { color: accent ? color.accent : color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  who: { flex: 1, minWidth: 0 },
  figures: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  figure: { flexBasis: "50%", gap: 3, paddingRight: 8 },
  editions: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  edition: { minHeight: 36, justifyContent: "center", paddingRight: 12 },
});
