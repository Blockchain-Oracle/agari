import { formatCadence } from "@agari/core/market";
import { RANGE_STAKE_HEADROOM_BPS, type MoonshotCall, type RangeReserveState } from "@agari/core/range";
import type { Diagnosis, EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil } from "@agari/core/units";
import type { MoonshotQuote, RangeCapacity } from "@agari/markets/range";
import { StyleSheet, Text, View } from "react-native";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { formatMultiplierTenths, formatProbE6, usdBand, utilizationPct } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { diagnosisCopy } from "@/lib/copy";
import { FONT } from "~/theme";
import { useRangeTokens } from "../range/PageParts";
import { breakdownStyles } from "../range/RangeTicket";
import { AmountField, Clock, ErrorBlock, Footnote, Need, Pays, PlaceButton, Profit, QuoteErr, Row, Solver, TicketFrame, TxLink, type PlaceStep } from "../range/TicketParts";

export interface MoonshotTicketProps {
  window: EventMarket | null;
  call: MoonshotCall;
  reserve: RangeReserveState;
  symbol: string;
  nowMs: number;
  quote: MoonshotQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  onRetryQuote: () => void;
  /** The reserve's answer for this round's lock on this expiry; null while it is being read. */
  capacity: RangeCapacity | null;
  /** This rung's payout ceiling — the product's cap under the contract's — known before any quote. */
  capBase: bigint;
  /** "Set payout" typed over the cap: the chain is not asked, and one tap sets the field to the cap. */
  overCap: boolean;
  onUseCap: () => void;
  /** What "Set stake" asked for, so the ticket can say when the cap took less than that. */
  stakeBase: bigint;
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  walletSpendableBase: bigint | null;
  step: PlaceStep;
  errorTitle: string;
  errorDetail: string;
  txHash: Signature | null;
  onPlace: () => void;
  onReset: () => void;
}

/** The strike's distance from the opening print in hundredths of a percent, from the two prints, no float. */
function distancePct(strikePrint: bigint, openingPrint: bigint): { text: string; above: boolean } {
  const bps = ((strikePrint - openingPrint) * 10_000n) / openingPrint;
  const magnitude = bps < 0n ? -bps : bps;
  const frac = (magnitude % 100n).toString().padStart(2, "0");
  return { text: `${magnitude / 100n}.${frac}`, above: strikePrint >= openingPrint };
}

/**
 * web's `moonshot/MoonshotTicket.tsx`, in the parlay ticket's grammar: the contract's multiple, the solved level and
 * how far it sits, the solver, the breakdown, the caps and the liability line, the place control (the wallet asks
 * to sign on the tap), the footnotes, the error block and the transaction.
 */
