import { isOk } from "@agari/core/schemas";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { STRATEGIES } from "@/features/strategies/copy";
import { STRATEGY_MARKETS } from "@/features/strategies/identity";
import type { StrategiesPayload } from "@/features/strategies/protocol";
import { useDesk } from "@/features/strategies/useDesk";
import { FONT } from "~/theme";
import { CopyDrawer } from "./CopyDrawer";
import { LiveDesk } from "./LiveDesk";
import { RecentCopyTrades } from "./RecentCopyTrades";
import { StrategyGrid } from "./StrategyGrid";
import { StrategyPicker } from "./StrategyPicker";
import { ConnectButton, PrimaryButton, ST, useStrat } from "./ui";
import type { DeskWrites } from "./useCopySetup";

/**
 * web StrategiesScreen's `Catalogue`: "Copy a strategy" lists every published strategy; "Your strategies" narrows to
 * this wallet's, with the picker and the selected one's live desk above. Recent copy-trades and the disclosure follow;
 * a card opens the copy drawer. `requested` is web's `?strategy=<id>`.
 */
export function Catalogue({ payload, writes, view, onCreate, requested }: {
  payload: StrategiesPayload;
  writes: DeskWrites;
  view: "copy" | "yours";
  onCreate: () => void;
  requested: string | null;
}) {
  const { t, color } = useStrat();
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const desk = useDesk(payload, writes.address, writes.snapshot, selected);
  const nowMs = useChainNowMs();
  const { strategies, fills, decimals, symbol } = payload;
  const vault = writes.snapshot && isOk(writes.snapshot) ? writes.snapshot.value : null;
  const available = vault?.account.availableBase ?? 0n;
  const own = strategies.filter((s) => s.creator === writes.address || desk.subscriptionOf(s.strategyId) || writes.pending?.strategyId === s.strategyId);
  const visible = view === "yours" ? own : strategies;
  const drawer = strategies.find((s) => s.strategyId === drawerId) ?? null;
  useEffect(() => {
    if (requested && strategies.some((card) => card.strategyId === requested)) {
      setSelected(requested);
      setDrawerId(requested);
    }
    // web reads the query once, on mount; a new deep link remounts with a new `requested`.
  }, [requested]);
  const empty = [styles.empty, { borderColor: t.ink(0.08), backgroundColor: t.ink(0.02) }];
  const warn = [styles.progress, { borderColor: t.vermilion }];

  return (
    <>
      {view === "yours" && !writes.address ? (
        <View style={[empty, styles.mt30]}>
          <Text style={[ST.h2, styles.center, styles.mb12, { color: color.ink }]}>Your strategies, in one place.</Text>
          <Text style={[styles.body, styles.center, styles.mb20, { color: color.inkSecondary }]}>Connect the wallet that created or copied them.</Text>
          <ConnectButton style={styles.selfCenter} />
        </View>
      ) : (
        <>
          {view === "yours" && own.length > 0 ? (
            <StrategyPicker strategies={own} selected={selected} onSelect={setSelected} subscriptionOf={desk.subscriptionOf} wallet={writes.address} pendingId={writes.pending?.strategyId ?? null} />
          ) : null}
          {view === "yours" && selected ? <LiveDesk payload={payload} desk={desk} nowMs={nowMs} onManage={() => desk.featured && setDrawerId(desk.featured.strategyId)} /> : null}
          {writes.pending ? <PrimaryButton label={`Review unfinished copy of #${writes.pending.strategyId} →`} onPress={() => setDrawerId(writes.pending!.strategyId)} style={styles.mt20} /> : null}
          {view === "yours" && !desk.readable ? (
            <Text style={[warn, styles.progressText, { color: color.ink }]}>Your subscriptions and permissions have not been verified yet. Reconnect your wallet and retry if this continues.</Text>
          ) : null}
          {view === "yours" && desk.readable && own.length === 0 ? (
            <View style={[empty, styles.mt30]}>
              <Text style={[ST.h2, styles.center, { color: color.ink }]}>No strategies here yet.</Text>
              <Text style={[styles.body, styles.center, styles.my12, { color: color.inkSecondary }]}>Publish a strategy, or copy one with this wallet.</Text>
              <PrimaryButton label="Create your first strategy →" onPress={onCreate} style={styles.selfCenter} />
            </View>
          ) : null}
          <StrategyGrid
            strategies={visible}
            subscriptionOf={desk.subscriptionOf}
            decimals={decimals}
            symbol={symbol}
            asset={STRATEGY_MARKETS}
            onOpen={(card) => {
              setSelected(card.strategyId);
              setDrawerId(card.strategyId);
            }}
          />
        </>
      )}
      <RecentCopyTrades fills={view === "yours" ? fills.filter((f) => f.owner === writes.address) : fills} strategies={strategies} storeConnected={payload.stores.fills} decimals={decimals} symbol={symbol} nowMs={nowMs} />
      <Text style={[ST.mono10, styles.disclosure, { color: color.inkMuted }]}>{STRATEGIES.disclosure(STRATEGY_MARKETS)}</Text>
      {drawer ? (
        <CopyDrawer
          card={drawer}
          sub={desk.subscriptionOf(drawer.strategyId)}
          grant={vault?.grants.strategy ?? null}
          readable={desk.readable}
          writes={writes}
          availableBase={available}
          decimals={decimals}
          symbol={symbol}
          asset={STRATEGY_MARKETS}
          nowMs={nowMs}
          decisionsStore={payload.stores.decisions}
          onClose={() => setDrawerId(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { borderWidth: 1, padding: 64 },
  mt30: { marginTop: 30 },
  mt20: { marginTop: 20 },
  mb12: { marginBottom: 12 },
  mb20: { marginBottom: 20 },
  my12: { marginVertical: 12 },
  center: { textAlign: "center" },
  selfCenter: { alignSelf: "center" },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  progress: { borderWidth: 1, padding: 15, marginTop: 15 },
  progressText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  disclosure: { marginTop: 32 },
});
