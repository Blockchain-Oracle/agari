"use client";

import type { RangeQuote, RangeReserveState, RangeSide } from "@masayume/core/range";
import type { Diagnosis, EventMarket, Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import { formatCadence } from "@masayume/core/market";
import { Loader2 } from "lucide-react";
import { Countdown } from "@/components/data";
import { diagnosisCopy } from "@/lib/copy";
import { AmountField, ErrorBlock, PlaceButton, Row, type PlaceStep } from "../parlay/TicketParts";
import { RANGE } from "./copy";
import { formatMultiplierTenths, formatProbE6, usd0, usdOnGrid, utilizationPct } from "./format";

export type SolveMode = "fixStake" | "fixPayout";

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
  txHash: Hex | null;
  onPlace: () => void;
  onReset: () => void;
}

/** The reference's whole dollars where the asset trades in the tens of thousands; cents on ETH's $0.20 grid. */
const usd = (n: number) => usdOnGrid(n, n < 10_000 ? 2 : 0);

/** The band's ticket in the parlay ticket's grammar: the multiple, the solver, the breakdown, the place control, the footnotes. */
export function RangeTicket(props: RangeTicketProps) {
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
    <div className="pl-ticket-col">
      <div className="pl-ticket">
        <div className="pl-ticket-head">
          <span className="pl-ticket-title">{ticket.title}</span>
          <span className="pl-ticket-tag">{ticket.tag}</span>
        </div>

        <div className="pl-ticket-body">
          {!w || lowUsd === null || highUsd === null ? (
            <p className="pl-need2">{ticket.needBand}</p>
          ) : (
            <>
              <div className="pl-pays">
                <div className="pl-pays-label">{ticket.pays}</div>
                <div className="pl-pays-x">{quoteLoading ? <Loader2 className="animate-spin" /> : quote ? formatMultiplierTenths(quote.multiplierMilli) : "···"}</div>
                {quote && !quoteLoading && sideProbE6 !== null && <div className="pl-pays-sub">{ticket.odds(formatProbE6(sideProbE6), side)}</div>}
              </div>

              <div className="pl-solver">
                <div className="pl-modes">
                  <button type="button" onClick={() => onSolveMode("fixStake")} className="pl-mode" aria-pressed={solveMode === "fixStake"} data-cursor="hover">
                    {ticket.setStake}
                  </button>
                  <button type="button" onClick={() => onSolveMode("fixPayout")} className="pl-mode" aria-pressed={solveMode === "fixPayout"} data-cursor="hover">
                    {ticket.setPayout}
                  </button>
                </div>

                {solveMode === "fixStake" ? (
                  <AmountField label={ticket.youPay} value={stakeInput} onChange={onStakeInput} symbol={symbol} hint={walletSpendableBase !== null ? ticket.wallet(money(walletSpendableBase), symbol) : undefined} />
                ) : (
                  <AmountField label={ticket.youWin} value={payoutInput} onChange={onPayoutInput} symbol={symbol} hint={ticket.ifLands} />
                )}

                <div className="pl-rows">
                  <Row label={ticket.youPay} emphasize>
                    {quoteLoading ? "…" : quote ? `${stakeText} ${symbol}` : "···"}
                  </Row>
                  <Row label={ticket.youWin} accent>
                    {quoteLoading ? "…" : quote ? `${payoutText} ${symbol}` : "···"}
                  </Row>
                  <div className="pl-profit">{quote && <span>{ticket.profit(money(quote.maxPayoutBase - quote.stakeBase), symbol)}</span>}</div>
                </div>
              </div>

              <div className="pl-breakdown">
                <div className="pl-bd-row">
                  <span className="pl-bd-what">
                    <span className="rg-card-side">{side}</span> {usd(lowUsd)} – {usd(highUsd)}
                    <span className="pl-bd-when">
                      {" "}
                      · {w.asset} {formatCadence(w.intervalSec)} · <Countdown expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
                    </span>
                  </span>
                  <span className="pl-bd-prob">{w.openingPriceRaw !== null ? usd0(w.openingPriceRaw) : "·"}</span>
                </div>
              </div>

              {quoteError && (
                <button type="button" onClick={onRetryQuote} className="pl-quote-err" title={quoteError.technical}>
                  {diagnosisCopy(quoteError.kind).headline} · {ticket.retry}
                </button>
              )}

              <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough} stakeText={stakeText} symbol={symbol} onPlace={onPlace} labels={ticket} />

              <p className="pl-footnote">
                {ticket.footnote}
                <br />
                {reserve.paused ? ticket.reservePaused : ticket.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps))}
              </p>

              {step === "error" && errorTitle && <ErrorBlock title={errorTitle} detail={errorDetail} onReset={onReset} labels={ticket} />}

              {step === "success" && txHash && (
                <a href={txUrl(txHash)} target="_blank" rel="noopener noreferrer" className="pl-txlink pl-fade">
                  {ticket.viewTx}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
