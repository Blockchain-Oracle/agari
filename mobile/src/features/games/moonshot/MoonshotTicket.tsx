import { formatCadence } from "@agari/core/market";
import { type MoonshotCall, type RangeReserveState } from "@agari/core/range";
import type { Diagnosis, EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import type { MoonshotQuote, RangeCapacity } from "@agari/markets/range";
import { StyleSheet, Text, View } from "react-native";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { formatMultiplierTenths, formatProbE6, usdBand, utilizationPct } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { diagnosisCopy } from "@/lib/copy";
import { Button, Card, Row, Rows, SignReview, type QuoteLine } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { PlaceError, Placed, Pays, Solver, sentStakeCapBase, type PlaceStep } from "../range/TicketParts";
import { Clock } from "../range/WindowPicker";

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
  capBase: bigint;
  overCap: boolean;
  onUseCap: () => void;
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
 * web's `moonshot/MoonshotTicket.tsx`: the contract's multiple, the solved level and how far it sits, the solver,
 * the caps and the house's liability, then the kit's SignReview with the maximum loss (the stake cap the open
 * carries). The reserve's caps are asked before the slide, so a round that will not fit says so here, not as a revert.
 */
export function MoonshotTicket(props: MoonshotTicketProps) {
  const { color } = useTheme();
  const { window: w, call, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, capacity, capBase, overCap, onUseCap, stakeBase, solveMode } = props;
  const { walletSpendableBase, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  const { ticket } = MOONSHOT;
  const { decimals, params } = reserve;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const whole = (base: bigint) => formatBaseUnits(base, decimals, { maxDp: 0, minDp: 0 });

  if (!w) {
    return (
      <Card>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ticket.needWindow}</Text>
      </Card>
    );
  }

  const target = quote ? ticket.target(call.direction, usdBand(quote.band.strikePrint)) : MOONSHOT.aim.valueText(call.direction, call.multiple);
  if (step === "success") {
    return <Placed title={ticket.placed} line={`${target} · ${w.asset} ${formatCadence(w.intervalSec)}`} txHash={txHash} viewTx={ticket.viewTx} another="Fire another" onAnother={onReset} />;
  }

  const fits = capacity === null || capacity.fits;
  const distance = quote ? distancePct(quote.band.strikePrint, quote.openingPrint) : null;
  const room = capacity ? (params.maxExpiryLockedBase > capacity.lockedByExpiryBase ? params.maxExpiryLockedBase - capacity.lockedByExpiryBase : 0n) : null;
  const cappedStake = solveMode === "fixStake" && quote !== null && quote.quote.maxPayoutBase === capBase && quote.quote.stakeBase < stakeBase;
  const maxStakeBase = quote ? sentStakeCapBase(quote.quote.stakeBase) : null;
  const hasEnough = walletSpendableBase !== null && maxStakeBase !== null && walletSpendableBase >= maxStakeBase;
  const blocker = reserve.paused
    ? ticket.reservePaused
    : overCap
      ? ticket.overCap(call.multiple, whole(capBase), symbol)
      : quoteLoading
        ? ticket.pricing
        : quoteError
          ? ticket.unavailable
          : !quote
            ? ticket.build
            : !fits
              ? ticket.wontFit
              : !hasEnough
                ? ticket.insufficient(symbol)
                : null;
  const lines: QuoteLine[] = quote
    ? [
        { label: "Target", value: target },
        { label: "Window", value: `${w.asset} ${formatCadence(w.intervalSec)}` },
        { label: ticket.pays, value: formatMultiplierTenths(quote.quote.multiplierMilli), tone: "accent" },
        { label: "Payout if it lands", value: money(quote.quote.maxPayoutBase), tone: "profit", hint: "Sent exactly: the round pays this or nothing" },
        { label: "Priced now", value: money(quote.quote.stakeBase), hint: "The chain prices the call again as it lands and charges that price" },
        { label: "Most it can charge", value: money(sentStakeCapBase(quote.quote.stakeBase)), hint: "Sent exactly: a higher price is refused, not charged" },
      ]
    : [];

  return (
    <Card>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{ticket.title}</Text>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{ticket.tag}</Text>
      </View>
      <Pays
        label={ticket.pays}
        loading={quoteLoading}
        multiple={quote ? formatMultiplierTenths(quote.quote.multiplierMilli) : null}
        sub={quote ? ticket.odds(formatProbE6(quote.quote.insideProbE6), call.direction, usdBand(quote.band.strikePrint)) : null}
      />
      <Solver
        labels={ticket}
        solveMode={solveMode}
        onSolveMode={props.onSolveMode}
        stakeInput={props.stakeInput}
        onStakeInput={props.onStakeInput}
        payoutInput={props.payoutInput}
        onPayoutInput={props.onPayoutInput}
        symbol={symbol}
        walletHint={walletSpendableBase !== null ? ticket.wallet(formatBaseUnits(walletSpendableBase, decimals), symbol) : undefined}
      />
      <Rows>
        <Row label={ticket.youPay} value={quoteLoading ? "…" : quote ? money(quote.quote.stakeBase) : "···"} strong />
        <Row label={ticket.youWin} value={quoteLoading ? "…" : quote ? money(quote.quote.maxPayoutBase) : "···"} tone="accent" />
        {quote ? <Text style={[TYPE.caption, { color: color.profit }]}>{ticket.profit(formatBaseUnits(quote.quote.maxPayoutBase - quote.quote.stakeBase, decimals), symbol)}</Text> : null}
      </Rows>

      <View style={styles.breakdown}>
        <View style={styles.what}>
          <Text style={[TYPE.data, { color: call.direction === "long" ? color.profit : color.loss }]}>{target}</Text>
          <View style={styles.when}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {w.asset} {formatCadence(w.intervalSec)} ·{" "}
            </Text>
            <Clock expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
          </View>
          {distance ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ticket.distance(distance.text, distance.above)}</Text> : null}
        </View>
        <Text style={[TYPE.data, { color: color.inkMuted }]}>{w.openingPriceRaw !== null ? usdBand(w.openingPriceRaw) : "·"}</Text>
      </View>

      <View style={[styles.liability, { backgroundColor: color.surface2 }]}>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {capBase < params.maxPayoutCapBase ? ticket.capRung(call.multiple, whole(capBase), symbol) : ticket.capContract(whole(capBase), symbol)}
        </Text>
        {cappedStake && quote ? <Text style={[TYPE.caption, { color: color.warning }]}>{ticket.cappedStake(formatBaseUnits(quote.quote.stakeBase, decimals), whole(capBase), symbol)}</Text> : null}
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {quote ? `${ticket.locks(formatBaseUnits(quote.houseLockedBase, decimals), symbol)} ` : ""}
          {room === null ? ticket.expiryReading : ticket.expiryRoom(formatBaseUnits(room, decimals), whole(params.maxExpiryLockedBase), symbol)}
        </Text>
      </View>

      {overCap ? <Button label={`${ticket.overCap(call.multiple, whole(capBase), symbol)} · ${ticket.useCap}`} variant="secondary" size="sm" onPress={onUseCap} /> : null}
      {capacity && !capacity.fits && capacity.refusal ? <Text style={[TYPE.caption, { color: color.loss }]}>{diagnosisCopy(capacity.refusal.kind).headline}</Text> : null}
      {quoteError ? <Button label={`${diagnosisCopy(quoteError.kind).headline} · ${ticket.retry}`} variant="destructive" size="sm" onPress={onRetryQuote} /> : null}
      {step === "error" && errorTitle ? <PlaceError title={errorTitle} detail={errorDetail} onReset={onReset} tryAgain={ticket.tryAgain} txHash={txHash} /> : null}

      <SignReview
        title={quote ? ticket.place(formatBaseUnits(quote.quote.stakeBase, decimals), symbol) : ticket.build}
        lines={lines}
        maxLoss={maxStakeBase !== null ? money(maxStakeBase) : "—"}
        confirmLabel="Slide to fire"
        onConfirm={onPlace}
        phase={step === "placing" ? "signing" : "review"}
        blocker={step === "placing" ? null : blocker}
        tone={call.direction === "long" ? "profit" : "loss"}
      />
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {ticket.footnote}
        {"\n"}
        {reserve.paused ? ticket.reservePaused : ticket.reserve(formatBaseUnits(reserve.liquidBase, decimals), symbol, utilizationPct(reserve.utilizationBps))}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between" },
  breakdown: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  what: { flex: 1, gap: 2 },
  when: { flexDirection: "row", alignItems: "center" },
  liability: { borderRadius: 8, padding: 12, gap: 4 },
});
