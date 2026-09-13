"use client";

import { formatCadence } from "@masayume/core/market";
import { RANGE_STAKE_HEADROOM_BPS, type MoonshotCall, type RangeReserveState } from "@masayume/core/range";
import type { Diagnosis, EventMarket, Hex } from "@masayume/core/types";
import { formatBaseUnits, mulBpsCeil } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import type { MoonshotQuote, RangeCapacity } from "@masayume/markets/range";
import { Loader2 } from "lucide-react";
import { Countdown } from "@/components/data";
import { diagnosisCopy } from "@/lib/copy";
import { AmountField, ErrorBlock, PlaceButton, Row, type PlaceStep } from "../../parlay/TicketParts";
import { formatMultiplierTenths, formatProbE6, usd0, usdBand, utilizationPct } from "../../range/format";
import type { SolveMode } from "../../range/RangeTicket";
import { MOONSHOT } from "./copy";

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
  txHash: Hex | null;
  onPlace: () => void;
  onReset: () => void;
}

/** The strike's distance from the opening print in hundredths of a percent, from the two prints, no float. */
function distancePct(strikePrint: bigint, openingPrint: bigint): { text: string; above: boolean } {
  const bps = ((strikePrint - openingPrint) * 10_000n) / openingPrint;
  const magnitude = bps < 0n ? -bps : bps;
  const whole = magnitude / 100n;
  const frac = (magnitude % 100n).toString().padStart(2, "0");
  return { text: `${whole}.${frac}`, above: strikePrint >= openingPrint };
}

/**
 * The call's ticket in the parlay ticket's grammar: the contract's multiple, the solved level and how far it
 * sits, the solver, the breakdown, the caps, the liability line, the place control, the footnotes.
 */
export function MoonshotTicket(props: MoonshotTicketProps) {
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

  return (
    <div className="pl-ticket-col">
      <div className="pl-ticket">
        <div className="pl-ticket-head">
          <span className="pl-ticket-title">{ticket.title}</span>
          <span className="pl-ticket-tag">{ticket.tag}</span>
        </div>

        <div className="pl-ticket-body">
          {!w ? (
            <p className="pl-need2">{ticket.needWindow}</p>
          ) : (
            <>
              <div className="pl-pays">
                <div className="pl-pays-label">{ticket.pays}</div>
                <div className="pl-pays-x">{quoteLoading ? <Loader2 className="animate-spin" /> : quote ? formatMultiplierTenths(quote.quote.multiplierMilli) : "···"}</div>
                {quote && !quoteLoading && <div className="pl-pays-sub">{ticket.odds(formatProbE6(quote.quote.insideProbE6), call.direction, usdBand(quote.band.strikePrint))}</div>}
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
                  <div className="pl-profit">{quote && <span>{ticket.profit(money(quote.quote.maxPayoutBase - quote.quote.stakeBase), symbol)}</span>}</div>
                </div>
              </div>

              <div className="pl-breakdown">
                <div className="pl-bd-row">
                  <span className="pl-bd-what">
                    <span className="rg-card-side">{quote ? ticket.target(call.direction, usdBand(quote.band.strikePrint)) : MOONSHOT.aim.valueText(call.direction, call.multiple)}</span>
                    <span className="pl-bd-when">
                      {" "}
                      · {w.asset} {formatCadence(w.intervalSec)} · <Countdown expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
                    </span>
                  </span>
                  <span className="pl-bd-prob">{w.openingPriceRaw !== null ? usd0(w.openingPriceRaw) : "·"}</span>
                </div>
                {distance && (
                  <div className="pl-bd-row">
                    <span className="pl-bd-what ms-bd-distance">{ticket.distance(distance.text, distance.above)}</span>
                  </div>
                )}
              </div>

              <p className="ms-liability">
                {capBase < params.maxPayoutCapBase ? ticket.capRung(call.multiple, whole(capBase), symbol) : ticket.capContract(whole(capBase), symbol)}
                {cappedStake && quote && (
                  <>
                    <br />
                    {ticket.cappedStake(money(quote.quote.stakeBase), whole(capBase), symbol)}
                  </>
                )}
                <br />
                {quote && ticket.locks(money(quote.houseLockedBase), symbol)}
                {quote && " "}
                {room === null ? ticket.expiryReading : ticket.expiryRoom(money(room), whole(params.maxExpiryLockedBase), symbol)}
              </p>

              {overCap && (
                <button type="button" onClick={onUseCap} className="pl-quote-err" data-cursor="hover">
                  {ticket.overCap(call.multiple, whole(capBase), symbol)} · {ticket.useCap}
                </button>
              )}

              {capacity && !capacity.fits && capacity.refusal && (
                <p className="pl-quote-err" title={capacity.refusal.technical}>
                  {diagnosisCopy(capacity.refusal.kind).headline}
                </p>
              )}

              {quoteError && (
                <button type="button" onClick={onRetryQuote} className="pl-quote-err" title={quoteError.technical}>
                  {diagnosisCopy(quoteError.kind).headline} · {ticket.retry}
                </button>
              )}

              <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough && fits} stakeText={stakeText} symbol={symbol} onPlace={onPlace} labels={labels} />

              <p className="pl-footnote">
                {ticket.footnote}
                {quote && (
                  <>
                    <br />
                    {ticket.upTo(money(mulBpsCeil(quote.quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS)), symbol)}
                  </>
                )}
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
