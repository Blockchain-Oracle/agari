import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { STRATEGIES } from "@/features/strategies/copy";
import { strategyIdentity, STRATEGY_MARKETS } from "@/features/strategies/identity";
import type { StrategiesPayload, StrategyWire } from "@/features/strategies/protocol";
import { useDesk } from "@/features/strategies/useDesk";
import { Chips, ConnectGate, EmptyState } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { LiveDesk } from "./LiveDesk";
import { MemoryMarket } from "./MemoryMarket";
import { RecentCopyTrades } from "./RecentCopyTrades";
import { StrategyList } from "./StrategyList";
import type { DeskWrites } from "./useCopySetup";

export const openStrategy = (card: { strategyId: string }) => router.push({ pathname: "/strategies/[id]", params: { id: card.strategyId } });

/**
 * web's StrategiesScreen Catalogue: "Copy a strategy" lists every published strategy; "Your strategies" narrows to the
 * ones this wallet created or copies, with the selected one's live desk above. Recent copy-trades and the Memory
 * Market follow in both.
 */
export function Catalogue({ payload, writes, view, onCreate, refresh }: {
  payload: StrategiesPayload;
  writes: DeskWrites;
  view: "copy" | "yours";
  onCreate: () => void;
  refresh: () => void;
}) {
  const { color } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const desk = useDesk(payload, writes.address, writes.snapshot, selected);
  const nowMs = useChainNowMs();
  const { strategies, fills, decimals, symbol } = payload;
  const own = strategies.filter((s) => s.creator === writes.address || desk.subscriptionOf(s.strategyId) || writes.pending?.strategyId === s.strategyId);
  const visible: StrategyWire[] = view === "yours" ? own : strategies;
  const yourFills = view === "yours" ? fills.filter((f) => f.owner === writes.address) : fills;

  const list = (
    <StrategyList
      strategies={visible}
      subscriptionOf={desk.subscriptionOf}
      decimals={decimals}
      symbol={symbol}
      asset={STRATEGY_MARKETS}
      onOpen={(card) => {
        setSelected(card.strategyId);
        openStrategy(card);
      }}
    />
  );

  return (
    <View style={styles.wrap}>
      {view === "yours" ? (
        <ConnectGate why="Connect the wallet that created or copied them.">
          {own.length > 0 ? (
            <View style={styles.pick}>
              <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Manage a strategy</Text>
              <Chips
                options={own.map((card) => ({ value: card.strategyId, label: `${strategyIdentity(card).name} · #${card.strategyId}` }))}
                value={selected}
                onPick={setSelected}
              />
            </View>
          ) : null}
          {selected ? <LiveDesk payload={payload} desk={desk} nowMs={nowMs} onManage={() => desk.featured && openStrategy(desk.featured)} /> : null}
          {!desk.readable ? (
            <Text style={[TYPE.caption, { color: color.warning }]}>
              Your subscriptions and permissions have not been verified yet. Reconnect your wallet and retry if this continues.
            </Text>
          ) : null}
          {desk.readable && own.length === 0 ? (
            <EmptyState why="No strategies here yet." detail="Publish a strategy, or copy one with this wallet." action={{ label: "Create your first strategy", onPress: onCreate }} />
          ) : (
            list
          )}
        </ConnectGate>
      ) : (
        list
      )}
      <RecentCopyTrades fills={yourFills} strategies={strategies} storeConnected={payload.stores.fills} decimals={decimals} symbol={symbol} nowMs={nowMs} />
      <MemoryMarket
        strategies={strategies}
        subscribed={(id) => desk.subscriptionOf(id)?.active === true}
        decimals={decimals}
        symbol={symbol}
        onSubscribe={openStrategy}
        onSealed={refresh}
      />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{STRATEGIES.disclosure(STRATEGY_MARKETS)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  pick: { gap: 8 },
});
