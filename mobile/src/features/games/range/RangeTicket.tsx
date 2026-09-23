import { formatCadence } from "@agari/core/market";
import { type RangeQuote, type RangeReserveState, type RangeSide } from "@agari/core/range";
import type { Diagnosis, EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { formatMultiplierTenths, formatProbE6, usdBand, usdOnGrid, utilizationPct } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { diagnosisCopy } from "@/lib/copy";
import { Button, Card, Row, Rows, SignReview, type QuoteLine } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Clock } from "./WindowPicker";
import { PlaceError, Placed, Pays, Solver, sentStakeCapBase, type PlaceStep } from "./TicketParts";

export interface RangeTicketProps {
  window: EventMarket | null;
  side: RangeSide;
  lowUsd: number | null;
  highUsd: number | null;
  reserve: RangeReserveState;
  symbol: string;
  nowMs: number;
  quote: RangeQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  onRetryQuote: () => void;
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  walletSpendableBase: bigint | null;
  /** The band is being dragged: the quote waits for the finger to lift. */
  dragging: boolean;
  step: PlaceStep;
  errorTitle: string;
  errorDetail: string;
  txHash: Signature | null;
  onPlace: () => void;
  onReset: () => void;
}

/** Whole dollars where the asset trades in the tens of thousands; cents on a $0.20 grid. */
const usd = (n: number) => usdOnGrid(n, n < 10_000 ? 2 : 0);

/**
 * web's `range/RangeTicket.tsx`: the contract's multiple, the solver, what you pay and win, the band on its Window,
 * then the kit's SignReview — the exact figures, the maximum loss (the stake cap the open carries, quote + headroom)
 * and a slide. A blocked ticket names why on the review itself; the reserve's own state is the footnote.
 */
export function RangeTicket(props: RangeTicketProps) {
  const { color } = useTheme();
  const { window: w, side, lowUsd, highUsd, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote } = props;
  const { walletSpendableBase, dragging, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  const { ticket } = RANGE;
  const { decimals } = reserve;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;

  if (!w || lowUsd === null || highUsd === null) {
    return (
      <Card>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ticket.needBand}</Text>
      </Card>
    );
  }

  const bandText = `${side} ${usd(lowUsd)} – ${usd(highUsd)}`;
  if (step === "success") {
    return <Placed title={ticket.placed} line={RANGE.cta.placed(bandText)} txHash={txHash} viewTx={ticket.viewTx} another={RANGE.cta.another} onAnother={onReset} />;
  }

  const sideProbE6 = quote ? (side === "inside" ? quote.insideProbE6 : 1_000_000n - quote.insideProbE6) : null;
  const maxStakeBase = quote ? sentStakeCapBase(quote.stakeBase) : null;
  const hasEnough = walletSpendableBase !== null && maxStakeBase !== null && walletSpendableBase >= maxStakeBase;
  const blocker = reserve.paused
    ? ticket.reservePaused
    : dragging
      ? ticket.releaseToPrice
      : quoteLoading
        ? ticket.pricing
        : quoteError
          ? ticket.unavailable
          : !quote
            ? ticket.enterAmount
            : !hasEnough
              ? ticket.insufficient(symbol)
              : null;
  const lines: QuoteLine[] = quote
    ? [
        { label: "Band", value: bandText },
        { label: "Window", value: `${w.asset} ${formatCadence(w.intervalSec)}` },
        { label: ticket.pays, value: formatMultiplierTenths(quote.multiplierMilli), tone: "accent" },
        { label: "Payout if it lands", value: money(quote.maxPayoutBase), tone: "profit", hint: "Sent exactly: the round pays this or nothing" },
        { label: "Priced now", value: money(quote.stakeBase), hint: "The chain prices the band again as it lands and charges that price" },
        { label: "Most it can charge", value: money(sentStakeCapBase(quote.stakeBase)), hint: "Sent exactly: a higher price is refused, not charged" },
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
        multiple={quote ? formatMultiplierTenths(quote.multiplierMilli) : null}
        sub={quote && sideProbE6 !== null ? ticket.odds(formatProbE6(sideProbE6), side) : null}
      />
      <Solver
        labels={ticket}
        solveMode={props.solveMode}
        onSolveMode={props.onSolveMode}
        stakeInput={props.stakeInput}
        onStakeInput={props.onStakeInput}
        payoutInput={props.payoutInput}
        onPayoutInput={props.onPayoutInput}
        symbol={symbol}
        walletHint={walletSpendableBase !== null ? ticket.wallet(formatBaseUnits(walletSpendableBase, decimals), symbol) : undefined}
      />
      <Rows>
        <Row label={ticket.youPay} value={quoteLoading ? "…" : quote ? money(quote.stakeBase) : "···"} strong />
        <Row label={ticket.youWin} value={quoteLoading ? "…" : quote ? money(quote.maxPayoutBase) : "···"} tone="accent" />
        {quote ? <Text style={[TYPE.caption, { color: color.profit }]}>{ticket.profit(formatBaseUnits(quote.maxPayoutBase - quote.stakeBase, decimals), symbol)}</Text> : null}
      </Rows>
      <View style={styles.breakdown}>
        <View style={styles.what}>
          <Text style={[TYPE.data, { color: color.ink }]}>{bandText}</Text>
          <View style={styles.when}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {w.asset} {formatCadence(w.intervalSec)} ·{" "}
            </Text>
            <Clock expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
          </View>
        </View>
        <Text style={[TYPE.data, { color: color.inkMuted }]}>{w.openingPriceRaw !== null ? usdBand(w.openingPriceRaw) : "·"}</Text>
      </View>

      {quoteError ? <Button label={`${diagnosisCopy(quoteError.kind).headline} · ${ticket.retry}`} variant="destructive" size="sm" onPress={onRetryQuote} /> : null}

      {step === "error" && errorTitle ? <PlaceError title={errorTitle} detail={errorDetail} onReset={onReset} tryAgain={ticket.tryAgain} txHash={txHash} /> : null}

      <SignReview
        title={RANGE.cta.place(usd(lowUsd), usd(highUsd)).replace(" →", "")}
        lines={lines}
        maxLoss={maxStakeBase !== null ? money(maxStakeBase) : "—"}
        confirmLabel="Slide to place range"
        onConfirm={onPlace}
        phase={step === "placing" ? "signing" : "review"}
        blocker={step === "placing" ? null : blocker}
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
  breakdown: { flexDirection: "row", alignItems: "center", gap: 10 },
  what: { flex: 1, gap: 2 },
  when: { flexDirection: "row", alignItems: "center" },
});
