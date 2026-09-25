import { diagnosisCopy } from "@agari/core/copy";
import { PARLAY_MAX_LEGS, type ParlayLegInput, type ParlayMode, type ParlayReserveState } from "@agari/core/parlay";
import { RANGE_STAKE_HEADROOM_BPS } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { parseThinBook } from "@/features/parlay/format";
import { useParlayQuote } from "@/features/parlay/useParlayQuote";
import { useParlayWindows } from "@/features/parlay/useParlayWindows";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { LegRow, type DraftLeg } from "./LegRow";
import { LegPlate, ParlayConnect } from "./LegPlate";
import { ParlayTicket, type SolveMode } from "./ParlayTicket";
import type { PlaceStep } from "./TicketParts";

let legSeq = 0;
const newKey = () => `leg-${++legSeq}-${Date.now()}`;
const SUCCESS_RESET_MS = 3_500;

/**
 * web's `features/parlay/ParlayBuilder.tsx`: the leg plate and the combined ticket. Legs name live Windows of any
 * listed asset and follow their lane when a Window rolls; the quote is the reserve's own `previewOpen`. Place calls
 * web's write hook straight away — the wallet's prompt is the confirmation, as on web.
 */
export function ParlayBuilder({ reserve, symbol, nowMs }: { reserve: ParlayReserveState; symbol: string; nowMs: number }) {
  const { address } = useWalletSession();
  const { windows, byId, loading: windowsLoading } = useParlayWindows(nowMs);
  const sheet = useBalanceSheet(address);
  const writes = useParlayWrites();
  const { decimals, params } = reserve;
  const maxLegs = Math.min(params.maxLegs, PARLAY_MAX_LEGS);

  const [legs, setLegs] = useState<DraftLeg[]>([]);
  const [solveMode, setSolveMode] = useState<SolveMode>("fixStake");
  // A leg is priced over rested depth no smaller than the payout, and the house maker rests 5 tUSDC of payout a side.
  const [stakeInput, setStakeInput] = useState("1");
  const [payoutInput, setPayoutInput] = useState("4");
  const [step, setStep] = useState<PlaceStep>("idle");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [txHash, setTxHash] = useState<Signature | null>(null);

  const addLeg = useCallback(() => {
    setLegs((prev) => {
      if (prev.length >= maxLegs) return prev;
      // Default to the next un-used Window (a fresh expiry → a real streak), else the soonest.
      const used = new Set(prev.map((l) => l.marketId));
      const pick = windows.find((w) => !used.has(w.marketId)) ?? windows[0];
      if (!pick) return prev;
      return [...prev, { key: newKey(), marketId: pick.marketId, asset: pick.asset, intervalSec: pick.intervalSec, side: "up" }];
    });
  }, [windows, maxLegs]);
  const removeLeg = useCallback((key: string) => setLegs((prev) => prev.filter((l) => l.key !== key)), []);
  const patchLeg = useCallback((key: string, patch: Partial<DraftLeg>) => setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);

  // A leg whose Window has left the live set moves to the soonest live Window of the same asset and lane.
  useEffect(() => {
    setLegs((prev) => {
      let changed = false;
      const used = new Set(prev.map((l) => l.marketId));
      const next = prev.map((leg) => {
        if (byId.has(leg.marketId)) return leg;
        const successor = windows.find((w) => w.asset === leg.asset && w.intervalSec === leg.intervalSec && !used.has(w.marketId));
        if (!successor) return leg;
        used.add(successor.marketId);
        changed = true;
        return { ...leg, marketId: successor.marketId };
      });
      return changed ? next : prev;
    });
  }, [byId, windows]);

  // One-tap close streak: UP at the soonest distinct Windows of whichever stock has the most live.
  const streak = useMemo(() => {
    const byAsset = new Map<string, EventMarket[]>();
    for (const w of windows) byAsset.set(w.asset, [...(byAsset.get(w.asset) ?? []), w]);
    let best: { asset: string; windows: EventMarket[] } | null = null;
    for (const [asset, list] of byAsset) if (list.length >= 2 && (best === null || list.length > best.windows.length)) best = { asset, windows: list };
    return best;
  }, [windows]);
  const loadStreakPreset = useCallback(() => {
    const picks = streak?.windows.slice(0, maxLegs) ?? [];
    if (picks.length < 2) {
      notify.warning(PARLAY.builder.presetNeedTwo);
      return;
    }
    setLegs(picks.map((w) => ({ key: newKey(), marketId: w.marketId, asset: w.asset, intervalSec: w.intervalSec, side: "up" })));
    setSolveMode("fixStake");
    setStakeInput("5");
  }, [streak, maxLegs]);

  const legInputs: ParlayLegInput[] = useMemo(() => legs.map((l) => ({ marketId: l.marketId, side: l.side })), [legs]);
  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: ParlayMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  const quoteState = useParlayQuote({ legs: legInputs, mode, params, enabled: legs.length >= 2 && !reserve.paused });
  const { quote } = quoteState;
  const thin = useMemo(() => parseThinBook(quoteState.error), [quoteState.error]);
  const walletSpendableBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const marketOf = useCallback((leg: DraftLeg) => byId.get(leg.marketId) ?? null, [byId]);

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
    // The Range lane's headroom: a quote that drifts a fraction before it lands is still the deal shown.
    const outcome = await writes.open(legInputs, quote.maxPayoutBase, mulBpsCeil(quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS));
    if (!outcome) {
      setStep("idle");
      return;
    }
    if (outcome.status === "confirmed") {
      setTxHash(outcome.txHash);
      setStep("success");
      notify.neutral(PARLAY.ticket.toast(legs.length, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      setTimeout(() => {
        setStep("idle");
        setLegs([]);
      }, SUCCESS_RESET_MS);
      return;
    }
    setStep("error");
    if (outcome.status === "requote") {
      setErrorTitle(PARLAY.ticket.requote(formatBaseUnits(outcome.stakeBase, decimals), symbol));
      setErrorDetail("");
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    setErrorTitle(copy.headline);
    setErrorDetail(outcome.diagnosis.technical);
    if ("txHash" in outcome && outcome.txHash) setTxHash(outcome.txHash);
  }, [address, quote, writes, legInputs, legs.length, decimals, symbol, quoteState]);

  if (!address) return <ParlayConnect />;

  return (
    <View style={{ gap: 24 }}>
      <LegPlate
        count={legs.length}
        maxLegs={maxLegs}
        presetAsset={streak?.asset ?? null}
        presetDisabled={streak === null}
        onPreset={loadStreakPreset}
        loading={windowsLoading && legs.length === 0}
        noWindows={windows.length === 0}
        onAdd={addLeg}
      >
        {legs.map((leg, i) => (
          <LegRow
            key={leg.key}
            index={i}
            leg={leg}
            market={marketOf(leg)}
            windows={windows}
            legProbBps={quote?.legProbBps[i] ?? null}
            thin={thin && thin.marketId === leg.marketId ? thin : null}
            decimals={decimals}
            nowMs={nowMs}
            onPatch={patchLeg}
            onRemove={removeLeg}
          />
        ))}
      </LegPlate>

      <ParlayTicket
        legs={legs}
        marketOf={marketOf}
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
        onPlace={() => void handlePlace()}
        onReset={reset}
      />
    </View>
  );
}
