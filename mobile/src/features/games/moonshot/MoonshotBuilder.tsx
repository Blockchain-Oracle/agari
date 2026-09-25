import { moonshotPayoutCapBase, RANGE_STAKE_HEADROOM_BPS, type RangeMode, type RangeReserveState } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Signature } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil, oneUnit, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet } from "@agari/markets/react";
import { useCallback, useEffect, useState } from "react";
import { Rocket } from "lucide-react-native";
import { Text, View } from "react-native";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { useExpiryCapacity } from "@/features/games/moonshot/useExpiryCapacity";
import { useMoonshotQuote } from "@/features/games/moonshot/useMoonshotQuote";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { usdBand } from "@/features/range/format";
import type { SolveMode } from "@/features/range/RangeTicket";
import { useRangeWindows } from "@/features/range/useRangeWindows";
import { useRangeWrites } from "@/features/range/useRangeWrites";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useGames } from "~/features/games/shell";
import { ConnectPlate, useRangeTokens } from "../range/PageParts";
import { builderStyles as styles } from "../range/RangeBuilder";
import type { PlaceStep } from "../range/TicketParts";
import { WindowPicker } from "../range/WindowPicker";
import { AimLadder, useRememberedCall } from "./AimLadder";
import { MoonshotTicket } from "./MoonshotTicket";

const SUCCESS_RESET_MS = 3_500;

/**
 * web's `moonshot/MoonshotBuilder.tsx`: the Window plate and the aim above the ticket. The level, the odds and the
 * multiple are the contract's own (`previewBasis` → `solveStrike` → `previewOpen`); the expiry's capacity is read
 * before the tap; the open goes through web's `useRangeWrites`, which returns a requote instead of overcharging.
 */
export function MoonshotBuilder({ reserve, symbol }: { reserve: RangeReserveState; symbol: string }) {
  const { t, r, color } = useRangeTokens();
  const { feedback: cue } = useGames();
  const { address } = useWalletSession();
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
  const [txHash, setTxHash] = useState<Signature | null>(null);

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
    cue("confirm");
    const outcome = await writes.open({ ...quote.rangeBand, maxPayoutBase: quote.quote.maxPayoutBase, maxStakeBase: mulBpsCeil(quote.quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS) });
    if (!outcome) {
      setStep("idle");
      return;
    }
    if (outcome.status === "confirmed") {
      setTxHash(outcome.txHash);
      setStep("success");
      cue("card-win");
      const target = MOONSHOT.ticket.target(quote.call.direction, usdBand(quote.band.strikePrint));
      notify.neutral(MOONSHOT.ticket.toast(target, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      setTimeout(() => setStep("idle"), SUCCESS_RESET_MS);
      return;
    }
    setStep("error");
    cue("deny");
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
  }, [address, quote, writes, decimals, symbol, quoteState, cue]);

  if (!address) return <ConnectPlate title={MOONSHOT.connect.title} sub={MOONSHOT.connect.sub} />;

  return (
    <View style={styles.grid}>
      <View style={[styles.plate, { borderColor: t.cardBorder, backgroundColor: r.plate }]}>
        <View style={[styles.plateHead, { borderBottomColor: r.headRule }]}>
          <Rocket size={16} color={color.accent} strokeWidth={2} />
          <Text style={[styles.plateName, { color: color.ink }]}>{MOONSHOT.builder.yourWindow}</Text>
        </View>
        <View style={styles.plateBody}>
          <WindowPicker windows={windows} loading={windowsLoading} pickedId={picked?.marketId ?? null} nowMs={nowMs} onPick={setMarketId} />
          {picked ? <AimLadder call={call} onCall={setCall} disabled={step === "placing"} /> : null}
        </View>
      </View>
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
        onPlace={() => void handlePlace()}
        onReset={reset}
      />
    </View>
  );
}
