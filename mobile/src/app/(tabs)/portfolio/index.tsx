import { isOk } from "@agari/core/schemas";
import { useClaimables, usePositions } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
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
import { ErrorState, SectionHeader } from "~/components/portfolio/web";
import { TabScreen } from "~/components/shell/TabScreen";
import { BetsPanel } from "~/features/portfolio/BetsPanel";
import { LiveClaimPlate } from "~/features/portfolio/claims/LiveClaimPlate";
import { ConnectCard } from "~/features/portfolio/ConnectCard";
import { Disclosure } from "~/features/portfolio/Disclosure";
import { LedgerPlate } from "~/features/portfolio/LedgerPlate";
import { PoolRows } from "~/features/portfolio/PoolRows";
import { PrivatePanel } from "~/features/portfolio/PrivatePanel";
import { RecordSection } from "~/features/portfolio/record/RecordSection";
import { TradingBalancePanel } from "~/features/portfolio/TradingBalancePanel";
import { TraderEdgeLink } from "~/features/portfolio/TraderEdgeLink";
import { usePlateInk } from "~/features/portfolio/usePlateInk";
import { XWalletCard } from "~/features/portfolio/x/XWalletCard";
import { YourStocks } from "~/features/portfolio/YourStocks";
import { FONT, useTheme } from "~/theme";
import { WEB_PAGE, WEB_TYPE } from "~/theme/web/portfolio";

/** web `PlateDisclosure` (`.plate-rows.lp-disclosure`): the plate's own disclosure row, Sora 14 over a top rule. */
function PlateDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const ink = usePlateInk();
  return (
    <View style={[styles.disclosure, { borderTopColor: ink.line }]}>
      <Disclosure
        accessibilityLabel={title}
        ink={ink.mute}
        summaryStyle={styles.discSummary}
        summary={<Text style={[styles.discTitle, { color: ink.ink }]}>{title}</Text>}
        panelStyle={styles.discPanel}
      >
        {children}
      </Disclosure>
    </View>
  );
}

/**
 * web `PortfolioScreen` at 402 px: no headline — the balance plate opens the page (its pools and the Trading Balance
 * disclosure inside it), then the Trader Edge link, 01 Your stocks, 02 Your bets, 03 To collect and 04 Your record,
 * gap 32 in a 16 pt gutter. Disconnected: the connect card and the X wallet card. An outage of every critical read is
 * said once. Pull to refresh refetches every read on the screen.
 */
export default function PortfolioScreen() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const venue = useVenue();
  const symbol = venue.boot && isOk(venue.boot) ? venue.boot.value.collateral.symbol : "tUSDC";
  const money = useMoney();
  const positions = usePositions(address);
  const vaultBets = useVaultOpenBets(address);
  const plate = useBalancePlate();
  const claimables = useClaimables(address, venue.venueId);
  const tiers = usePortfolioTiers([plate.kind === "connected" ? plate.reading : null, positions, claimables]);
  const history = useHistoryReading(tiers.criticalSettled);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  };

  const openBets = (positions && isOk(positions) ? positions.value.length : 0) + (vaultBets && isOk(vaultBets) ? vaultBets.value.length : 0);
  const settled = history.reading && isOk(history.reading) ? history.reading.value.rounds.length : 0;

  let body;
  if (!address) {
    body = (
      <View style={styles.narrow}>
        <ConnectCard />
        <XWalletCard symbol={symbol} />
      </View>
    );
  } else if (tiers.outage) {
    body = <ErrorState diagnosis={tiers.outage} retry={tiers.retry} />;
  } else {
    body = (
      <View style={styles.wide}>
        <LedgerPlate money={money} symbol={symbol} openBets={openBets} settled={settled} onPrimary={() => router.push("/funds")}>
          <PoolRows pools={money.pools} decimals={money.decimals} symbol={symbol} panels={{ x: <XWalletCard compact symbol={symbol} />, private: <PrivatePanel /> }} />
          <PlateDisclosure title={PLATE.vaultDisclosure}>
            <TradingBalancePanel />
          </PlateDisclosure>
        </LedgerPlate>

        <TraderEdgeLink />
        <YourStocks index="01" />
        <BetsPanel symbol={symbol} index="02" history={history} />

        <View style={styles.section}>
          <SectionHeader index="03" title={PORTFOLIO.collectTitle} />
          <Text style={[WEB_TYPE.body, { color: color.inkSecondary }]}>{CLAIM.pageIntro}</Text>
          <LiveClaimPlate />
        </View>

        <RecordSection history={history} symbol={symbol} index="04" />
      </View>
    );
  }

  return (
    <TabScreen>
      <ScrollView
        style={{ backgroundColor: color.ground }}
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
  body: { paddingHorizontal: WEB_PAGE.gutter, paddingTop: WEB_PAGE.padY, paddingBottom: WEB_PAGE.padY + WEB_PAGE.dock },
  narrow: { gap: 16 },
  wide: { gap: WEB_PAGE.gap },
  section: { gap: 16 },
  disclosure: { marginTop: 8, borderTopWidth: 1 },
  discSummary: { justifyContent: "space-between", paddingVertical: 14 },
  discTitle: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  discPanel: { paddingBottom: 16 },
});
