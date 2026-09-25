import type { Reading } from "@agari/core";
import { TICKERS } from "@agari/core/market";
import type { LaneSet, MarketId, Side } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet } from "@agari/markets/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { calmSet, holdsPreIpo } from "@/features/hedge/calm";
import { HEDGE } from "@/features/hedge/copy";
import { examplePick } from "@/features/hedge/example";
import { hedgeStakeBase } from "@/features/hedge/hedge-size";
import { hedgeCardState } from "@/features/hedge/hedge-state";
import { pickHedge } from "@/features/hedge/hedge-target";
import { useHoldings, type HoldingView } from "@/features/hedge/useHoldings";
import { usePreIpoFactsAll } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { storage } from "~/lib/storage";
import { pushToast } from "~/components/toast/store";
import { HedgeCard, HedgeTeaser } from "./HedgeCard";

const FALLBACK_SYMBOL = "tUSDC";
const FALLBACK_DECIMALS = 6;
// Base58 is case-sensitive: the address is keyed exactly as written, as web keys it.
const NOTICED_KEY = (address: string) => `agari.holdings.noticed.${address}`;

/** Without a page to select on (the default), a side opens the ticket for that Window. */
const openTicket = (marketId: MarketId, side?: Side) => router.push({ pathname: "/ticket", params: side ? { m: marketId, dir: side } : { m: marketId } });

interface LiveHedgeCardProps {
  laneSet: LaneSet | null;
  nowMs: number;
  /** The markets page's selection; the ticket opens on that Window when omitted. */
  onSelect?: (marketId: MarketId, side?: Side) => void;
}

/** web's one quiet toast the first time a wallet is found to hold something; the per-address key means never again. */
function useNoticedOnce(address: string | null, holdings: Reading<HoldingView[]> | null) {
  useEffect(() => {
    if (address === null || !holdings?.ok) return;
    const lead = holdings.value[0];
    if (!lead || storage.getString(NOTICED_KEY(address))) return;
    storage.set(NOTICED_KEY(address), "1");
    pushToast({ title: HEDGE.noticed.title(TICKERS[lead.underlying].name), description: HEDGE.noticed.body, tone: "neutral" });
  }, [address, holdings]);
}

/**
 * web's `LiveHedgeCard`, under the /markets hero: the cover offer for a wallet with a verified stock-token holding and
 * a Window of that company trading now, and otherwise one of the teaser states, so the feature is never invisible.
 * "See an example" runs sample holdings through the same picker, stamped; a tap on the example leaves example mode.
 */
export function LiveHedgeCard({ laneSet, nowMs, onSelect = openTicket }: LiveHedgeCardProps) {
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const sheet = useBalanceSheet(address);
  const [example, setExample] = useState(false);
  useNoticedOnce(address, holdings);

  // A pre-IPO name the feed measures as calm is never offered a Down bet; the facts read runs only when one is held.
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
