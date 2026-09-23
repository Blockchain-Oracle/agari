import { diagnosisCopy } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import { PARLAY_MAX_LEGS, type ParlayLegInput, type ParlayMode, type ParlayQuote, type ParlayReserveState } from "@agari/core/parlay";
import { RANGE_STAKE_HEADROOM_BPS } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatBpsPct, formatMultiplier, parseThinBook } from "@/features/parlay/format";
import { useParlayQuote } from "@/features/parlay/useParlayQuote";
import { useParlayWindows } from "@/features/parlay/useParlayWindows";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, ConnectGate, EmptyState, LoadingState } from "~/components/kit";
import type { ReviewRequest } from "~/features/short/ReviewSheet";
import { TYPE, useTheme } from "~/theme";
import { LegRow, type DraftLeg } from "./LegRow";
import { ParlayTicket, ticketQuote, type SolveMode } from "./ParlayTicket";

let legSeq = 0;
const newKey = () => `leg-${++legSeq}-${Date.now()}`;
const B = PARLAY.builder;
const T = PARLAY.ticket;

/**
 * web's `features/parlay/ParlayBuilder.tsx`: the leg plate and the combined ticket. Legs name live Windows of any
 * listed asset and follow their lane when a Window rolls; the quote is the reserve's own `previewOpen`, so the figure
 * on the review is the figure the chain charges — or a requote, never more.
 */
