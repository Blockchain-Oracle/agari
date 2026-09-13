"use client";

import { PARLAY_MAX_LEGS, type ParlayLegInput, type ParlayMode, type ParlayReserveState } from "@masayume/core/parlay";
import { RANGE_STAKE_HEADROOM_BPS } from "@masayume/core/range";
import { isOk } from "@masayume/core/schemas";
import type { EventMarket, Hex } from "@masayume/core/types";
import { formatBaseUnits, mulBpsCeil, parseDecimalToBaseUnits } from "@masayume/core/units";
import { useBalanceSheet } from "@masayume/markets/react";
import { Layers, Plus, Wallet, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { ConnectButton } from "../markets/wallet";
import { PARLAY } from "./copy";
import { parseThinBook } from "./format";
import { LegRow, type DraftLeg } from "./LegRow";
import { ParlayTicket, type SolveMode } from "./ParlayTicket";
import type { PlaceStep } from "./TicketParts";
import { useParlayQuote } from "./useParlayQuote";
import { useParlayWindows } from "./useParlayWindows";
import { useParlayWrites } from "./useParlayWrites";

let legSeq = 0;
const newKey = () => `leg-${++legSeq}-${Date.now()}`;
const SUCCESS_RESET_MS = 3_500;

interface ParlayBuilderProps {
  reserve: ParlayReserveState;
  symbol: string;
}

/**
 * `ParlayBuilder` (`reference/yosuku/components/ParlayBuilder.tsx`): the leg plate and the combined
 * ticket. Legs name live Windows of any listed asset; the quote is the reserve's own (`previewOpen`),
 * so the number on the button is the number the chain charges — or a requote, never more.
 */
export function ParlayBuilder({ reserve, symbol }: ParlayBuilderProps) {
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const { windows, byId, loading: windowsLoading } = useParlayWindows(nowMs);
  const sheet = useBalanceSheet(address);
  const writes = useParlayWrites();
  const { decimals, params } = reserve;
  const maxLegs = Math.min(params.maxLegs, PARLAY_MAX_LEGS);

  const [legs, setLegs] = useState<DraftLeg[]>([]);
  const [solveMode, setSolveMode] = useState<SolveMode>("fixStake");
  const [stakeInput, setStakeInput] = useState("5");
  const [payoutInput, setPayoutInput] = useState("40");
  const [step, setStep] = useState<PlaceStep>("idle");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);

  // ── leg authoring ──
  const addLeg = useCallback(
    (marketId?: EventMarket["marketId"]) => {
      setLegs((prev) => {
        if (prev.length >= maxLegs) return prev;
        // Default to the next un-used Window (a fresh expiry → a real streak), else the soonest.
        const used = new Set(prev.map((l) => l.marketId));
        const pick = (marketId ? byId.get(marketId) : undefined) ?? windows.find((w) => !used.has(w.marketId)) ?? windows[0];
        if (!pick) return prev;
        return [...prev, { key: newKey(), marketId: pick.marketId, asset: pick.asset, intervalSec: pick.intervalSec, side: "up" }];
      });
    },
    [byId, windows, maxLegs],
  );
  const removeLeg = useCallback((key: string) => setLegs((prev) => prev.filter((l) => l.key !== key)), []);
  const patchLeg = useCallback((key: string, patch: Partial<DraftLeg>) => setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);

  // Keep each leg on a live Window of its lane. The reference re-syncs a leg's expiry from the refreshed
  // oracle list (`ParlayBuilder.tsx` L145–159) because its oracle id survives the round; a Window here is a
  // new id every round, so a leg whose Window has left the live set moves to the soonest live Window of
  // the same asset and lane — the one `useNextWindow` would name — skipping any Window another leg holds.
  // The SAME `prev` comes back when nothing changed, for the reference's own reason: a fresh array on
  // every pass would re-render forever.
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

  /** One-tap "BTC close streak": UP at the soonest distinct BTC Windows. */
  const btcWindows = useMemo(() => windows.filter((w) => w.asset.toUpperCase() === "BTC"), [windows]);
  const loadStreakPreset = useCallback(() => {
    const picks = btcWindows.slice(0, maxLegs);
    if (picks.length < 2) {
      notify.warning(PARLAY.builder.presetNeedTwo);
      return;
    }
    setLegs(picks.map((w) => ({ key: newKey(), marketId: w.marketId, asset: w.asset, intervalSec: w.intervalSec, side: "up" })));
    setSolveMode("fixStake");
    setStakeInput("5");
  }, [btcWindows, maxLegs]);

  // ── the quote ──
  const legInputs: ParlayLegInput[] = useMemo(() => legs.map((l) => ({ marketId: l.marketId, side: l.side })), [legs]);
  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: ParlayMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  const quoteState = useParlayQuote({ legs: legInputs, mode, params, enabled: legs.length >= 2 && !reserve.paused });
  const { quote } = quoteState;
  const thin = useMemo(() => parseThinBook(quoteState.error), [quoteState.error]);
  const walletSpendableBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const marketOf = useCallback((leg: DraftLeg) => byId.get(leg.marketId) ?? null, [byId]);

  // ── place ──
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
    // The Range lane's headroom: a quote that drifts a fraction before it lands is still the deal shown,
    // not a bounce, a re-quote at the same figure and a loop that reads "changed from 5 to 5".
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
      // The actionable sentence is the headline, not a line behind "technical details".
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

  if (!address) {
    return (
      <div className="pl-connect">
        <Wallet className="pl-connect-icon" />
        <p className="pl-connect-title">{PARLAY.connect.title}</p>
        <p className="pl-connect-sub">{PARLAY.connect.sub}</p>
        <div className="pl-connect-cta">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="pl-grid">
      {/* ── Left: the leg builder (the ledger plate) ── */}
      <div className="pl-plate">
        <div className="pl-plate-head">
          <div className="pl-plate-title">
            <Layers />
            <span className="pl-plate-name">{PARLAY.builder.yourLegs}</span>
            <span className="pl-count">
              {legs.length}/{maxLegs}
            </span>
          </div>
          <button type="button" onClick={loadStreakPreset} disabled={btcWindows.length < 2} className="pl-preset" data-cursor="hover">
            <Zap />
            {PARLAY.builder.preset}
          </button>
        </div>

        <div className="pl-plate-body">
          {windowsLoading && legs.length === 0 ? (
            <div className="pl-loading">{PARLAY.builder.loading}</div>
          ) : legs.length === 0 ? (
            <div className="pl-empty">
              <p className="pl-empty-title">{PARLAY.builder.noLegs}</p>
              <p className="pl-empty-body">{PARLAY.builder.noLegsBody}</p>
              <button type="button" onClick={() => addLeg()} disabled={windows.length === 0} className="pl-add-first" data-cursor="hover">
                <Plus /> {PARLAY.builder.addFirst}
              </button>
            </div>
          ) : (
            legs.map((leg, i) => (
              <LegRow
                key={leg.key}
                index={i}
                leg={leg}
                market={marketOf(leg)}
                windows={windows}
                legProbBps={quote?.legProbBps[i] ?? null}
                thin={thin && thin.marketId.toLowerCase() === leg.marketId.toLowerCase() ? thin : null}
                decimals={decimals}
                nowMs={nowMs}
                onPatch={patchLeg}
                onRemove={removeLeg}
              />
            ))
          )}

          {legs.length > 0 && legs.length < maxLegs && (
            <button type="button" onClick={() => addLeg()} className="pl-add-more" data-cursor="hover">
              <Plus /> {PARLAY.builder.addAnother}
            </button>
          )}
        </div>
      </div>

      {/* ── Right: the combined ticket (sticky) ── */}
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
        onPlace={handlePlace}
        onReset={reset}
      />
    </div>
  );
}
