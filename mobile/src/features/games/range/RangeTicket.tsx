import { formatCadence } from "@agari/core/market";
import type { RangeQuote, RangeReserveState, RangeSide } from "@agari/core/range";
import type { Diagnosis, EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { formatMultiplierTenths, formatProbE6, usdBand, usdOnGrid, utilizationPct } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { diagnosisCopy } from "@/lib/copy";
import { FONT } from "~/theme";
import { useRangeTokens } from "./PageParts";
import { AmountField, Clock, ErrorBlock, Footnote, Need, Pays, PlaceButton, Profit, QuoteErr, Row, Solver, TicketFrame, TxLink, type PlaceStep } from "./TicketParts";

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
  step: PlaceStep;
  errorTitle: string;
  errorDetail: string;
  txHash: Signature | null;
  onPlace: () => void;
  onReset: () => void;
}

/** Whole dollars where the asset trades in the tens of thousands; cents on ETH's $0.20 grid. */
const usd = (n: number) => usdOnGrid(n, n < 10_000 ? 2 : 0);

/**
 * web's `range/RangeTicket.tsx`, in the parlay ticket's grammar: the multiple, the solver, the breakdown, the place
 * control (the wallet asks to sign on the tap, as web's does), the footnotes, the error block and the transaction.
 */
export function RangeTicket(props: RangeTicketProps) {
  const { r, color } = useRangeTokens();
  const { window: w, side, lowUsd, highUsd, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, solveMode, onSolveMode } = props;
  const { stakeInput, onStakeInput, payoutInput, onPayoutInput, walletSpendableBase, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  const { ticket } = RANGE;
  const { decimals } = reserve;
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const stakeText = quote ? money(quote.stakeBase) : "···";
  const payoutText = quote ? money(quote.maxPayoutBase) : "···";
  const hasEnough = walletSpendableBase !== null && quote !== null && walletSpendableBase >= quote.stakeBase;
  const sideProbE6 = quote ? (side === "inside" ? quote.insideProbE6 : 1_000_000n - quote.insideProbE6) : null;

  return (
    <TicketFrame title={ticket.title} tag={ticket.tag}>
      {!w || lowUsd === null || highUsd === null ? (
        <Need>{ticket.needBand}</Need>
      ) : (
        <>
          <Pays label={ticket.pays} loading={quoteLoading} multiple={quote ? formatMultiplierTenths(quote.multiplierMilli) : null} sub={quote && sideProbE6 !== null ? ticket.odds(formatProbE6(sideProbE6), side) : null} />

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
              <Profit>{quote ? ticket.profit(money(quote.maxPayoutBase - quote.stakeBase), symbol) : null}</Profit>
            </View>
          </Solver>

          <View style={styles.bdRow}>
            <Text style={[styles.bdWhat, { color: color.inkMuted }]}>
              <Text style={[styles.side, { color: color.accent }]}>{side.toUpperCase()}</Text> {usd(lowUsd)} – {usd(highUsd)}
              <Text style={{ color: r.gray700 }}>
                {" "}
                · {w.asset} {formatCadence(w.intervalSec)} · <Clock expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
              </Text>
            </Text>
            <Text style={[styles.bdProb, { color: color.inkSecondary }]}>{w.openingPriceRaw !== null ? usdBand(w.openingPriceRaw) : "·"}</Text>
          </View>

          {quoteError ? <QuoteErr onPress={onRetryQuote}>{`${diagnosisCopy(quoteError.kind).headline} · ${ticket.retry}`}</QuoteErr> : null}

          <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough} stakeText={stakeText} symbol={symbol} onPlace={onPlace} labels={ticket} />

          <Footnote lines={[ticket.footnote, reserve.paused ? ticket.reservePaused : ticket.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps))]} />

          {step === "error" && errorTitle ? <ErrorBlock title={errorTitle} detail={errorDetail} onReset={onReset} labels={ticket} /> : null}
          {step === "success" && txHash ? <TxLink txHash={txHash} label={ticket.viewTx} /> : null}
        </>
      )}
    </TicketFrame>
  );
}

/** `.pl-breakdown` rows, shared with the Moonshot ticket. */
export const breakdownStyles = StyleSheet.create({
  bdRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  bdWhat: { flexShrink: 1, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  side: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 0.88 },
  bdProb: { marginLeft: "auto", fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});

const styles = StyleSheet.create({
  rows: { gap: 6, paddingTop: 4 },
  ...breakdownStyles,
});
