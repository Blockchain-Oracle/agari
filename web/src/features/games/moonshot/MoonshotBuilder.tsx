"use client";

import { RANGE_STAKE_HEADROOM_BPS, moonshotPayoutCapBase, type RangeMode, type RangeReserveState } from "@masayume/core/range";
import { isOk } from "@masayume/core/schemas";
import type { Hex, MarketId } from "@masayume/core/types";
import { formatBaseUnits, mulBpsCeil, oneUnit, parseDecimalToBaseUnits } from "@masayume/core/units";
import { useBalanceSheet } from "@masayume/markets/react";
import { Rocket, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../../markets/useChainNow";
import { ConnectButton } from "../../markets/wallet";
import type { PlaceStep } from "../../parlay/TicketParts";
import { usdBand } from "../../range/format";
import type { SolveMode } from "../../range/RangeTicket";
import { useRangeWindows } from "../../range/useRangeWindows";
import { useRangeWrites } from "../../range/useRangeWrites";
import { WindowPicker } from "../../range/WindowPicker";
import { useGames } from "../GamesProvider";
import { AimControl, useRememberedCall } from "./AimControl";
import { MOONSHOT } from "./copy";
import { MoonshotTicket } from "./MoonshotTicket";
import { useExpiryCapacity } from "./useExpiryCapacity";
import { useMoonshotQuote } from "./useMoonshotQuote";

const SUCCESS_RESET_MS = 3_500;

interface MoonshotBuilderProps {
  reserve: RangeReserveState;
  symbol: string;
}

/** The Window plate and the aim on the left, the ticket on the right; the level and the quote are the contract's own. */
export function MoonshotBuilder({ reserve, symbol }: MoonshotBuilderProps) {
  const { address } = useWalletSession();
  const { feedback } = useGames();
  const nowMs = useChainNowMs();
  const { windows, byId, loading: windowsLoading } = useRangeWindows(nowMs, reserve.params.minTimeLeftSec);
  const sheet = useBalanceSheet(address);
  const writes = useRangeWrites();
  const { decimals, params } = reserve;

  const [marketId, setMarketId] = useState<MarketId | null>(null);
  const [call, setCall] = useRememberedCall();
  const [solveMode, setSolveMode] = useState<SolveMode>("fixStake");
  const [stakeInput, setStakeInput] = useState("5");
  const [payoutInput, setPayoutInput] = useState("25");
  const [step, setStep] = useState<PlaceStep>("idle");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);

  // The soonest Window is the default; a Window that leaves the list hands over to the next.
  const picked = (marketId && byId.get(marketId)) || windows[0] || null;
  useEffect(() => {
    if (picked && picked.marketId !== marketId) setMarketId(picked.marketId);
  }, [picked, marketId]);

  const market = picked ? { marketId: picked.marketId, asset: picked.asset } : null;
  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: RangeMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  // The rung's cap under the contract's: a payout typed over it is refused here, not by the chain.
  const capBase = moonshotPayoutCapBase(call.multiple, params.maxPayoutCapBase, oneUnit(decimals));
  const overCap = solveMode === "fixPayout" && payoutBase > capBase;
  const useCap = useCallback(() => setPayoutInput(formatBaseUnits(capBase, decimals, { maxDp: 0, minDp: 0, group: false })), [capBase, decimals]);
  const quoteState = useMoonshotQuote({ market, expirySec: picked?.expirySec ?? null, call, mode, params, enabled: market !== null && !reserve.paused && !overCap });
  const { quote } = quoteState;
  const capacityReading = useExpiryCapacity(picked?.expirySec ?? null, quote?.houseLockedBase ?? null, picked !== null);
  const capacity = capacityReading && isOk(capacityReading) ? capacityReading.value : null;
  const walletSpendableBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;

  const reset = useCallback(() => {
    setStep("idle");
    setErrorTitle("");
    setErrorDetail("");
  }, []);

  const handlePlace = useCallback(async () => {
    if (!address || !quote) return;
    setErrorTitle("");
    setErrorDetail("");
    setTxHash(null);
    setStep("placing");
    feedback("confirm");
    const outcome = await writes.open({ ...quote.rangeBand, maxPayoutBase: quote.quote.maxPayoutBase, maxStakeBase: mulBpsCeil(quote.quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS) });
    if (!outcome) {
      setStep("idle");
      return;
    }
    if (outcome.status === "confirmed") {
      setTxHash(outcome.txHash);
      setStep("success");
      feedback("card-win");
      const target = MOONSHOT.ticket.target(quote.call.direction, usdBand(quote.band.strikePrint));
      notify.neutral(MOONSHOT.ticket.toast(target, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      setTimeout(() => setStep("idle"), SUCCESS_RESET_MS);
      return;
    }
    setStep("error");
    feedback("deny");
    if (outcome.status === "requote") {
      setErrorTitle(diagnosisCopy("requote").headline);
      setErrorDetail(MOONSHOT.ticket.requote(formatBaseUnits(outcome.stakeBase, decimals), symbol));
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    setErrorTitle(copy.headline);
    setErrorDetail(outcome.diagnosis.technical);
    if ("txHash" in outcome && outcome.txHash) setTxHash(outcome.txHash);
  }, [address, quote, writes, decimals, symbol, quoteState, feedback]);

  if (!address) {
    return (
      <div className="pl-connect">
        <Wallet className="pl-connect-icon" />
        <p className="pl-connect-title">{MOONSHOT.connect.title}</p>
        <p className="pl-connect-sub">{MOONSHOT.connect.sub}</p>
        <div className="pl-connect-cta">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="pl-grid">
      <div className="pl-plate">
        <div className="pl-plate-head">
          <div className="pl-plate-title">
            <Rocket />
            <span className="pl-plate-name">{MOONSHOT.builder.yourWindow}</span>
          </div>
        </div>
        <div className="pl-plate-body">
          <WindowPicker windows={windows} loading={windowsLoading} pickedId={picked?.marketId ?? null} nowMs={nowMs} onPick={setMarketId} />
          {picked && <AimControl call={call} onCall={setCall} disabled={step === "placing"} />}
        </div>
      </div>

      <MoonshotTicket
        window={picked}
        call={call}
        reserve={reserve}
        symbol={symbol}
        nowMs={nowMs}
        quote={quote}
        quoteLoading={quoteState.loading}
        quoteError={quoteState.error}
        onRetryQuote={quoteState.retry}
        capacity={capacity}
        capBase={capBase}
        overCap={overCap}
        onUseCap={useCap}
        stakeBase={stakeBase}
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
