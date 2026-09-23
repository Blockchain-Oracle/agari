import { isOk } from "@agari/core/schemas";
import { useClaimables, usePositions } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBalancePlate } from "@/features/markets/balance/useBalancePlate";
import { useHistoryReading } from "@/features/markets/history/useHistoryReading";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import { useMoney } from "@/features/markets/portfolio/plate/useMoney";
import { usePortfolioTiers } from "@/features/markets/portfolio/useTiers";
import { useVenue } from "@/features/markets/useVenue";
import { useVaultOpenBets } from "@/features/vault/useVaultOpenBets";
import { CLAIM, PORTFOLIO } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ErrorState, haptic, SectionHeader } from "~/components/kit";
import { ProductPositions } from "~/components/portfolio/ProductPositions";
import { TabScreen } from "~/components/shell/TabScreen";
import { BetsPanel } from "~/features/portfolio/BetsPanel";
import { ClaimPlate } from "~/features/portfolio/ClaimPlate";
import { ConnectCard, XWalletNote } from "~/features/portfolio/ConnectCard";
import { Disclosure } from "~/features/portfolio/Disclosure";
import { LedgerPlate } from "~/features/portfolio/LedgerPlate";
import { PoolRows } from "~/features/portfolio/PoolRows";
import { PrivatePanel } from "~/features/portfolio/PrivatePanel";
import { RecordSection } from "~/features/portfolio/RecordSection";
import { TradingBalancePanel } from "~/features/portfolio/TradingBalancePanel";
import { TraderEdgeLink } from "~/features/portfolio/TraderEdgeLink";
import { usePlateInk } from "~/features/portfolio/usePlateInk";
import { XPanel } from "~/features/portfolio/XPanel";
import { YourStocks } from "~/features/portfolio/YourStocks";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * web `PortfolioScreen`: the money, the open bets, and what is waiting to be collected. No headline — the tab already
 * says where you are, and the number is what the page is opened for, so the ledger plate leads: ONE spendable figure
 * (wallet + Trading Balance, where a bet routes), every other pool a row inside the plate, never merged into it.
 * The critical reads (balance, positions, claims) go first; the settled-history scan waits for them (web `useTiers`),
 * and an outage of all three is said once with one retry. Pull to refresh refetches every read on the screen.
 */
export default function PortfolioScreen() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const venue = useVenue();
  const { boot } = venue;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const money = useMoney();
  const positions = usePositions(address);
  const vaultBets = useVaultOpenBets(address);
  const plate = useBalancePlate();
  const claimables = useClaimables(address, venue.venueId);
  const tiers = usePortfolioTiers([plate.kind === "connected" ? plate.reading : null, positions, claimables]);
  const history = useHistoryReading(tiers.criticalSettled);
  const [refreshing, setRefreshing] = useState(false);
  const ink = usePlateInk();

  const refresh = async () => {
    setRefreshing(true);
    haptic.select();
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  };

  const openBets = (positions && isOk(positions) ? positions.value.length : 0) + (vaultBets && isOk(vaultBets) ? vaultBets.value.length : 0);
  const settled = history.reading && isOk(history.reading) ? history.reading.value.rounds.length : 0;
  const sheet = plate.kind === "connected" && plate.reading && isOk(plate.reading) ? plate.reading.value : null;

  let body;
  if (!address) {
    body = (
      <>
        <ConnectCard />
        <XWalletNote />
      </>
    );
  } else if (tiers.outage) {
    body = <ErrorState diagnosis={tiers.outage} retry={tiers.retry} />;
  } else {
    body = (
      <>
        <LedgerPlate money={money} symbol={symbol} openBets={openBets} settled={settled} onPrimary={() => router.push("/funds")}>
          <PoolRows
            pools={money.pools}
            sheet={sheet}
            decimals={money.decimals}
            symbol={symbol}
            panels={{ x: <XPanel symbol={symbol} />, private: <PrivatePanel /> }}
          />
          <View style={[styles.disclosure, { borderTopColor: ink.line }]}>
            <Disclosure
              accessibilityLabel={PLATE.vaultDisclosure}
              ink={ink.mute}
              summary={<Text style={[TYPE.title, styles.discTitle, { color: ink.ink }]}>{PLATE.vaultDisclosure}</Text>}
            >
              <TradingBalancePanel />
            </Disclosure>
          </View>
        </LedgerPlate>

        <TraderEdgeLink />
        <YourStocks index="01" />
        <BetsPanel symbol={symbol} index="02" history={history} />

        <View style={styles.section}>
          <SectionHeader index="03" title="Other positions" desc="Parlay, Range, Moonshot, and reserve shares held by this wallet." />
          <ProductPositions address={address} decimals={money.totalReady ? money.decimals : null} symbol={symbol} />
        </View>

        <View style={styles.section}>
          <SectionHeader index="04" title={PORTFOLIO.collectTitle} desc={CLAIM.pageIntro} />
          <ClaimPlate />
        </View>

        <RecordSection history={history} symbol={symbol} index="05" />
      </>
    );
  }

  return (
    <TabScreen>
      <ScrollView
        style={{ backgroundColor: color.ground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={address ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} colors={[color.accent]} /> : undefined}
      >
        {body}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 16, paddingBottom: 130, gap: 28 },
  section: { gap: 12 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  discTitle: { fontSize: 14, lineHeight: 20 },
});
