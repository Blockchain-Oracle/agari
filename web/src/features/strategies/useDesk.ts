"use client";

import type { StrategySubscription } from "@masayume/core/strategies";
import type { VaultGrant, VaultSnapshot } from "@masayume/core/vault";
import { isOk, type Reading } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import { useMemo } from "react";
import type { StrategiesPayload, StrategyWire } from "./protocol";
import { useMySubscriptions, useStrategyHealth } from "./useStrategies";
import { copyStateOf, type CopyState } from "./lifecycle";

export interface DeskModel {
  /** The house desk: the active strategy with the most copiers, ties to the oldest. */
  featured: StrategyWire | null;
  subscriptions: StrategySubscription[];
  subscriptionOf: (strategyId: string) => StrategySubscription | null;
  /** The wallet's live STRATEGY grant when it backs the featured subscription. */
  grant: VaultGrant | null;
  copying: boolean;
  paused: boolean;
  /** Consent on record but the grant names a runner the strategy no longer uses. */
  staleRunner: boolean;
  state: CopyState;
  readable: boolean;
  /** The desk balance: what the grant may still spend. */
  ledgerBase: bigint;
  availableBase: bigint;
  health: ReturnType<typeof useStrategyHealth>;
}

export function featuredOf(strategies: readonly StrategyWire[]): StrategyWire | null {
  return [...strategies].filter((s) => s.active).sort((a, b) => b.subscribers - a.subscribers || Number(BigInt(a.strategyId) - BigInt(b.strategyId)))[0] ?? null;
}

export function useDesk(payload: StrategiesPayload | null, wallet: Address | null, snapshot: Reading<VaultSnapshot | null> | null, selectedId?: string | null): DeskModel {
  const strategies = payload?.strategies ?? [];
  const ids = useMemo(() => strategies.map((s) => BigInt(s.strategyId)), [strategies]);
  const subsReading = useMySubscriptions(wallet, ids);
  const subscriptions = subsReading && isOk(subsReading) ? subsReading.value : [];
  const health = useStrategyHealth(strategies.map((s) => s.strategyId));
  const featured = strategies.find((s) => s.strategyId === selectedId) ?? strategies.find((s) => subscriptions.some((sub) => sub.live && sub.strategyId.toString() === s.strategyId)) ?? featuredOf(strategies);
  const vault = snapshot && isOk(snapshot) ? snapshot.value : null;
  const strategyGrant = vault?.grants.strategy ?? null;

  const subscriptionOf = (strategyId: string) => subscriptions.find((s) => s.strategyId.toString() === strategyId) ?? null;
  const mine = featured ? subscriptionOf(featured.strategyId) : null;
  const grant = mine && strategyGrant && strategyGrant.grantId === mine.grantId ? strategyGrant : null;
  const readable = !wallet || Boolean((strategies.length === 0 || subsReading && isOk(subsReading) && !subsReading.stale) && snapshot && isOk(snapshot) && !snapshot.stale);
  const state = featured ? copyStateOf(featured, mine, strategyGrant, Math.floor(Date.now() / 1000), readable) : "not-copying";
  const copying = state === "copying";
  const paused = Boolean(mine && !copying);
  const staleRunner = state === "runner-changed";

  return {
    featured,
    subscriptions,
    subscriptionOf,
    grant,
    copying,
    paused,
    staleRunner,
    state,
    readable,
    ledgerBase: grant?.budgetBase ?? 0n,
    availableBase: vault?.account.availableBase ?? 0n,
    health,
  };
}
