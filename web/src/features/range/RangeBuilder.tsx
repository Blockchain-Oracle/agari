"use client";

import type { RangeMode, RangeReserveState, RangeSide } from "@agari/core/range";
import { RANGE_STAKE_HEADROOM_BPS } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Signature } from "@agari/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits, mulBpsCeil } from "@agari/core/units";
import { useBalanceSheet } from "@agari/markets/react";
import { Target, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useOracleSpot } from "../markets/hero/useOracleSpot";
import { useChainNowMs } from "../markets/useChainNow";
import { ConnectButton } from "../markets/wallet";
import type { PlaceStep } from "../parlay/TicketParts";
import { BandControl } from "./BandControl";
import { basisDriftSigmas, centrePrintOf, MAX_BASIS_DRIFT_SIGMAS } from "@agari/core/range";
import { useRangeBasis } from "@agari/markets/react";
import { RANGE } from "./copy";
import { usdBand } from "./format";
import { RangeTicket, type SolveMode } from "./RangeTicket";
import { useRangeDraft } from "./useRangeDraft";
import { useRangeQuote } from "./useRangeQuote";
import { useRangeWindows } from "./useRangeWindows";
import { useRangeWrites } from "./useRangeWrites";
import { WindowPicker } from "./WindowPicker";

const SUCCESS_RESET_MS = 3_500;

interface RangeBuilderProps {
  reserve: RangeReserveState;
  symbol: string;
}

/** The Window plate on the left, the band and the ticket on the right; the quote is the reserve's own. */
export function RangeBuilder({ reserve, symbol }: RangeBuilderProps) {
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const { windows, byId, loading: windowsLoading } = useRangeWindows(nowMs, reserve.params.minTimeLeftSec);
  const sheet = useBalanceSheet(address);
  const writes = useRangeWrites();
  const { decimals, params } = reserve;

  const [marketId, setMarketId] = useState<MarketId | null>(null);
  const [side, setSide] = useState<RangeSide>("inside");
  const [solveMode, setSolveMode] = useState<SolveMode>("fixStake");
  const [stakeInput, setStakeInput] = useState("5");
  const [payoutInput, setPayoutInput] = useState("20");
  const [step, setStep] = useState<PlaceStep>("idle");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [txHash, setTxHash] = useState<Signature | null>(null);

  // The soonest Window is the default; a Window that leaves the list hands over to the next.
  const picked = (marketId && byId.get(marketId)) || windows[0] || null;
  useEffect(() => {
    if (picked && picked.marketId !== marketId) setMarketId(picked.marketId);
  }, [picked, marketId]);

  const spot = useOracleSpot(picked?.asset ?? null);
  // D-119: the same anchor the ticket uses — the reserve's own centre, with the spot kept for the band's note.
  const basis = useRangeBasis(picked?.marketId ?? null);
  const tauSec = picked ? Math.max(0, picked.expirySec - Math.floor(Date.now() / 1000)) : 0;
  const centre = basis && isOk(basis) ? centrePrintOf(basis.value.openingPrint, basis.value.centerQE6, basis.value.sigmaE8, tauSec) : null;
  const draft = useRangeDraft(centre ?? spot, picked?.intervalSec ?? 300);
  // D-119: past two deviations the reserve's centre and the live price have parted far enough that no band it
  // quotes is fair, so the page stops asking for a price and the band's own note says why.
  const staleBasis =
    centre !== null && spot !== null && basis && isOk(basis)
      ? basisDriftSigmas(centre, spot, basis.value.sigmaE8, tauSec) > MAX_BASIS_DRIFT_SIGMAS
      : false;
  const band = picked && draft.lowPrint !== null && draft.highPrint !== null ? { marketId: picked.marketId, asset: picked.asset, side, lowPrint: draft.lowPrint, highPrint: draft.highPrint } : null;

  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: RangeMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  const quoteState = useRangeQuote({ band, expirySec: picked?.expirySec ?? null, mode, params, enabled: band !== null && !reserve.paused && !draft.dragging && !staleBasis });
  const { quote } = quoteState;
  const walletSpendableBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;

  const reset = useCallback(() => {
    setStep("idle");
    setErrorTitle("");
    setErrorDetail("");
  }, []);

  const handlePlace = useCallback(async () => {
    if (!address || !quote || !band) return;
    setErrorTitle("");
    setErrorDetail("");
    setTxHash(null);
    setStep("placing");
    const outcome = await writes.open({ ...band, maxPayoutBase: quote.maxPayoutBase, maxStakeBase: mulBpsCeil(quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS) });
    if (!outcome) {
      setStep("idle");
      return;
    }
    if (outcome.status === "confirmed") {
      setTxHash(outcome.txHash);
      setStep("success");
      notify.neutral(RANGE.ticket.toast(`${band.side} ${usdBand(band.lowPrint)} – ${usdBand(band.highPrint)}`, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      setTimeout(() => setStep("idle"), SUCCESS_RESET_MS);
      return;
    }
    setStep("error");
    if (outcome.status === "requote") {
      setErrorTitle(diagnosisCopy("requote").headline);
      setErrorDetail(RANGE.ticket.requote(formatBaseUnits(outcome.stakeBase, decimals), symbol));
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    setErrorTitle(copy.headline);
    setErrorDetail(outcome.diagnosis.technical);
    if ("txHash" in outcome && outcome.txHash) setTxHash(outcome.txHash);
  }, [address, quote, band, writes, decimals, symbol, quoteState]);

  if (!address) {
    return (
      <div className="pl-connect">
        <Wallet className="pl-connect-icon" />
        <p className="pl-connect-title">{RANGE.connect.title}</p>
        <p className="pl-connect-sub">{RANGE.connect.sub}</p>
        <div className="pl-connect-cta">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const { builder } = RANGE;
  return (
    <div className="pl-grid">
      <div className="pl-plate">
        <div className="pl-plate-head">
          <div className="pl-plate-title">
            <Target />
            <span className="pl-plate-name">{builder.yourWindow}</span>
          </div>
        </div>
        <div className="pl-plate-body">
          <WindowPicker windows={windows} loading={windowsLoading} pickedId={picked?.marketId ?? null} nowMs={nowMs} onPick={setMarketId} />
          {picked && <BandControl asset={picked.asset} intervalSec={picked.intervalSec} draft={draft} side={side} onSide={setSide} spot={spot} />}
        </div>
      </div>

      <RangeTicket
        window={picked}
        side={side}
        lowUsd={draft.lowUsd}
        highUsd={draft.highUsd}
        reserve={reserve}
        symbol={symbol}
        nowMs={nowMs}
        quote={quote}
        quoteLoading={quoteState.loading}
        quoteError={quoteState.error}
        onRetryQuote={quoteState.retry}
        solveMode={solveMode}
        onSolveMode={setSolveMode}
        stakeInput={stakeInput}
        onStakeInput={setStakeInput}
        payoutInput={payoutInput}
        onPayoutInput={setPayoutInput}
        walletSpendableBase={walletSpendableBase}
        step={step}
        errorTitle={errorTitle}
        errorDetail={errorDetail}
        txHash={txHash}
        onPlace={handlePlace}
        onReset={reset}
      />
    </div>
  );
}
