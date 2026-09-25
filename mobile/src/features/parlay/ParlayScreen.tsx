import type { ParlayReserveState } from "@agari/core/parlay";
import { isOk } from "@agari/core/schemas";
import { useParlayReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { PARLAY } from "@/features/parlay/copy";
import { useParlayTickets, type ParlayTicketView } from "@/features/parlay/useParlayTickets";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { useWalletSession } from "@/lib/wallet-session";
import { ReadingView, Screen } from "~/components/kit";
import { FONT } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { SectionHead, useEarnParlay } from "~/features/earn/EarnKit";
import { CapabilityPending, CpText, SlipEmpty } from "~/features/earn/EarnParts";
import { ParlayBuilder } from "./ParlayBuilder";
import { ParlayCard } from "./ParlayCard";

/** `/parlay` — web's `features/parlay/ParlayScreen.tsx`: the hero, the builder, your tickets, how a parlay pays. */
export function ParlayScreen() {
  const queryClient = useQueryClient();
  const reading = useParlayReserve();
  return (
    <Screen title={PARLAY.title} onRefresh={() => queryClient.invalidateQueries()} contentStyle={styles.page}>
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page reserve={state} /> : <NotDeployed />)}
      </ReadingView>
    </Screen>
  );
}

function NotDeployed() {
  const { notDeployed } = PARLAY;
  return (
    <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
      <CpText>{notDeployed.body}</CpText>
      <CpText>{notDeployed.why}</CpText>
    </CapabilityPending>
  );
}

function Page({ reserve }: { reserve: ParlayReserveState }) {
  const { color, t } = useEarnParlay();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const nowMs = useChainNowMs();
  const { sections } = PARLAY;
  return (
    <>
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: t.vermilion80 }]}>{PARLAY.eyebrow}</Text>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {PARLAY.title}
          <Text style={{ color: color.accent }}>.</Text>
        </Text>
      </View>

      <View style={styles.block} accessibilityLabel={sections.build.title}>
        <SectionHead number={sections.build.number} title={sections.build.title} desc={sections.build.desc} />
        <ParlayBuilder reserve={reserve} symbol={symbol} nowMs={nowMs} />
      </View>

      <View style={styles.block} accessibilityLabel={sections.tickets.title}>
        <SectionHead number={sections.tickets.number} title={sections.tickets.title} desc={sections.tickets.desc} />
        <ParlaySlip symbol={symbol} decimals={reserve.decimals} nowMs={nowMs} />
      </View>

      <View style={styles.block} accessibilityLabel={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <View style={styles.how}>
          {PARLAY.how.map((c) => (
            <View key={c.n} style={[styles.howCard, { borderColor: t.tableBorder, backgroundColor: t.tableBg }]}>
              <Text style={[styles.howN, { color: color.accent }]}>{c.n}</Text>
              <Text style={[styles.howT, { color: color.ink }]}>{c.t}</Text>
              <Text style={[styles.howD, { color: color.inkMuted }]}>{c.d}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

/**
 * web's `features/parlay/ParlaySlip.tsx`: the connected wallet's tickets, live first, each leg flipping as its Window
 * settles; the settle crank on the row (permissionless) and a won ticket's claim call web's write hook directly.
 */
function ParlaySlip({ symbol, decimals, nowMs }: { symbol: string; decimals: number; nowMs: number }) {
  const { address } = useWalletSession();
  const reading = useParlayTickets(address);
  const writes = useParlayWrites();
  const onClaim = useCallback((ticket: ParlayTicketView) => void writes.claim(ticket.parlayId, ticket.maxPayoutBase, decimals, symbol), [writes, decimals, symbol]);
  const onSettle = useCallback(
    (ticket: ParlayTicketView, legIdx: number) => {
      const leg = ticket.legs[legIdx];
      if (leg) void writes.settleLeg(ticket.parlayId, legIdx, leg.marketId);
    },
    [writes],
  );

  if (!address) return <SlipEmpty text={PARLAY.slip.emptyDisconnected} />;
  return (
    <ReadingView reading={reading} loading="row">
      {(tickets) =>
        tickets.length === 0 ? (
          <SlipEmpty text={PARLAY.slip.emptyConnected} />
        ) : (
          <View style={styles.slip}>
            {tickets.map((ticket) => (
              <ParlayCard key={ticket.parlayId.toString()} ticket={ticket} nowMs={nowMs} symbol={symbol} decimals={decimals} busy={writes.busy} onClaim={onClaim} onSettle={onSettle} />
            ))}
          </View>
        )
      }
    </ReadingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingHorizontal: 18, paddingBottom: 64 + CHROME.dockClearance, gap: 0 },
  hero: { marginBottom: 48 },
  eyebrow: { marginBottom: 16, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 45, lineHeight: 45, letterSpacing: -2.25 },
  block: { marginBottom: 32 },
  how: { gap: 16 },
  howCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  howN: { marginBottom: 8, fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 26 },
  howT: { marginBottom: 6, fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  howD: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5 },
  slip: { gap: 16 },
});
