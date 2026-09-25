import { formatCadence } from "@agari/core/copy";
import { BPS_PER_X } from "@agari/core/leverage";
import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { Pressable, StyleSheet, Text } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import type { TicketSelection } from "@/features/markets/ticket/types";
import { useTicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { LEVERAGE } from "@/features/leverage/copy";
import { RANGE } from "@/features/range/copy";
import { TICKET } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { CallReceipt } from "~/components/ticket/CallReceipt";
import { pushToast } from "~/components/toast/store";
import { FONT } from "~/theme";
import { AccountGate } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { BetAgainstToggle, BetModes, PublicPrivate, SideSegments } from "./Controls";
import { OutcomeNote, RegionNote } from "./OutcomeNote";
import { PrivateCta, PrivateNote } from "./PrivateParts";
import { RangeBand, rangeCtaLabel, RangePlaced } from "./RangeParts";
import { ReadoutStrip } from "./Readout";
import { BlockedButton } from "./TicketButton";
import { TicketDrawer } from "./TicketDrawer";
import { tkType, useTk } from "./tk";

const NOT_PLACED = "Not placed";

/**
 * web's Ticket in its phone drawer (`Ticket.tsx` over `useTicketComposer`), block for block: mode · side (or the
 * band) · "Betting against" · the amount and leverage · the three-number strip · the account gates · Public / Private ·
 * the outcome · the CTA · the footnote. The CTA places at once, as web's does; the wallet's own approval is the review.
 * A confirmed fill turns the drawer into The Call.
 */
export function Ticket({ selection }: { selection: TicketSelection }) {
  const tk = useTk();
  const c = useTicketComposer(selection);
  // A write that throws (a lane that rejects instead of answering) is said, never swallowed.
  const said = (write: Promise<unknown>) => void write.catch((error: unknown) => pushToast({ title: NOT_PLACED, description: error instanceof Error ? error.message : String(error), tone: "warning" }));
  const money = (base: bigint) => `${formatBaseUnits(base, c.decimals)} ${c.symbol}`;

  const cta = c.isRange && !c.regionHeld ? (
    <BlockedButton blocker={c.range.blocker} ctx={c.range.ctx} tone="primary" label={rangeCtaLabel(c)} onPress={() => said(c.range.place())} />
  ) : c.boosted ? (
    <BlockedButton blocker={c.blocker} ctx={c.ctx} tone={c.side ?? "primary"} label={c.side && c.boost.quote ? `${LEVERAGE.cta.buy(SIDE_WORD[c.side], c.multiple)} ${money(c.boost.quote.stakeBase)}` : TICKET.buyPlain} onPress={() => said(c.placeBoost())} />
  ) : c.privateMode ? (
    <PrivateCta priv={c.priv} side={c.side} decimals={c.decimals} symbol={c.symbol} ctx={c.ctx} />
  ) : (
    <BlockedButton blocker={c.blocker} ctx={c.ctx} tone={c.side ?? "primary"} label={c.side && c.displayed ? `${TICKET.buy(SIDE_WORD[c.side])} ${money(c.displayed.maxCostBase)}` : TICKET.buyPlain} onPress={c.place} />
  );
  const note = [c.boosted ? LEVERAGE.strip.knockout(c.multiple) : null, c.laneGuard.earnings].filter(Boolean).join(" ") || null;

  return (
    <TicketDrawer market={c.market} phase={c.phase} nowMs={c.t.nowMs}>
      {c.booked ? (
        <CallReceipt booked={c.booked} market={c.market} decimals={c.decimals} symbol={c.symbol} leverage={c.placedBoost?.leverage ?? null} onAnother={c.reset} />
      ) : c.isRange && c.range.placed ? (
        <RangePlaced placed={c.range.placed} onAnother={c.reset} />
      ) : (
        <>
          <BetModes mode={c.mode} onChange={c.setMode} rangeAvailable={c.rangeReserve !== null} />
          {c.isRange ? (
            <RangeBand c={c} />
          ) : (
            <>
              <SideSegments side={c.side} onSelect={c.t.selectSide} />
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
            leverage={c.isRange ? null : { value: c.multiple, onChange: c.setMultiple, available: c.leverageReserve !== null, maxMultiple: c.leverageReserve ? c.leverageReserve.params.maxLeverageBps / BPS_PER_X : 1, lockedReason: c.leverageLock }}
          />
          {!c.boosted && !c.privateMode && !c.isRange && c.displayed?.partial && c.displayed.fillableStakeBase > 0n ? (
            <Pressable onPress={() => c.t.setStakeBase(c.displayed!.fillableStakeBase)} accessibilityRole="button" style={styles.depth}>
              <Text style={[styles.depthText, { color: tk.ink }]}>{CLOSED.useDepth(money(c.displayed.fillableStakeBase))}</Text>
            </Pressable>
          ) : null}
          <ReadoutStrip cells={c.strip.cells} live={c.strip.live} caption={c.strip.caption} chance={c.strip.chance} note={note} />
          <AccountGate
            session={c.session}
            balanceSource={c.privateMode ? "private" : c.source}
            availableBase={c.privateMode ? (c.priv.budget?.spendableBase ?? null) : c.availableBase}
            stakeBase={c.stakeBase}
            depositBase={c.privateMode ? 0n : c.depositBase}
            decimals={c.decimals}
            symbol={c.symbol}
            route={c.privateMode ? null : { show: c.showRoute, source: c.source, onChange: c.chooseSource, vaultAvailableBase: c.routing.vaultAvailableBase, armed: c.routing.armed, deployed: c.routing.deployed }}
          />
          {!c.isRange && c.priv.deployed ? (
            <PublicPrivate priv={c.privateMode} onChange={c.choosePrivate} privateEnabled={!c.priv.probing && c.priv.ready && !c.priv.overCap} retry={!c.priv.probing && !c.priv.ready ? c.priv.retryStatus : null} />
          ) : null}
          {c.privateMode ? <PrivateNote priv={c.priv} stakeBase={c.stakeBase} decimals={c.decimals} symbol={c.symbol} /> : null}
          {c.t.advancedFrom ? <Text style={[tkType.body, { color: tk.inkSecondary }]}>{TICKET.advanced(formatCadence(c.t.advancedFrom.intervalSec), formatCadence(c.market.intervalSec))}</Text> : null}
          <OutcomeNote state={c.bet.state} decimals={c.decimals} symbol={c.symbol} onDismiss={c.bet.reset} />
          {cta}
          {c.regionHeld ? <RegionNote /> : null}
          <Text style={[tkType.caption, { color: tk.foot }]}>
            {c.isRange ? RANGE.cta.footnote : c.routing.armed ? TICKET.footnoteArmed : TICKET.footnote}
            {c.isRange && c.rangeReserve?.paused ? ` ${RANGE.ticket.reservePaused}` : ""}
            {!c.isRange && !c.boosted && c.walletRoute && c.funding?.ok && c.funding.venueCreditUsedBase > 0n ? ` ${TICKET.creditNote(money(c.funding.venueCreditUsedBase))}` : ""}
            {c.session.isConnected && c.depositBase > 0n ? ` ${TICKET.seatDeposit(money(c.depositBase))}` : ""}
          </Text>
        </>
      )}
    </TicketDrawer>
  );
}

const styles = StyleSheet.create({
  depth: { alignSelf: "flex-start" },
  depthText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22.5 },
});
