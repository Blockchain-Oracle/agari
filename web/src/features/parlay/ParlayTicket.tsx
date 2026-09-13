"use client";

import type { ParlayQuote, ParlayReserveState } from "@masayume/core/parlay";
import type { Diagnosis, EventMarket, Hex } from "@masayume/core/types";
import { formatBaseUnits, oneUnit, parseDecimalToBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import { AlertCircle, Loader2, Trophy } from "lucide-react";
import { Countdown } from "@/components/data";
import { diagnosisCopy } from "@/lib/copy";
import { formatCadence } from "@masayume/core/market";
import { cn } from "@/lib/utils";
import { PARLAY } from "./copy";
import { formatBpsPct, formatLine, formatMultiplier, formatProbPct, parseThinBook, utilizationPct } from "./format";
import type { DraftLeg } from "./LegRow";
import { AmountField, ErrorBlock, PlaceButton, Row, type PlaceStep } from "./TicketParts";

export type SolveMode = "fixStake" | "fixPayout";

export interface ParlayTicketProps {
  legs: readonly DraftLeg[];
  marketOf: (leg: DraftLeg) => EventMarket | null;
  reserve: ParlayReserveState;
  symbol: string;
  nowMs: number;
  quote: ParlayQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  onRetryQuote: () => void;
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  /** null until the wallet's sheet answers. */
  walletSpendableBase: bigint | null;
  step: PlaceStep;
  errorTitle: string;
  errorDetail: string;
  txHash: Hex | null;
  onPlace: () => void;
  onReset: () => void;
}

/** The combined ticket (`ParlayBuilder.tsx` L341–546): the multiplier, the solver, the breakdown, the place control, the footnotes. */
export function ParlayTicket(props: ParlayTicketProps) {
  const { legs, marketOf, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, solveMode, onSolveMode } = props;
  const { stakeInput, onStakeInput, payoutInput, onPayoutInput, walletSpendableBase, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  // The reserve's ThinBook names a Window; the row it belongs to and its two figures go on the line, not in a tooltip.
  const thin = parseThinBook(quoteError);
  const thinLeg = thin ? legs.findIndex((leg) => leg.marketId.toLowerCase() === thin.marketId.toLowerCase()) : -1;
  const contracts = (raw: bigint) => formatBaseUnits(raw, reserve.decimals, { minDp: 0, maxDp: 2 });
  const { ticket } = PARLAY;
  const { decimals } = reserve;
  const one = oneUnit(decimals);
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const stakeText = quote ? money(quote.stakeBase) : "···";
  const payoutText = quote ? money(quote.maxPayoutBase) : "···";
  // The reference (L220–221) needs the typed stake when no quote exists, so an empty field or a paused reserve reads
  // "Build your parlay", never "Insufficient".
  const needBase = quote ? quote.stakeBase : (parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n);
  const hasEnough = walletSpendableBase !== null && walletSpendableBase >= needBase;

  return (
    <div className="pl-ticket-col">
      <div className="pl-ticket">
        <div className="pl-ticket-head">
          <span className="pl-ticket-title">{ticket.title}</span>
          <span className="pl-ticket-tag">{ticket.tag}</span>
        </div>

        <div className="pl-ticket-body">
          {legs.length < 2 ? (
            <p className="pl-need2">{ticket.needTwo}</p>
          ) : (
            <>
              <div className="pl-pays">
                <div className="pl-pays-label">{ticket.pays}</div>
                <div className="pl-pays-x">{quoteLoading ? <Loader2 className="animate-spin" /> : quote ? formatMultiplier(quote.multiplierMilli) : "···"}</div>
                {quote && !quoteLoading && <div className="pl-pays-sub">{ticket.combined(legs.length, formatProbPct(quote.combinedProbRaw, one))}</div>}
              </div>

              {quote?.correlated && (
                <div className="pl-corr">
                  <AlertCircle />
                  <span>{ticket.correlated}</span>
                </div>
              )}

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
                  <AmountField label={ticket.youPay} value={stakeInput} onChange={onStakeInput} symbol={symbol} hint={ticket.wallet(walletSpendableBase !== null ? money(walletSpendableBase) : "…", symbol)} />
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

              {quote && (
                <div className="pl-breakdown">
                  {legs.map((leg, i) => {
                    const m = marketOf(leg);
                    const bps = quote.legProbBps[i];
                    return (
                      <div key={leg.key} className="pl-bd-row">
                        <span className="pl-bd-what">
                          <span className={cn(leg.side === "up" ? "pl-bd-side--up" : "pl-bd-side--down")}>{leg.side === "up" ? "UP" : "DOWN"}</span>{" "}
                          {m?.openingPriceRaw != null ? formatLine(m.openingPriceRaw) : "···"}
                          {m && (
                            <span className="pl-bd-when">
                              {" "}
                              · {m.asset} {formatCadence(m.intervalSec)} · <Countdown expirySec={m.expirySec} intervalSec={m.intervalSec} nowMs={nowMs} />
                            </span>
                          )}
                        </span>
                        <span className="pl-bd-prob">{bps !== undefined ? formatBpsPct(bps) : "·"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {quoteError && (
                <button type="button" onClick={onRetryQuote} className="pl-quote-err" title={thin ? undefined : quoteError.technical}>
                  {thin ? ticket.thinBook(thinLeg + 1, contracts(thin.filledRaw), contracts(thin.depthRaw)) : diagnosisCopy(quoteError.kind).headline} · {ticket.retry}
                </button>
              )}

              <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough} stakeText={stakeText} symbol={symbol} onPlace={onPlace} />

              <p className="pl-footnote">
                {ticket.footnote}
                <br />
                {reserve.paused ? ticket.reservePaused : ticket.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps))}
              </p>

              {step === "error" && errorTitle && <ErrorBlock title={errorTitle} detail={errorDetail} onReset={onReset} />}

              {step === "success" && txHash && (
                <a href={txUrl(txHash)} target="_blank" rel="noopener noreferrer" className="pl-txlink pl-fade">
                  {ticket.viewTx}
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {legs.length >= 2 && (
        <div className="pl-trophy">
          <Trophy />
          <p>{ticket.trophy}</p>
        </div>
      )}
    </div>
  );
}
