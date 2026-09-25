import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { plainCells } from "@/features/markets/ticket/readout-cells";
import type { TicketSelection } from "@/features/markets/ticket/types";
import { useScheduleTicket } from "@/features/markets/ticket/useScheduleTicket";
import { PREOPEN, TICKET } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { haptic } from "~/components/kit";
import { AccountGate } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { BetAgainstToggle, SideSegments, TkSwitch } from "./Controls";
import { OutcomeNote, RegionNote } from "./OutcomeNote";
import { PriceControl } from "./PriceControl";
import { ReadoutStrip } from "./Readout";
import { ScheduledCall } from "./ScheduledCall";
import { BlockedButton } from "./TicketButton";
import { TicketDrawer } from "./TicketDrawer";
import { tkType, useTk } from "./tk";

/**
 * web's ScheduleTicket (D-088) in the phone drawer: on a Window listed before its bell, a post-only call rests at the
 * user's own price — the same panel block for block (side · amount · the price · the strip the chain will hold · the
 * gates · rest until lock · the CTA · the footnote), and once it rests, the receipt with its Cancel.
 */
export function ScheduleTicket({ selection }: { selection: TicketSelection }) {
  const tk = useTk();
  const when = useWhen();
  const s = useScheduleTicket(selection);
  const { t, symbol, quote } = s;
  const { market, side, stakeBase, phase } = t;
  const decimals = market.decimals;
  const rested = s.bet.state.outcome?.status === "resting" ? s.bet.state.outcome.rested : null;
  const caption = quote ? (s.restUntil === "lock" ? PREOPEN.ticket.restsUntilLock(s.priceCents) : PREOPEN.ticket.rests(s.priceCents)) : s.gridReady ? PREOPEN.ticket.sizing : PREOPEN.ticket.reading;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const reset = () => {
    s.bet.reset();
    t.setStakeText("");
  };

  return (
    <TicketDrawer market={market} phase={phase} nowMs={t.nowMs}>
      {rested ? (
        <ScheduledCall rested={rested} market={market} decimals={decimals} onAnother={reset} />
      ) : (
        <>
          <View style={styles.caption}>
            <Text style={[tkType.caption, { color: tk.caption }]}>{PREOPEN.ticket.listed(when(market.tradingStartSec))}</Text>
          </View>
          <SideSegments side={side} onSelect={t.selectSide} />
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
          <AccountGate session={s.session} balanceSource="wallet" availableBase={s.availableBase} stakeBase={quote?.maxCostBase ?? stakeBase} depositBase={s.depositBase} decimals={decimals} symbol={symbol} route={null} />
          <View style={styles.restUntil}>
            <Text style={[tkType.body, styles.grow, { color: tk.inkSecondary }]}>{PREOPEN.ticket.untilLock}</Text>
            <TkSwitch
              on={s.restUntil === "lock"}
              label={PREOPEN.ticket.untilLock}
              onChange={(on) => {
                haptic.select();
                s.setRestUntil(on ? "lock" : "bell");
              }}
            />
          </View>
          <Text style={[tkType.caption, styles.restNote, { color: tk.caption }]}>{PREOPEN.ticket.untilLockNote}</Text>
          <OutcomeNote state={s.bet.state} decimals={decimals} symbol={symbol} onDismiss={s.bet.reset} />
          <BlockedButton blocker={s.blocker} ctx={s.ctx} tone={side ?? "primary"} label={side && quote ? `${PREOPEN.ticket.cta(SIDE_WORD[side])} ${money(quote.maxCostBase)}` : PREOPEN.ticket.ctaPlain} onPress={s.place} />
          {s.blocker === "region" ? <RegionNote /> : null}
          <Text style={[tkType.caption, { color: tk.foot }]}>
            {PREOPEN.ticket.footnote(s.bondText)}
            {s.session.isConnected && s.depositBase > 0n ? ` ${TICKET.seatDeposit(money(s.depositBase))}` : ""}
          </Text>
        </>
      )}
    </TicketDrawer>
  );
}

const styles = StyleSheet.create({
  caption: { minHeight: 28, marginTop: -4 },
  restUntil: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  grow: { flex: 1 },
  // web's `.tk-note` (-8) and `.tk-rest-until-note` (-6): the later rule wins.
  restNote: { marginTop: -6 },
});
