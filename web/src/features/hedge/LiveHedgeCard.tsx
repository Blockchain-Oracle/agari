"use client";

import type { LaneSet, MarketId, Side } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet } from "@agari/markets/react";
import { useWalletSession } from "@/lib/wallet-session";
import { HedgeCard } from "./HedgeCard";
import { hedgeStakeBase } from "./hedge-size";
import { pickHedge } from "./hedge-target";
import { useHoldings } from "./useHoldings";

const FALLBACK_SYMBOL = "tUSDC";
const FALLBACK_DECIMALS = 6;

interface LiveHedgeCardProps {
  laneSet: LaneSet | null;
  nowMs: number;
  onSelect: (marketId: MarketId, side?: Side) => void;
}

/**
 * The hedge card for the connected wallet, under the `/markets` hero (Q-S6-8). It renders only for a wallet with a
 * verified mainnet holding and a Window of that underlying trading now; everything else — no wallet, no holding, a
 * failed read — renders nothing, since the card is an offer, not a status.
 */
export function LiveHedgeCard({ laneSet, nowMs, onSelect }: LiveHedgeCardProps) {
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const sheet = useBalanceSheet(address);
  const pick = holdings?.ok ? pickHedge(holdings.value, laneSet, nowMs) : null;
  if (!pick) return null;
  const collateral = collateralOrNull();
  const decimals = pick.target.market.decimals || collateral?.decimals || FALLBACK_DECIMALS;
  const balanceBase = sheet?.ok ? sheet.value.spendableBase + sheet.value.venueCreditBase : null;
  const stakeBase = hedgeStakeBase({ exposureUsdE6: pick.exposureUsdE6, decimals, ticketMaxBase: null, balanceBase });
  return <HedgeCard pick={pick} stakeBase={stakeBase} decimals={decimals} symbol={collateral?.symbol ?? FALLBACK_SYMBOL} onSelect={onSelect} />;
}
