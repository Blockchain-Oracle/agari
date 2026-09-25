import { isOk } from "@agari/core/schemas";
import { marketsProvider } from "@agari/markets";
import { keys, useLeverageReserve, useMyLeveragePositions, usePositions, useRestingOrders } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEVERAGE, useLeverageWrites } from "@/features/leverage";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVaultOpenBets } from "@/features/vault/useVaultOpenBets";
import { PORTFOLIO } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { usePager } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { useSessionPhrase } from "@/lib/when";
import { Pager, ReadingBoundary, SectionHeader } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { BetRow } from "./bets/BetRow";
import { BoostRow } from "./bets/BoostRow";
import { HistoryRows } from "./bets/HistoryRows";
import { RestingRow } from "./bets/RestingRow";
import { VaultBetRow } from "./bets/VaultBetRow";

const PAGE_SIZE = 8;
type Tab = "open" | "history";
type Item = { key: string; render: (first: boolean) => ReactNode };

/** history.css `.bets-tab`: 10 px mono caps in a hairline pill, the chosen one on surface-2. */
function TabButton({ tab, current, count, label, onPick }: { tab: Tab; current: Tab; count: number | null; label: string; onPick: (tab: Tab) => void }) {
  const { color } = useTheme();
  const on = tab === current;
  return (
    <Pressable onPress={() => onPick(tab)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && { backgroundColor: color.surface2 }]}>
      <Text style={[styles.tabText, { color: on ? color.ink : color.inkMuted }]}>{label}</Text>
      {count !== null ? <Text style={[styles.tabText, styles.count, { color: color.inkMuted }]}>{count}</Text> : null}
    </Pressable>
  );
}

/**
 * web `BetsPanel` ("02 · Your bets"): one bordered plate, two tabs. Open is every call still running — the scheduled
 * calls first (D-088), then the wallet's positions, the Trading Balance's, the live boosts; History is every settled
 * Window, then the boosts that ended. Eight rows a page; an empty Open tab never dead-ends (D-086).
 */
export function BetsPanel({ symbol, index, history }: { symbol: string | undefined; index: string; history: HistoryReading }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const phrase = useSessionPhrase();
  const session = useMarketSession();
  const queryClient = useQueryClient();
  const reading = usePositions(address);
  const vault = useVaultOpenBets(address);
  const resting = useRestingOrders(address);
  const reserve = useLeverageReserve();
  const boosts = useMyLeveragePositions(address);
  const writes = useLeverageWrites();
  const [tab, setTab] = useState<Tab>("open");

  const boostDecimals = reserve && isOk(reserve) && reserve.value ? reserve.value.decimals : 6;
  const boostList = boosts && isOk(boosts) ? boosts.value : [];
  const boostItem = (p: (typeof boostList)[number]): Item => ({
    key: `boost:${p.positionId.toString()}`,
    render: (first) => <BoostRow position={p} symbol={symbol} decimals={boostDecimals} nowMs={nowMs} writes={writes} first={first} />,
  });
  const restingItems: Item[] =
    resting && isOk(resting)
      ? resting.value.filter((v) => v.status !== "filled" && v.status !== "cancelled").map((v) => ({ key: `resting:${v.id}`, render: (first) => <RestingRow view={v} symbol={symbol} first={first} /> }))
      : [];
  const positionItems: Item[] =
    reading && isOk(reading) ? reading.value.map((p) => ({ key: `wallet:${p.marketId}`, render: (first) => <BetRow position={p} symbol={symbol} nowMs={nowMs} first={first} /> })) : [];
  const vaultItems: Item[] =
    vault && isOk(vault) ? vault.value.map((b) => ({ key: `vault:${b.marketId}`, render: (first) => <VaultBetRow bet={b} symbol={symbol} nowMs={nowMs} first={first} /> })) : [];
  const openItems = [...restingItems, ...positionItems, ...vaultItems, ...boostList.filter((p) => p.status === "live").map(boostItem)];
  const doneBoosts = boostList.filter((p) => p.status !== "live").map(boostItem);
  const pager = usePager(openItems, PAGE_SIZE);

  const settledCount = history.reading?.ok ? history.reading.value.rounds.length + doneBoosts.length : null;
  const sourcesPending = (address !== null && (resting === null || vault === null || boosts === null)) as boolean;
  const openReading = sourcesPending && openItems.length === 0 ? null : reading;
  const openCount = openReading && isOk(openReading) && !sourcesPending ? openItems.length : null;

  const nothing = (settledCount ?? 0) > 0 ? PORTFOLIO.nothingOpen : PORTFOLIO.noBets;
  const toMarkets = () => router.navigate("/markets");
  const empty =
    session && !session.open
      ? { why: `${nothing} ${SESSION_COPY.portfolio.closed(phrase(session.status, Math.floor(marketsProvider.nowMs() / 1000)))}`, nextAction: { label: SESSION_COPY.portfolio.seeNext, onPress: toMarkets } }
      : { why: nothing, nextAction: { label: (settledCount ?? 0) > 0 ? PORTFOLIO.nextCall : PORTFOLIO.firstCall, onPress: toMarkets } };
  const retry = () => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.positions(address) });
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        index={index}
        title={PORTFOLIO.betsTitle}
        aside={
          <View style={[styles.tabs, { borderColor: color.hairline }]} accessibilityRole="tablist" accessibilityLabel={PORTFOLIO.betsTitle}>
            <TabButton tab="open" current={tab} count={openCount} label={PORTFOLIO.tabs.open} onPick={setTab} />
            <TabButton tab="history" current={tab} count={settledCount} label={PORTFOLIO.tabs.history} onPick={setTab} />
          </View>
        }
      />
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        {tab === "open" ? (
          <ReadingBoundary reading={openReading} shape="row" retry={retry} isEmpty={() => openItems.length === 0} empty={empty} style={styles.inset}>
            {() => (
              <>
                {pager.slice.map((item, i) => (
                  <View key={item.key}>{item.render(i === 0)}</View>
                ))}
                <Pager pager={pager} />
              </>
            )}
          </ReadingBoundary>
        ) : (
          <>
            <HistoryRows history={history} symbol={symbol} />
            {doneBoosts.length > 0 ? (
              <View style={[styles.sublist, { borderTopColor: color.hairline }]}>
                <Text style={[WEB_TYPE.labelMicro, styles.subLabel, { color: color.inkMuted }]}>{LEVERAGE.bets.history}</Text>
                {doneBoosts.map((item) => (
                  <View key={item.key}>{item.render(false)}</View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
      <Pressable onPress={toMarkets} accessibilityRole="link" style={styles.link}>
        <Text style={[WEB_TYPE.caption, { color: color.accent }]}>{PORTFOLIO.toMarkets} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  tabs: { flexDirection: "row", gap: 2, padding: 2, borderWidth: 1, borderRadius: 999 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  count: { fontVariant: ["tabular-nums"] },
  plate: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  inset: { paddingVertical: 16, paddingHorizontal: 20 },
  sublist: { borderTopWidth: 1 },
  subLabel: { paddingTop: 10, paddingHorizontal: 20 },
  link: { alignSelf: "flex-start" },
});
