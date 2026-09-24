import { blockerLabel } from "@agari/core/copy";
import { basisDriftSigmas, centrePrintOf, MAX_BASIS_DRIFT_SIGMAS, RANGE_STAKE_HEADROOM_BPS, type RangeMode, type RangeReserveState, type RangeSide } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Signature } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, useRangeBasis } from "@agari/markets/react";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { RANGE } from "@/features/range/copy";
import { usdBand } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { useRangeDraft } from "@/features/range/useRangeDraft";
import { useRangeQuote } from "@/features/range/useRangeQuote";
import { useRangeWindows } from "@/features/range/useRangeWindows";
import { useRangeWrites } from "@/features/range/useRangeWrites";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { Card, ConnectGate } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { useGames } from "~/features/games/shell";
import { BandControl } from "./BandControl";
import { RangeTicket } from "./RangeTicket";
import type { PlaceStep } from "./TicketParts";
import { WindowPicker } from "./WindowPicker";

/**
 * web's `range/RangeBuilder.tsx`, whole: the Window, the band, inside or outside, and the ticket — the quote is the
 * reserve's own (`previewOpen`), and the open goes through web's `useRangeWrites`, which hands back a requote rather
 * than overcharging when the basis moved between the quote and the signature.
 */
export function RangeBuilder({ reserve, symbol }: { reserve: RangeReserveState; symbol: string }) {
  const { color } = useTheme();
  const { feedback: cue } = useGames();
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
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<PlaceStep>("idle");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [txHash, setTxHash] = useState<Signature | null>(null);
  // The band as it was sent, frozen: the live band keeps following the price after the round is placed.
  const [placedBand, setPlacedBand] = useState<string | null>(null);

  // The soonest Window is the default; a Window that leaves the list hands over to the next.
  const picked = (marketId && byId.get(marketId)) || windows[0] || null;
  useEffect(() => {
    if (picked && picked.marketId !== marketId) setMarketId(picked.marketId);
  }, [picked, marketId]);

  const spot = useOracleSpot(picked?.asset ?? null);
  // D-119: the band is centred on the live price; the reserve's own centre is rebuilt only to check the two agree.
  const basis = useRangeBasis(picked?.marketId ?? null);
  const tauSec = picked ? Math.max(0, picked.expirySec - Math.floor(Date.now() / 1000)) : 0;
  const centre = basis && isOk(basis) ? centrePrintOf(basis.value.openingPrint, basis.value.centerQE6, basis.value.sigmaE8, tauSec) : null;
  const draft = useRangeDraft(spot, picked?.intervalSec ?? 300);
  const staleBasis = centre !== null && spot !== null && basis && isOk(basis) ? basisDriftSigmas(centre, spot, basis.value.sigmaE8, tauSec) > MAX_BASIS_DRIFT_SIGMAS : false;
  const band = picked && draft.lowPrint !== null && draft.highPrint !== null ? { marketId: picked.marketId, asset: picked.asset, side, lowPrint: draft.lowPrint, highPrint: draft.highPrint } : null;

  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: RangeMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  const quoteState = useRangeQuote({ band, expirySec: picked?.expirySec ?? null, mode, params, enabled: band !== null && !reserve.paused && !dragging && !staleBasis });
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
    cue("confirm");
    const outcome = await writes.open({ ...band, maxPayoutBase: quote.maxPayoutBase, maxStakeBase: mulBpsCeil(quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS) });
    if (!outcome) {
      setStep("idle");
      return;
    }
    if (outcome.status === "confirmed") {
      setTxHash(outcome.txHash);
      setPlacedBand(`${band.side} ${usdBand(band.lowPrint)} – ${usdBand(band.highPrint)}`);
      setStep("success");
      cue("card-win");
      notify.neutral(RANGE.ticket.toast(`${band.side} ${usdBand(band.lowPrint)} – ${usdBand(band.highPrint)}`, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      return;
    }
    setStep("error");
    cue("deny");
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
  }, [address, quote, band, writes, decimals, symbol, quoteState, cue]);

  return (
    <ConnectGate why={RANGE.connect.sub}>
      <Card>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{RANGE.builder.yourWindow}</Text>
        <WindowPicker windows={windows} loading={windowsLoading} pickedId={picked?.marketId ?? null} nowMs={nowMs} onPick={setMarketId} />
        {picked ? <BandControl asset={picked.asset} intervalSec={picked.intervalSec} draft={draft} side={side} onSide={setSide} spot={spot} onDragging={setDragging} /> : null}
        {picked && staleBasis ? <Text style={[TYPE.caption, { color: color.warning }]}>{blockerLabel("stale-basis")}</Text> : null}
      </Card>
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
        dragging={dragging}
        placedBand={placedBand}
        holdReason={picked && staleBasis ? blockerLabel("stale-basis") : null}
        step={step}
        errorTitle={errorTitle}
        errorDetail={errorDetail}
        txHash={txHash}
        onPlace={() => void handlePlace()}
        onReset={reset}
      />
    </ConnectGate>
  );
}
