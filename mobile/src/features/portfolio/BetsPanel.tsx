import { isOk } from "@agari/core/schemas";
import { marketsProvider } from "@agari/markets";
import { keys, useLeverageReserve, useMyLeveragePositions, usePositions, useRestingOrders } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LEVERAGE } from "@/features/leverage/copy";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVaultOpenBets } from "@/features/vault/useVaultOpenBets";
import { PORTFOLIO } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useWalletSession } from "@/lib/wallet-session";
import { useSessionPhrase } from "@/lib/when";
import { Button, EmptyState, ReadingView, Segmented, SectionHeader } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { BetRow } from "./BetRow";
import { BoostRow } from "./BoostRow";
import { HistoryList } from "./HistoryList";
import { Pager, usePage } from "./Pager";
import { RestingRow } from "./RestingRow";
import { VaultBetRow } from "./VaultBetRow";

const PAGE_SIZE = 8;
type Tab = "open" | "resting" | "history";

interface Item {
  key: string;
  node: ReactNode;
}

/**
 * web `BetsPanel` ("02 · Your bets"): one plate, three tabs — Open is every position still running (the wallet's, off
 * the venue's cost basis and mark; the Trading Balance's; the live boosts), Resting is every scheduled call still on
 * the Book or on its way back, History is every settled Window from the fill projection and the boosts that ended.
 * Eight rows a page. An empty Open tab never dead-ends: in session it asks for a call, closed it says what lists next.
 */
export function BetsPanel({ symbol, index, history }: { symbol: string | undefined; index: string; history: HistoryReading }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const phrase = useSessionPhrase();
  const session = useMarketSession();
  const queryClient = useQueryClient();
  const positions = usePositions(address);
  const vaultBets = useVaultOpenBets(address);
  const resting = useRestingOrders(address);
  const reserve = useLeverageReserve();
  const boosts = useMyLeveragePositions(address);
  const [tab, setTab] = useState<Tab>("open");

  const boostDecimals = reserve && isOk(reserve) && reserve.value ? reserve.value.decimals : 6;
  const boostList = boosts && isOk(boosts) ? boosts.value : [];
  const boostItem = (p: (typeof boostList)[number]): Item => ({
    key: `boost:${p.positionId.toString()}`,
    node: <BoostRow position={p} symbol={symbol} decimals={boostDecimals} nowMs={nowMs} />,
  });
  const openItems: Item[] = [
    ...(positions && isOk(positions) ? positions.value.map((p) => ({ key: `wallet:${p.marketId}`, node: <BetRow position={p} symbol={symbol} nowMs={nowMs} /> })) : []),
    ...(vaultBets && isOk(vaultBets) ? vaultBets.value.map((b) => ({ key: `vault:${b.marketId}`, node: <VaultBetRow bet={b} symbol={symbol} nowMs={nowMs} /> })) : []),
    ...boostList.filter((p) => p.status === "live").map(boostItem),
  ];
  const restingViews = resting && isOk(resting) ? resting.value.filter((v) => v.status !== "filled" && v.status !== "cancelled") : [];
  const restingItems: Item[] = restingViews.map((v) => ({ key: `resting:${v.id}`, node: <RestingRow view={v} symbol={symbol} /> }));
  const doneBoosts = boostList.filter((p) => p.status !== "live").map(boostItem);
  const settledCount = history.reading?.ok ? history.reading.value.rounds.length + doneBoosts.length : null;

  const openPager = usePage(openItems, PAGE_SIZE);
  const restingPager = usePage(restingItems, PAGE_SIZE);

  const nothing = (settledCount ?? 0) > 0 ? PORTFOLIO.nothingOpen : PORTFOLIO.noBets;
  const closed = session !== null && !session.open;
  const emptyWhy = closed ? `${nothing} ${SESSION_COPY.portfolio.closed(phrase(session.status, Math.floor(marketsProvider.nowMs() / 1000)))}` : nothing;
  const emptyLabel = closed ? SESSION_COPY.portfolio.seeNext : (settledCount ?? 0) > 0 ? PORTFOLIO.nextCall : PORTFOLIO.firstCall;
  const toMarkets = { label: emptyLabel.charAt(0).toUpperCase() + emptyLabel.slice(1), onPress: () => router.navigate("/markets") };
  const retry = () => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.positions(address) });
  };

  return (
    <View style={styles.section}>
      <SectionHeader index={index} title={PORTFOLIO.betsTitle} />
      <Segmented
        label={PORTFOLIO.betsTitle}
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: PORTFOLIO.tabs.open, count: positions && isOk(positions) ? openItems.length : null },
          { value: "resting", label: "Resting", count: resting && isOk(resting) ? restingItems.length : null },
          { value: "history", label: PORTFOLIO.tabs.history, count: settledCount },
        ]}
      />
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        {tab === "open" ? (
          <ReadingView reading={positions} loading="list" retry={retry}>
            {() =>
              openItems.length === 0 ? (
                <EmptyState why={emptyWhy} action={toMarkets} />
              ) : (
                <>
                  {openPager.slice.map((item) => (
                    <View key={item.key}>{item.node}</View>
                  ))}
                  <Pager pager={openPager} size={PAGE_SIZE} />
                </>
              )
            }
          </ReadingView>
        ) : null}
        {tab === "resting" ? (
          <ReadingView reading={resting} loading="list">
            {() =>
              restingItems.length === 0 ? (
                <EmptyState why="No calls resting on the Book." detail="A call placed before the open rests here until it fills or you cancel it." action={{ label: "Go to Markets", onPress: () => router.navigate("/markets") }} />
              ) : (
                <>
                  {restingPager.slice.map((item) => (
                    <View key={item.key}>{item.node}</View>
                  ))}
                  <Pager pager={restingPager} size={PAGE_SIZE} />
                </>
              )
            }
          </ReadingView>
        ) : null}
        {tab === "history" ? (
          <>
            <HistoryList history={history} symbol={symbol} nowMs={nowMs} />
            {doneBoosts.length > 0 ? (
              <View style={styles.sub}>
                <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{LEVERAGE.bets.history}</Text>
                {doneBoosts.map((item) => (
                  <View key={item.key}>{item.node}</View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <Button label={PORTFOLIO.toMarkets} variant="ghost" size="sm" block={false} trailing="→" onPress={() => router.navigate("/markets")} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  plate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 4 },
  sub: { paddingTop: 14, gap: 4 },
});
