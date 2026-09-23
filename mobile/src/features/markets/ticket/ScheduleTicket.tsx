import { blockerLabel, formatCadence } from "@agari/core/copy";
import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { laneAssetLabel } from "@/features/markets/lanes/lane-view";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { plainCells } from "@/features/markets/ticket/readout-cells";
import type { TicketSelection } from "@/features/markets/ticket/types";
import { useScheduleTicket } from "@/features/markets/ticket/useScheduleTicket";
import { PREOPEN, TICKET } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button, haptic, SignReview } from "~/components/kit";
import { ReadoutStrip } from "~/components/ticket/ReadoutStrip";
import { SideToggle } from "~/components/ticket/SideToggle";
import { TicketCta } from "~/components/ticket/TicketCta";
import { SPACE, TYPE, useTheme } from "~/theme";
import { NATIVE_MARKETS } from "../copy";
import { AccountGate, OutcomeNote } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { PriceControl } from "./PriceControl";
import { ScheduledReceipt } from "./ScheduledReceipt";
import { TicketHead } from "./TicketHead";
import { BetAgainstToggle } from "./Toggles";

/**
 * web's ScheduleTicket (D-088), the app's limit order: on a Window listed before its bell, a post-only call rests at
 * the user's own price. Side · amount · the price · the strip the chain will hold · the gates · how long it rests ·
 * the CTA, then the review (escrow, contracts, price and the maximum loss) and the slide. Resting, the sheet is the
 * receipt with its Cancel.
 */
export function ScheduleTicket({ selection }: { selection: TicketSelection }) {
  const { color } = useTheme();
  const when = useWhen();
  const s = useScheduleTicket(selection);
  const { t, symbol, quote } = s;
  const { market, side, stakeBase } = t;
  const decimals = market.decimals;
  const [reviewing, setReviewing] = useState(false);
  const outcome = s.bet.state.outcome;
  // Signed and landed but not yet read back: still in flight, so the slide is not offered again.
  const confirming = outcome === null && (s.bet.state.phase === "confirming" || s.bet.state.phase === "confirmed");
  useEffect(() => {
    if (outcome && outcome.status !== "resting") setReviewing(false);
  }, [outcome]);

  const rested = outcome?.status === "resting" ? outcome.rested : null;
  if (rested) {
    return (
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
        <ScheduledReceipt
          rested={rested}
          market={market}
          decimals={decimals}
          symbol={symbol}
          onAnother={() => {
            s.bet.reset();
            t.setStakeText("");
          }}
        />
      </ScrollView>
    );
  }

  const caption = quote ? (s.restUntil === "lock" ? PREOPEN.ticket.restsUntilLock(s.priceCents) : PREOPEN.ticket.rests(s.priceCents)) : s.gridReady ? PREOPEN.ticket.sizing : PREOPEN.ticket.reading;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const label = side && quote ? `${PREOPEN.ticket.cta(SIDE_WORD[side])} ${money(quote.maxCostBase)}` : PREOPEN.ticket.ctaPlain;

  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <TicketHead market={market} phase={t.phase} nowMs={t.nowMs} chart={false} />
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{PREOPEN.ticket.listed(when(market.tradingStartSec))}</Text>
        <SideToggle side={side} onSelect={t.selectSide} />
        <BetAgainstToggle />
        <AmountBlock
          value={t.stakeText}
          onChange={t.setStakeText}
          stakeBase={stakeBase}
          onStakeBase={t.setStakeBase}
          balanceBase={s.availableBase}
          decimals={decimals}
          symbol={symbol}
          belowMin={stakeBase > 0n && belowMinStake(stakeBase, decimals)}
          leverage={null}
        />
        <PriceControl priceCents={s.priceCents} onChange={s.setPriceCents} side={side} symbol={symbol} />
        <ReadoutStrip cells={plainCells(quote, decimals)} live={quote !== null} caption={caption} chance={quote ? TICKET.chance(s.priceCents) : null} note={s.laneNote} />
        <AccountGate session={s.session} availableBase={s.availableBase} stakeBase={quote?.maxCostBase ?? stakeBase} depositBase={s.depositBase} decimals={decimals} symbol={symbol} balanceSource="wallet" />
        <View style={styles.switchRow}>
          <Text style={[TYPE.bodyStrong, styles.grow, { color: color.ink }]}>{PREOPEN.ticket.untilLock}</Text>
          <Switch
            value={s.restUntil === "lock"}
            onValueChange={(on) => {
              haptic.select();
              s.setRestUntil(on ? "lock" : "bell");
            }}
            trackColor={{ true: color.accent, false: color.surface3 }}
            accessibilityLabel={PREOPEN.ticket.untilLock}
          />
        </View>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{PREOPEN.ticket.untilLockNote}</Text>
        <OutcomeNote state={s.bet.state} decimals={decimals} symbol={symbol} onDismiss={s.bet.reset} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {PREOPEN.ticket.footnote(s.bondText)}
          {s.session.isConnected && s.depositBase > 0n ? ` ${TICKET.seatDeposit(money(s.depositBase))}` : ""}
        </Text>
      </ScrollView>
      <View style={[styles.dock, { borderTopColor: color.hairline }]}>
        {reviewing && side && quote ? (
          <>
            <SignReview
              title={NATIVE_MARKETS.scheduleTitle(SIDE_WORD[side], laneAssetLabel(market.asset, market.lane), formatCadence(market.intervalSec))}
              lines={[
                { label: NATIVE_MARKETS.quote.price, value: `${s.priceCents}¢`, tone: "accent" },
                { label: NATIVE_MARKETS.quote.contracts, value: formatBaseUnits(quote.contractsRaw, decimals, { minDp: 0 }) },
                { label: NATIVE_MARKETS.quote.held, value: money(quote.maxCostBase) },
                { label: NATIVE_MARKETS.quote.payout, value: money(quote.payoutIfRightBase), tone: "profit" },
                ...(s.depositBase > 0n ? [{ label: NATIVE_MARKETS.quote.seat, value: money(s.depositBase), tone: "muted" as const }] : []),
                { label: PREOPEN.receipt.fillsBy, value: s.restUntil === "lock" ? "until lock" : "first minute", hint: s.restUntil === "lock" ? PREOPEN.receipt.lock : PREOPEN.receipt.bell },
              ]}
              maxLoss={money(quote.maxCostBase)}
              confirmLabel={`Slide to schedule ${SIDE_WORD[side]}`}
              onConfirm={s.place}
              phase={confirming ? "sending" : s.bet.placing ? "signing" : "review"}
              blocker={s.blocker && s.blocker !== "placing" ? blockerLabel(s.blocker, s.ctx) : null}
              tone={side === "down" ? "loss" : "profit"}
            />
            {s.bet.placing || confirming ? null : <Button label={NATIVE_MARKETS.editCall} variant="ghost" size="sm" onPress={() => setReviewing(false)} />}
          </>
        ) : (
          <TicketCta blocker={s.blocker} ctx={s.ctx} side={side} label={label} onReview={() => setReviewing(true)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SPACE.gutter, paddingTop: 20, gap: 14, paddingBottom: 24 },
  dock: { paddingHorizontal: SPACE.gutter, paddingTop: 10, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
});
