import { blockerLabel, formatCadence } from "@agari/core/copy";
import { BPS_PER_X } from "@agari/core/leverage";
import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TicketSelection } from "@/features/markets/ticket/types";
import { useTicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { LEVERAGE } from "@/features/leverage/copy";
import { RANGE } from "@/features/range/copy";
import { TICKET } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { Button, SignReview } from "~/components/kit";
import { CallReceipt } from "~/components/ticket/CallReceipt";
import { ReadoutStrip } from "~/components/ticket/ReadoutStrip";
import { SideToggle } from "~/components/ticket/SideToggle";
import { TicketCta } from "~/components/ticket/TicketCta";
import { SPACE, TYPE, useTheme } from "~/theme";
import { NATIVE_MARKETS } from "../copy";
import { AccountGate, OutcomeNote } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { NextWindowOffer } from "./NextWindowOffer";
import { clearPrivateFailure, PrivateFailureNote, recordPrivateAttempt } from "./PrivateFailure";
import { PrivateNote, privateCtaLabel } from "./PrivateParts";
import { RangeBand, rangeCtaLabel, RangePlacedCard, rangeReview } from "./RangeParts";
import { ticketReview } from "./review";
import { SheetToasts } from "./SheetToasts";
import { pushToast, useToasts } from "~/components/toast/store";
import { TicketHead } from "./TicketHead";
import { useClampedScroll } from "./useClampedScroll";
import { BetAgainstToggle, BetModes, PublicPrivate, RouteChoice } from "./Toggles";

const TICKET_NOT_PLACED = "Not placed";

/**
 * web's Ticket, block for block (`Ticket.tsx` over `useTicketComposer`): mode · side · the amount (keypad, +1/+5/+20,
 * leverage) · the three-number strip · the gates · Wallet/Trading Balance · Public/Private · the outcome · the CTA. The
 * CTA sits under the thumb; a ready ticket opens the review (the exact quote and the maximum loss), and only the slide
 * there sends the order to the wallet. A confirmed fill turns the sheet into The Call.
 */
export function TakerTicket({ selection }: { selection: TicketSelection }) {
  const { color } = useTheme();
  const c = useTicketComposer(selection);
  const scroll = useClampedScroll();
  const [reviewing, setReviewing] = useState(false);
  const toasts = useToasts();
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;
  // A private bet that placed clears the last refusal kept on the ticket.
  const privPlaced = c.priv.placed;
  useEffect(() => {
    if (privPlaced) clearPrivateFailure();
  }, [privPlaced]);
  const review = c.isRange ? rangeReview(c) : ticketReview(c);
  // Signed and landed but not yet read back (the lane refreshes the wallet before it reports): still in flight, so no
  // second slide is offered while the outcome is on its way.
  const confirming = c.bet.state.outcome === null && (c.bet.state.phase === "confirming" || c.bet.state.phase === "confirmed");
  const placing = c.bet.placing || confirming || c.blocker === "placing" || c.priv.busy !== null || c.range.blocker === "placing";

  // A new outcome that is not a fill (a requote, a refusal, nothing filled) returns to the composer to say so.
  const outcome = c.bet.state.outcome;
  useEffect(() => {
    if (outcome && outcome.status !== "confirmed") setReviewing(false);
  }, [outcome]);

  // The ticket rolled to the next Window: the review in hand priced the old Book, so it closes and is opened afresh,
  // and a requote or refusal said about the old Window goes with it. A fill's receipt stays.
  const marketId = c.market.marketId;
  const shownFor = useRef(marketId);
  const { reset: resetBet } = c.bet;
  useEffect(() => {
    if (shownFor.current === marketId) return;
    shownFor.current = marketId;
    setReviewing(false);
    if (outcome && outcome.status !== "confirmed") resetBet();
  }, [marketId, outcome, resetBet]);

  if (c.isRange && c.range.placed) {
    return (
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
        <RangePlacedCard placed={c.range.placed} onAnother={c.reset} />
      </ScrollView>
    );
  }
  if (c.booked) {
    return (
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
        <CallReceipt booked={c.booked} market={c.market} decimals={c.decimals} symbol={c.symbol} leverage={c.placedBoost?.leverage ?? null} onAnother={c.reset} />
      </ScrollView>
    );
  }

  const blocker = c.isRange ? c.range.blocker : c.privateMode ? c.priv.blocker : c.blocker;
  const ctx = c.isRange ? c.range.ctx : c.privateMode ? { ...c.ctx, ...c.priv.ctx } : c.ctx;
  const ctaLabel = c.isRange ? rangeCtaLabel(c) : ((c.privateMode ? privateCtaLabel(c.priv, c.side, c.decimals, c.symbol) : null) ?? review?.cta ?? TICKET.buyPlain);
  const confirm = () => {
    // A write that throws (a lane that rejects instead of answering) is said in the sheet, never swallowed.
    const said = (write: Promise<unknown>) => void write.catch((error: unknown) => pushToast({ title: TICKET_NOT_PLACED, description: error instanceof Error ? error.message : String(error), tone: "warning" }));
    if (c.isRange) said(c.range.place());
    else if (c.privateMode) {
      void recordPrivateAttempt(c.priv.place(), toastsRef.current, () => toastsRef.current, (error) =>
        pushToast({ title: TICKET_NOT_PLACED, description: error instanceof Error ? error.message : String(error), tone: "warning" }),
      );
    }
    else if (c.boosted) said(c.placeBoost());
    else c.place();
  };
  const note = [c.boosted ? LEVERAGE.strip.knockout(c.multiple) : null, c.laneGuard.earnings].filter(Boolean).join(" ") || null;

  return (
    // The sheet lays out a ScrollView beside at most one sibling (react-native-screens): both stay real views.
    <View collapsable={false} style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView {...scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TicketHead market={c.market} phase={c.phase} nowMs={c.t.nowMs} />
        <NextWindowOffer market={c.market} phase={c.phase} />
        <BetModes mode={c.mode} onChange={c.setMode} rangeAvailable={c.rangeReserve !== null} />
        {c.isRange ? (
          <RangeBand c={c} />
        ) : (
          <>
            <SideToggle side={c.side} onSelect={c.t.selectSide} />
            <BetAgainstToggle />
          </>
        )}
        <AmountBlock
          value={c.t.stakeText}
          onChange={c.t.setStakeText}
          stakeBase={c.stakeBase}
          onStakeBase={c.t.setStakeBase}
          balanceBase={c.privateMode ? (c.priv.budget?.spendableBase ?? null) : c.availableBase}
          decimals={c.decimals}
          symbol={c.symbol}
          belowMin={c.stakeBase > 0n && belowMinStake(c.stakeBase, c.decimals)}
          leverage={
            c.isRange
              ? null
              : {
                  value: c.multiple,
                  onChange: c.setMultiple,
                  available: c.leverageReserve !== null,
                  maxMultiple: c.leverageReserve ? c.leverageReserve.params.maxLeverageBps / BPS_PER_X : 1,
                  lockedReason: c.leverageLock,
                }
          }
        />
        {!c.boosted && !c.privateMode && c.displayed?.partial && c.displayed.fillableStakeBase > 0n ? (
          <Button label={CLOSED.useDepth(`${formatBaseUnits(c.displayed.fillableStakeBase, c.decimals)} ${c.symbol}`)} variant="ghost" size="sm" onPress={() => c.t.setStakeBase(c.displayed!.fillableStakeBase)} />
        ) : null}
        <ReadoutStrip cells={c.strip.cells} live={c.strip.live} caption={c.strip.caption} chance={c.strip.chance} note={note} />
        <AccountGate
          session={c.session}
          availableBase={c.privateMode ? (c.priv.budget?.spendableBase ?? null) : c.availableBase}
          stakeBase={c.stakeBase}
          depositBase={c.privateMode ? 0n : c.depositBase}
          decimals={c.decimals}
          symbol={c.symbol}
          balanceSource={c.privateMode ? "private" : c.source === "vault" ? "vault" : "wallet"}
        />
        {c.session.isConnected && !c.privateMode && c.showRoute ? (
          <RouteChoice source={c.source} onChange={c.chooseSource} vaultAvailableBase={c.routing.vaultAvailableBase} decimals={c.decimals} symbol={c.symbol} armed={c.routing.armed} deployed={c.routing.deployed} />
        ) : null}
        {!c.isRange && c.priv.deployed ? (
          <PublicPrivate
            priv={c.privateMode}
            onChange={c.choosePrivate}
            privateEnabled={!c.priv.probing && c.priv.ready && !c.priv.overCap}
            privateTitle={c.privateTitle}
            retry={!c.priv.probing && !c.priv.ready ? c.priv.retryStatus : null}
          />
        ) : null}
        {c.privateMode ? <PrivateNote priv={c.priv} stakeBase={c.stakeBase} decimals={c.decimals} symbol={c.symbol} /> : null}
        {c.privateMode || c.priv.pending ? <PrivateFailureNote priv={c.priv} decimals={c.decimals} symbol={c.symbol} /> : null}
        {c.t.advancedFrom ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{TICKET.advanced(formatCadence(c.t.advancedFrom.intervalSec), formatCadence(c.market.intervalSec))}</Text> : null}
        <OutcomeNote state={c.bet.state} decimals={c.decimals} symbol={c.symbol} onDismiss={c.bet.reset} />
        <Text style={[TYPE.caption, styles.foot, { color: color.inkMuted }]}>
          {c.isRange ? RANGE.cta.footnote : c.routing.armed ? TICKET.footnoteArmed : TICKET.footnote}
          {c.isRange && c.rangeReserve?.paused ? ` ${RANGE.ticket.reservePaused}` : ""}
          {c.walletRoute && c.funding?.ok && c.funding.venueCreditUsedBase > 0n ? ` ${TICKET.creditNote(`${formatBaseUnits(c.funding.venueCreditUsedBase, c.decimals)} ${c.symbol}`)}` : ""}
          {c.session.isConnected && c.depositBase > 0n ? ` ${TICKET.seatDeposit(`${formatBaseUnits(c.depositBase, c.decimals)} ${c.symbol}`)}` : ""}
        </Text>
      </ScrollView>
      <View collapsable={false} style={[styles.dock, { borderTopColor: color.hairline, backgroundColor: color.ground }]}>
        <SheetToasts />
        {reviewing && review ? (
          <>
            <SignReview
              title={review.title}
              lines={review.lines}
              maxLoss={review.maxLoss}
              confirmLabel={review.confirmLabel}
              onConfirm={confirm}
              phase={confirming ? "sending" : placing ? "signing" : "review"}
              blocker={blocker && blocker !== "placing" ? blockerLabel(blocker, ctx) : null}
              tone={c.isRange ? "accent" : c.side === "down" ? "loss" : "profit"}
            />
            {placing ? null : <Button label={NATIVE_MARKETS.editCall} variant="ghost" size="sm" onPress={() => setReviewing(false)} />}
          </>
        ) : (
          <TicketCta
            blocker={blocker}
            ctx={ctx}
            side={c.side}
            label={ctaLabel}
            // Resuming a private bet finishes one already reviewed and signed (web's PrivateCta): nothing new to review.
            onReview={c.privateMode && c.priv.pending ? confirm : () => setReviewing(true)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SPACE.gutter, paddingTop: 20, gap: 14, paddingBottom: 24 },
  dock: { paddingHorizontal: SPACE.gutter, paddingTop: 10, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  foot: { textAlign: "center" },
});
