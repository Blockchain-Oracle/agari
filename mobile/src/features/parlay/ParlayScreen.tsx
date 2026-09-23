import type { ParlayReserveState } from "@agari/core/parlay";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useParlayReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { PARLAY } from "@/features/parlay/copy";
import { useParlayTickets, type ParlayTicketView } from "@/features/parlay/useParlayTickets";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, ReadingView, Screen, SectionHeader } from "~/components/kit";
import { HowCards, TitleHero } from "~/features/short/PageParts";
import { ReviewSheet, type ReviewRequest } from "~/features/short/ReviewSheet";
import { ParlayBuilder } from "./ParlayBuilder";
import { ParlayCard } from "./ParlayCard";

/** `/parlay` — web's `features/parlay/ParlayScreen.tsx`: the hero, the builder, your tickets, how it pays. */
export function ParlayScreen() {
  const queryClient = useQueryClient();
  const reading = useParlayReserve();
  const [review, setReview] = useState<ReviewRequest | null>(null);
  return (
    <Screen title={PARLAY.title} onRefresh={() => queryClient.invalidateQueries()}>
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page reserve={state} onReview={setReview} /> : <NotDeployed />)}
      </ReadingView>
      <ReviewSheet request={review} onClose={() => setReview(null)} />
    </Screen>
  );
}

function NotDeployed() {
  const { notDeployed } = PARLAY;
  return <EmptyState why={`${notDeployed.title} · needs ${notDeployed.dependency}`} detail={`${notDeployed.body}\n\n${notDeployed.why}`} />;
}

function Page({ reserve, onReview }: { reserve: ParlayReserveState; onReview: (r: ReviewRequest) => void }) {
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const nowMs = useChainNowMs();
  const { sections } = PARLAY;
  return (
    <>
      <TitleHero eyebrow={PARLAY.eyebrow} title={PARLAY.title} />
      <SectionHeader index={sections.build.number} title={sections.build.title} desc={sections.build.desc} />
      <ParlayBuilder reserve={reserve} symbol={symbol} nowMs={nowMs} onReview={onReview} />
      <SectionHeader index={sections.tickets.number} title={sections.tickets.title} desc={sections.tickets.desc} />
      <Slip symbol={symbol} decimals={reserve.decimals} nowMs={nowMs} onReview={onReview} />
      <SectionHeader index={sections.how.number} title={sections.how.title} />
      <HowCards cards={PARLAY.how} />
    </>
  );
}

/** web's `features/parlay/ParlaySlip.tsx`: the wallet's tickets; the settle crank on the row, the claim to its owner. */
function Slip({ symbol, decimals, nowMs, onReview }: { symbol: string; decimals: number; nowMs: number; onReview: (r: ReviewRequest) => void }) {
  const { address } = useWalletSession();
  const reading = useParlayTickets(address);
  const writes = useParlayWrites();
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;

  const claim = (ticket: ParlayTicketView) =>
    onReview({
      title: `Claim your ${ticket.legs.length}-leg parlay`,
      lines: [
        { label: "Staked", value: money(ticket.stakeBase) },
        { label: "To your wallet", value: money(ticket.maxPayoutBase), tone: "profit" },
      ],
      maxLoss: null,
      confirmLabel: "Slide to claim",
      tone: "profit",
      send: async () => {
        await writes.claim(ticket.parlayId, ticket.maxPayoutBase, decimals, symbol);
        return null;
      },
    });

  const settle = (ticket: ParlayTicketView, legIdx: number) => {
    const leg = ticket.legs[legIdx];
    if (!leg) return;
    onReview({
      title: `Settle leg ${legIdx + 1} of your parlay`,
      lines: [
        { label: "Leg", value: `${leg.asset ?? "…"} ${leg.side === "up" ? "UP" : "DOWN"}` },
        { label: "What it does", value: "Reads the Window's result" },
      ],
      maxLoss: null,
      confirmLabel: "Slide to settle",
      send: async () => {
        await writes.settleLeg(ticket.parlayId, legIdx, leg.marketId);
        return null;
      },
    });
  };

  if (!address) return <EmptyState why={PARLAY.slip.emptyDisconnected} />;
  return (
    <ReadingView reading={reading} loading="list">
      {(tickets) =>
        tickets.length === 0 ? (
          <EmptyState why={PARLAY.slip.emptyConnected} />
        ) : (
          <View style={{ gap: 10 }}>
            {tickets.map((ticket) => (
              <ParlayCard key={ticket.parlayId.toString()} ticket={ticket} nowMs={nowMs} symbol={symbol} decimals={decimals} busy={writes.busy} onClaim={claim} onSettle={settle} />
            ))}
          </View>
        )
      }
    </ReadingView>
  );
}