export function MoonshotTicket(props: MoonshotTicketProps) {
  const { r, color } = useRangeTokens();
  const { window: w, call, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, capacity, capBase, overCap, onUseCap, stakeBase, solveMode, onSolveMode } = props;
  const { stakeInput, onStakeInput, payoutInput, onPayoutInput, walletSpendableBase, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  const { ticket } = MOONSHOT;
  const { decimals, params } = reserve;
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const whole = (base: bigint) => formatBaseUnits(base, decimals, { maxDp: 0, minDp: 0 });
  const stakeText = quote ? money(quote.quote.stakeBase) : "···";
  const payoutText = quote ? money(quote.quote.maxPayoutBase) : "···";
  const fits = capacity === null || capacity.fits;
  const hasEnough = walletSpendableBase !== null && quote !== null && walletSpendableBase >= quote.quote.stakeBase;
  const distance = quote ? distancePct(quote.band.strikePrint, quote.openingPrint) : null;
  const room = capacity ? (params.maxExpiryLockedBase > capacity.lockedByExpiryBase ? params.maxExpiryLockedBase - capacity.lockedByExpiryBase : 0n) : null;
  // "Set stake" ran into the cap: the contract's stake for the capped payout is below what was typed.
  const cappedStake = solveMode === "fixStake" && quote !== null && quote.quote.maxPayoutBase === capBase && quote.quote.stakeBase < stakeBase;
  const labels = { ...ticket, insufficient: (s: string) => (fits ? ticket.insufficient(s) : ticket.wontFit) };
  const liability = [
    capBase < params.maxPayoutCapBase ? ticket.capRung(call.multiple, whole(capBase), symbol) : ticket.capContract(whole(capBase), symbol),
    ...(cappedStake && quote ? [ticket.cappedStake(money(quote.quote.stakeBase), whole(capBase), symbol)] : []),
    `${quote ? `${ticket.locks(money(quote.houseLockedBase), symbol)} ` : ""}${room === null ? ticket.expiryReading : ticket.expiryRoom(money(room), whole(params.maxExpiryLockedBase), symbol)}`,
  ];

  return (
    <TicketFrame title={ticket.title} tag={ticket.tag}>
      {!w ? (
        <Need>{ticket.needWindow}</Need>
      ) : (
        <>
          <Pays label={ticket.pays} loading={quoteLoading} multiple={quote ? formatMultiplierTenths(quote.quote.multiplierMilli) : null} sub={quote ? ticket.odds(formatProbE6(quote.quote.insideProbE6), call.direction, usdBand(quote.band.strikePrint)) : null} />

          <Solver labels={ticket} solveMode={solveMode} onSolveMode={onSolveMode}>
            {solveMode === "fixStake" ? (
              <AmountField label={ticket.youPay} value={stakeInput} onChange={onStakeInput} symbol={symbol} hint={walletSpendableBase !== null ? ticket.wallet(money(walletSpendableBase), symbol) : undefined} />
            ) : (
              <AmountField label={ticket.youWin} value={payoutInput} onChange={onPayoutInput} symbol={symbol} hint={ticket.ifLands} />
            )}
            <View style={styles.rows}>
              <Row label={ticket.youPay} emphasize>
                {quoteLoading ? "…" : quote ? `${stakeText} ${symbol}` : "···"}
              </Row>
              <Row label={ticket.youWin} accent>
                {quoteLoading ? "…" : quote ? `${payoutText} ${symbol}` : "···"}
              </Row>
              <Profit>{quote ? ticket.profit(money(quote.quote.maxPayoutBase - quote.quote.stakeBase), symbol) : null}</Profit>
            </View>
          </Solver>

          <View style={styles.breakdown}>
            <View style={styles.bdRow}>
              <Text style={[styles.bdWhat, { color: color.inkMuted }]}>
                <Text style={[styles.side, { color: color.accent }]}>{(quote ? ticket.target(call.direction, usdBand(quote.band.strikePrint)) : MOONSHOT.aim.valueText(call.direction, call.multiple)).toUpperCase()}</Text>
                <Text style={{ color: r.gray700 }}>
                  {" "}
                  · {w.asset} {formatCadence(w.intervalSec)} · <Clock expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
                </Text>
              </Text>
              <Text style={[styles.bdProb, { color: color.inkSecondary }]}>{w.openingPriceRaw !== null ? usdBand(w.openingPriceRaw) : "·"}</Text>
            </View>
            {distance ? <Text style={[styles.bdWhat, { color: color.inkMuted }]}>{ticket.distance(distance.text, distance.above)}</Text> : null}
          </View>

          <Text style={[styles.liability, { color: color.inkMuted }]}>{liability.join("\n")}</Text>

          {overCap ? <QuoteErr onPress={onUseCap}>{`${ticket.overCap(call.multiple, whole(capBase), symbol)} · ${ticket.useCap}`}</QuoteErr> : null}
          {capacity && !capacity.fits && capacity.refusal ? <QuoteErr>{diagnosisCopy(capacity.refusal.kind).headline}</QuoteErr> : null}
          {quoteError ? <QuoteErr onPress={onRetryQuote}>{`${diagnosisCopy(quoteError.kind).headline} · ${ticket.retry}`}</QuoteErr> : null}

          <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough && fits} stakeText={stakeText} symbol={symbol} onPlace={onPlace} labels={labels} />

          <Footnote
            lines={[
              ticket.footnote,
              ...(quote ? [ticket.upTo(money(mulBpsCeil(quote.quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS)), symbol)] : []),
              reserve.paused ? ticket.reservePaused : ticket.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps)),
            ]}
          />

          {step === "error" && errorTitle ? <ErrorBlock title={errorTitle} detail={errorDetail} onReset={onReset} labels={ticket} /> : null}
          {step === "success" && txHash ? <TxLink txHash={txHash} label={ticket.viewTx} /> : null}
        </>
      )}
    </TicketFrame>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 6, paddingTop: 4 },
  breakdown: { gap: 4 },
  ...breakdownStyles,
  liability: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
