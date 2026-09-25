import type { LeverageReserveState } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useBalanceSheet, useLeverageReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SHORT } from "@/features/short/copy";
import { useShortWindows } from "@/features/short/useShortWindows";
import { useWalletSession } from "@/lib/wallet-session";
import { ReadingView } from "~/components/kit";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { MarketSessionChip } from "./MarketSessionChip";
import { CapabilityPending, HowCards, PendingParagraph, SectionHead } from "./PageParts";
import { ShortPicker } from "./ShortPicker";
import { ShortPositions } from "./ShortPositions";
import { percentOf } from "./ShortSizer";
import { ShortTicket } from "./ShortTicket";

/** `/short` — web's `features/short/ShortScreen.tsx` (`.container.sh-page`): the inverse position over the leverage reserve (A-1b). */
export function ShortScreen() {
  const queryClient = useQueryClient();
  const reading = useLeverageReserve();
  return (
    <ExplorePage title={SHORT.title} onRefresh={() => queryClient.invalidateQueries()}>
      <View style={styles.page}>
        <ReadingView reading={reading} loading="plate">
          {(state) => (state ? <Page reserve={state} /> : <NotDeployed />)}
        </ReadingView>
      </View>
    </ExplorePage>
  );
}

function NotDeployed() {
  const { notDeployed } = SHORT;
  return (
    <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
      <PendingParagraph>{notDeployed.body}</PendingParagraph>
      <PendingParagraph>{notDeployed.why}</PendingParagraph>
    </CapabilityPending>
  );
}

function Page({ reserve }: { reserve: LeverageReserveState }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const nowMs = useChainNowMs();
  const { stocks, loading } = useShortWindows(nowMs);
  const { address } = useWalletSession();
  const balance = useBalanceSheet(address);
  const [picked, setPicked] = useState<EventMarket | null>(null);
  const { sections } = SHORT;

  // web's rule: the pick follows the board — a Window that rolled away is replaced by that stock's next one, and
  // with nothing picked the soonest is offered, so the picker's highlight and the ticket never disagree.
  const live = stocks.flatMap((s) => s.windows);
  const selected =
    live.find((m) => m.marketId === picked?.marketId) ??
    (picked ? stocks.find((s) => s.asset === picked.asset)?.windows[0] : undefined) ??
    live[0] ??
    null;

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={[styles.eyebrow, { color: t.eyebrow }]}>{SHORT.eyebrow}</Text>
          <MarketSessionChip />
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {SHORT.title}
          <Text style={{ color: color.accent }}>.</Text>
        </Text>
        <Text style={[styles.lede, { color: color.inkMuted }]}>{SHORT.lede}</Text>
      </View>

      <View style={styles.block} accessibilityLabel={sections.open.title}>
        <SectionHead number={sections.open.number} title={sections.open.title} desc={sections.open.desc} />
        <View style={[styles.body, styles.open]}>
          <ShortPicker stocks={stocks} loading={loading} selected={selected} onSelect={setPicked} nowMs={nowMs} />
          <ShortTicket
            market={selected}
            nowMs={nowMs}
            reserve={reserve}
            symbol={symbol}
            walletBase={balance && isOk(balance) ? balance.value.spendableBase : null}
            connected={address !== null}
          />
        </View>
      </View>

      <View style={styles.block} accessibilityLabel={sections.positions.title}>
        <SectionHead number={sections.positions.number} title={sections.positions.title} desc={sections.positions.desc} />
        <View style={styles.body}>
          <ShortPositions symbol={symbol} decimals={reserve.decimals} nowMs={nowMs} />
        </View>
      </View>

      <View style={styles.block} accessibilityLabel={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <View style={styles.body}>
          <HowCards cards={SHORT.how(percentOf(reserve.params.premiumBps), percentOf(reserve.params.maintenanceBps))} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 64 },
  hero: { marginBottom: 48 },
  heroTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 45, lineHeight: 45, letterSpacing: -2.25 },
  lede: { marginTop: 16, fontFamily: FONT.body, fontSize: 13, lineHeight: 22.1 },
  block: { marginBottom: 32 },
  body: { marginTop: 24 },
  open: { gap: 20 },
});
