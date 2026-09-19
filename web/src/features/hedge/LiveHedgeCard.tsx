"use client";

import { TICKERS } from "@agari/core/market";
import type { LaneSet, MarketId, Side } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet } from "@agari/markets/react";
import { useEffect, useState } from "react";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { HEDGE } from "./copy";
import { examplePick } from "./example";
import { HedgeCard } from "./HedgeCard";
import { hedgeStakeBase } from "./hedge-size";
import { hedgeCardState } from "./hedge-state";
import { pickHedge } from "./hedge-target";
import { calmSet, holdsPreIpo } from "./calm";
import { usePreIpoFactsAll } from "@/features/ticker-hub/usePreIpoFacts";
import { HedgeTeaser } from "./HedgeTeaser";
import { useHoldings, type HoldingView } from "./useHoldings";
import type { Reading } from "@agari/core";

const FALLBACK_SYMBOL = "tUSDC";
const FALLBACK_DECIMALS = 6;
// Base58 is case-sensitive: the address is keyed exactly as written (D-010), as `features/funding/credited.ts` does.
const NOTICED_KEY = (address: string) => `agari.holdings.noticed.${address}`;

interface LiveHedgeCardProps {
  laneSet: LaneSet | null;
  nowMs: number;
  onSelect: (marketId: MarketId, side?: Side) => void;
}

/** One quiet toast the first time a wallet is found to hold something; the per-address guard means never again. */
function useNoticedOnce(address: string | null, holdings: Reading<HoldingView[]> | null) {
  useEffect(() => {
    if (address === null || !holdings?.ok) return;
    const lead = holdings.value[0];
    if (!lead) return;
    try {
      if (localStorage.getItem(NOTICED_KEY(address))) return;
      localStorage.setItem(NOTICED_KEY(address), "1");
    } catch {
      return; // storage refused: the card itself still says it, so no toast is needed
    }
    notify.neutral(HEDGE.noticed.title(TICKERS[lead.underlying].name), HEDGE.noticed.body);
  }, [address, holdings]);
}

/**
 * The cover card for the connected wallet, under the `/markets` hero (Q-S6-8; plan Step 2). It renders the offer for a
 * wallet with a verified mainnet holding and a Window of that underlying trading now, and otherwise one of the teaser
 * states, so the feature is never invisible. "See an example" runs sample holdings through the same picker, stamped.
 */
export function LiveHedgeCard({ laneSet, nowMs, onSelect }: LiveHedgeCardProps) {
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const sheet = useBalanceSheet(address);
  const [example, setExample] = useState(false);
  useNoticedOnce(address, holdings);

  // Plan §2: a pre-IPO name the feed measures as calm is never offered a Down bet; the facts read runs only when one is held.
  const facts = usePreIpoFactsAll(holdings?.ok === true && holdsPreIpo(holdings.value));
  const calm = calmSet(facts?.ok ? facts.value : null);
  const pick = holdings?.ok ? pickHedge(holdings.value, laneSet, nowMs, calm) : null;
  const state = hedgeCardState({ address, holdings, pick, clockReady: nowMs !== 0, calm });
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
        onSelect={() => setExample(false)}
        stamp={HEDGE.example.stamp}
        ctaText={HEDGE.example.hide}
        note={HEDGE.example.note}
      />
    );
  }
  if (state.kind !== "offer") return <HedgeTeaser state={state} onExample={() => setExample(true)} />;

  const decimals = state.pick.target.market.decimals || collateral?.decimals || FALLBACK_DECIMALS;
  const balanceBase = sheet?.ok ? sheet.value.spendableBase + sheet.value.venueCreditBase : null;
  const stakeBase = hedgeStakeBase({ exposureUsdE6: state.pick.exposureUsdE6, decimals, ticketMaxBase: null, balanceBase });
  return <HedgeCard pick={state.pick} stakeBase={stakeBase} decimals={decimals} symbol={collateral?.symbol ?? FALLBACK_SYMBOL} onSelect={onSelect} />;
}
