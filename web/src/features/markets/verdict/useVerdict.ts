"use client";

import { deriveVerdict } from "@masayume/core/claims";
import { ONCHAIN_POLL_MS, VERDICT_POLL_MS } from "@masayume/core/constants";
import { combineReadings, isOk, mapReading, type Reading } from "@masayume/core/schemas";
import type { Address, EventMarket, MarketId, Resolution, Verdict } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";
import { marketsProvider } from "@masayume/markets";
import { keys, useHoldings, useMarket, useOnchain, usePositions, useReadingQuery, useTick } from "@masayume/markets/react";
import { useMemo, useRef } from "react";

export type VerdictPhase = "open" | "settling" | "settled";

export interface VerdictState {
  phase: VerdictPhase;
  market: Reading<EventMarket | null> | null;
  /** null until the window is settled; a settled reading holds null when the wallet held nothing in it. */
  verdict: Reading<Verdict | null> | null;
  resolution: Reading<Resolution> | null;
}

const RENDER_TICK_MS = 1_000;

/** The settlement tx lands a beat after the status flips, so the record is polled until it carries one. */
function useSettledResolution(marketId: MarketId | null, settled: boolean): Reading<Resolution> | null {
  return useReadingQuery(keys.resolution(marketId), () => marketsProvider.getResolution(marketId as MarketId), {
    enabled: marketId !== null && settled,
    pollMs: (reading) => (reading && isOk(reading) && reading.value.settlementTxHash !== null ? false : VERDICT_POLL_MS),
  });
}

/** The venue's settlement fee for one Window, read once it is needed — the receipt and The Call both print net of it. */
export function useSettlementFee(marketId: MarketId | null, settled: boolean): Reading<number> | null {
  return useReadingQuery([...keys.fee(marketId), "bps"], () => marketsProvider.settlementFeeBps(marketId as MarketId), {
    enabled: marketId !== null && settled,
  });
}

/** Watches one window for its wallet: polls the chain every few seconds once expiry passes, then derives the one verdict. */
export function useVerdict({ marketId, wallet }: { marketId: MarketId | null; wallet: Address | null }): VerdictState {
  useTick(RENDER_TICK_MS);
  const nowMs = marketsProvider.nowMs();
  const market = useMarket(marketId);
  const expirySec = market?.ok && market.value ? market.value.expirySec : null;
  const pastExpiry = expirySec !== null && nowMs >= secToMs(expirySec);

  // The poll cadence depends on the previous answer; the ref carries it across renders without an extra state round-trip.
  const settledRef = useRef(false);
  const onchain = useOnchain(marketId, settledRef.current ? false : pastExpiry ? VERDICT_POLL_MS : ONCHAIN_POLL_MS);
  const snapshot = onchain?.ok ? onchain.value : null;
  const settled = snapshot !== null && (snapshot.isResolved || snapshot.isVoided);
  settledRef.current = settled;

  const holdings = useHoldings(wallet, settled ? snapshot : null, false);
  const positions = usePositions(wallet);
  const fee = useSettlementFee(marketId, settled);
  const resolution = useSettledResolution(marketId, settled);

  const verdict = useMemo<Reading<Verdict | null> | null>(() => {
    if (!settled || snapshot === null || marketId === null || holdings === null || fee === null) return null;
    const costBasisBase = positions?.ok ? (positions.value.find((p) => p.marketId === marketId)?.costBasisBase ?? null) : null;
    const settledAtMs = resolution?.ok ? resolution.value.settledAtMs : null;
    return mapReading(combineReadings(holdings, fee), ([held, feeBps]) =>
      deriveVerdict({ marketId, settlement: snapshot, holdings: held, feeBps, decimals: snapshot.decimals, costBasisBase, settledAtMs }),
    );
  }, [settled, snapshot, marketId, holdings, fee, positions, resolution]);

  return { phase: settled ? "settled" : pastExpiry ? "settling" : "open", market, verdict, resolution };
}