export function ParlayBuilder({ reserve, symbol, nowMs, onReview }: { reserve: ParlayReserveState; symbol: string; nowMs: number; onReview: (r: ReviewRequest) => void }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { windows, byId, loading: windowsLoading } = useParlayWindows(nowMs);
  const sheet = useBalanceSheet(address);
  const writes = useParlayWrites();
  const { decimals, params } = reserve;
  const maxLegs = Math.min(params.maxLegs, PARLAY_MAX_LEGS);
  const [legs, setLegs] = useState<DraftLeg[]>([]);
  const [solveMode, setSolveMode] = useState<SolveMode>("fixStake");
  // web's opening figures: a leg is priced over rested depth no smaller than the payout (the house rests 5 tUSDC).
  const [stakeInput, setStakeInput] = useState("1");
  const [payoutInput, setPayoutInput] = useState("4");

  const addLeg = useCallback(() => {
    setLegs((prev) => {
      if (prev.length >= maxLegs) return prev;
      const used = new Set(prev.map((l) => l.marketId));
      const pick = windows.find((w) => !used.has(w.marketId)) ?? windows[0];
      if (!pick) return prev;
      return [...prev, { key: newKey(), marketId: pick.marketId, asset: pick.asset, intervalSec: pick.intervalSec, side: "up" }];
    });
  }, [windows, maxLegs]);
  const removeLeg = useCallback((key: string) => setLegs((prev) => prev.filter((l) => l.key !== key)), []);
  const patchLeg = useCallback((key: string, patch: Partial<DraftLeg>) => setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);

  // web's rule: a leg whose Window left the live set moves to the soonest live Window of its asset and lane.
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
  const loadStreak = () => {
    const picks = streak?.windows.slice(0, maxLegs) ?? [];
    if (picks.length < 2) return notify.warning(B.presetNeedTwo);
    setLegs(picks.map((w) => ({ key: newKey(), marketId: w.marketId, asset: w.asset, intervalSec: w.intervalSec, side: "up" })));
    setSolveMode("fixStake");
    setStakeInput("5");
  };

  const legInputs: ParlayLegInput[] = useMemo(() => legs.map((l) => ({ marketId: l.marketId, side: l.side })), [legs]);
  const stakeBase = parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n;
  const payoutBase = parseDecimalToBaseUnits(payoutInput || "0", decimals) ?? 0n;
  const mode: ParlayMode = solveMode === "fixStake" ? { kind: "fixStake", stakeBase } : { kind: "fixPayout", maxPayoutBase: payoutBase };
  const quoteState = useParlayQuote({ legs: legInputs, mode, params, enabled: legs.length >= 2 && !reserve.paused });
  const { quote } = quoteState;
  const thin = useMemo(() => parseThinBook(quoteState.error), [quoteState.error]);
  const shownQuote = useMemo(() => ticketQuote(quote), [quote]);
  const marketOf = useCallback((leg: DraftLeg) => byId.get(leg.marketId) ?? null, [byId]);

  const place = async (frozen: ParlayQuote, frozenLegs: ParlayLegInput[], maxStakeBase: bigint): Promise<boolean> => {
    const outcome = await writes.open(frozenLegs, frozen.maxPayoutBase, maxStakeBase);
    if (!outcome) return false;
    if (outcome.status === "confirmed") {
      notify.neutral(T.toast(frozenLegs.length, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(frozen.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      setLegs([]);
      return true;
    }
    if (outcome.status === "requote") {
      notify.warning(T.requote(formatBaseUnits(outcome.stakeBase, decimals), symbol));
      quoteState.retry();
      return false;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical);
    return false;
  };

  const review = () => {
    if (!quote) return;
    const frozen = quote;
    const frozenLegs = legInputs;
    const maxStakeBase = mulBpsCeil(frozen.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS);
    const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
    onReview({
      title: `Place a ${legs.length}-leg parlay · ${formatMultiplier(frozen.multiplierMilli)}`,
      lines: [
        ...legs.map((leg, i) => {
          const m = marketOf(leg);
          return {
            label: `Leg ${i + 1} · ${m ? `${m.asset} ${formatCadence(m.intervalSec)}` : leg.asset}`,
            value: `${leg.side === "up" ? "UP" : "DOWN"} · ${frozen.legProbBps[i] !== undefined ? formatBpsPct(frozen.legProbBps[i] as number) : "·"}`,
            tone: (leg.side === "up" ? "profit" : "loss") as "profit" | "loss",
          };
        }),
        { label: T.youPay, value: money(frozen.stakeBase) },
        { label: "Most it can charge", value: money(maxStakeBase), hint: "If the book moves before it lands; more is refused", tone: "muted" as const },
        { label: T.ifLands, value: money(frozen.maxPayoutBase), tone: "profit" as const },
      ],
      maxLoss: money(maxStakeBase),
      confirmLabel: "Slide to place",
      send: () => place(frozen, frozenLegs, maxStakeBase),
    });
  };

  return (
    <ConnectGate why={PARLAY.connect.sub}>
      <View style={styles.plate}>
        <View style={styles.plateHead}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            {B.yourLegs} <Text style={[TYPE.data, { color: color.inkMuted }]}>{legs.length}/{maxLegs}</Text>
          </Text>
          <Button label={B.preset(streak?.asset ?? null)} variant="ghost" size="sm" block={false} icon={{ ios: "bolt.fill", android: "bolt" }} disabled={streak === null} onPress={loadStreak} />
        </View>
        {windowsLoading && legs.length === 0 ? (
          <LoadingState shape="list" label={B.loading} />
        ) : legs.length === 0 ? (
          <EmptyState why={B.noLegs} detail={windows.length === 0 ? B.noMarkets : B.noLegsBody} action={windows.length > 0 ? { label: B.addFirst, onPress: addLeg } : undefined} />
        ) : (
          legs.map((leg, i) => (
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
          ))
        )}
        {legs.length > 0 && legs.length < maxLegs ? (
          <Button label={B.addAnother} variant="outline" icon={{ ios: "plus", android: "add" }} onPress={addLeg} />
        ) : null}
      </View>
      <ParlayTicket
        legs={legs}
        marketOf={marketOf}
        reserve={reserve}
        symbol={symbol}
        nowMs={nowMs}
        quote={shownQuote}
        quoteLoading={quoteState.loading}
        quoteError={quoteState.error}
        onRetryQuote={quoteState.retry}
        solveMode={solveMode}
        onSolveMode={setSolveMode}
        stakeInput={stakeInput}
        onStakeInput={setStakeInput}
        payoutInput={payoutInput}
        onPayoutInput={setPayoutInput}
        walletSpendableBase={sheet && isOk(sheet) ? sheet.value.spendableBase : null}
        placing={writes.busy === "open"}
        onReview={review}
      />
    </ConnectGate>
  );
}

const styles = StyleSheet.create({
  plate: { gap: 10 },
  plateHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
