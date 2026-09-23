import type { TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet } from "@agari/markets/react";
import { useState } from "react";
import { calmSet, holdsPreIpo } from "@/features/hedge/calm";
import { HEDGE } from "@/features/hedge/copy";
import { examplePick } from "@/features/hedge/example";
import { hedgeStakeBase } from "@/features/hedge/hedge-size";
import { hedgeCardState } from "@/features/hedge/hedge-state";
import { pickHedge } from "@/features/hedge/hedge-target";
import { useHoldings } from "@/features/hedge/useHoldings";
import { usePreIpoFactsAll } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { HedgeCard, HedgeTeaser } from "./HedgeCard";

const FALLBACK_SYMBOL = "tUSDC";
const FALLBACK_DECIMALS = 6;

interface LiveHedgeCardProps {
  laneSet: LaneSet | null;
  nowMs: number;
  /** Scope the card to one company (the ticker hub): only holdings of that underlying are offered. */
  only?: TickerSymbol;
}

/**
 * web's `LiveHedgeCard` (features/hedge/LiveHedgeCard.tsx) for the connected wallet: the cover offer when it holds a
 * verified stock token and a Window of that company is trading, else one of the teaser states, so the feature is never
 * invisible. "See an example" runs sample holdings through the same picker, stamped.
 */
export function LiveHedgeCard({ laneSet, nowMs, only }: LiveHedgeCardProps) {
  const { address } = useWalletSession();
  const all = useHoldings(address);
  const sheet = useBalanceSheet(address);
  const [example, setExample] = useState(false);
  const holdings = all?.ok && only ? { ...all, value: all.value.filter((h) => h.underlying === only) } : all;

  const facts = usePreIpoFactsAll(holdings?.ok === true && holdsPreIpo(holdings.value));
  const calm = calmSet(facts?.ok ? facts.value : null);
  const pick = holdings?.ok ? pickHedge(holdings.value, laneSet, nowMs, calm) : null;
  const scoped = pick && only && pick.underlying !== only ? null : pick;
  const state = hedgeCardState({ address, holdings, pick: scoped, clockReady: nowMs !== 0, calm });
  const collateral = collateralOrNull();

  if (example) {
    const sample = examplePick(Math.floor((nowMs || Date.now()) / 1000));
    if (!sample) return null;
    return (
      <HedgeCard
        pick={sample}
        stakeBase={null}
        decimals={FALLBACK_DECIMALS}
        symbol={collateral?.symbol ?? FALLBACK_SYMBOL}
        stamp={HEDGE.example.stamp}
        ctaText={HEDGE.example.hide}
        note={HEDGE.example.note}
        onExampleHide={() => setExample(false)}
      />
    );
  }
  if (state.kind !== "offer") return <HedgeTeaser state={state} onExample={() => setExample(true)} />;

  const decimals = state.pick.target.market.decimals || collateral?.decimals || FALLBACK_DECIMALS;
  const balanceBase = sheet?.ok ? sheet.value.spendableBase + sheet.value.venueCreditBase : null;
  const stakeBase = hedgeStakeBase({ exposureUsdE6: state.pick.exposureUsdE6, decimals, ticketMaxBase: null, balanceBase });
  return <HedgeCard pick={state.pick} stakeBase={stakeBase} decimals={decimals} symbol={collateral?.symbol ?? FALLBACK_SYMBOL} />;
}
