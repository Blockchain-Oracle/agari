"use client";

import { diagnosis, err, ok, type Reading } from "@masayume/core";
import type { StrategySubscription } from "@masayume/core/strategies";
import type { Address } from "@masayume/core/types";
import { useReadingQuery } from "@masayume/markets/react";
import { listSubscriptionsOf } from "@masayume/markets/strategies";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { healthPayloadSchema, strategiesPayloadSchema, type HealthPayload, type StrategiesPayload } from "./protocol";

const POLL_MS = 30_000;
const HEALTH_POLL_MS = 60_000;
export const STRATEGIES_KEY = ["masayume", "strategies"] as const;
export const strategyHealthKey = (ids: string) => ["masayume", "strategies", "health", ids] as const;
export const subscriptionsKey = (wallet: string | null) => ["masayume", "strategies", "subscriptions", wallet] as const;

async function readStrategies(): Promise<Reading<StrategiesPayload>> {
  const response = await fetch("/api/strategies", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("rpc-down", `strategies route answered ${response.status}`));
  const parsed = strategiesPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("rpc-down", "strategies payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** The reference's 30 s catalogue poll (`load` + `setInterval(load, 30_000)`), visibility-gated. */
export function useStrategies(): Reading<StrategiesPayload> | null {
  return useReadingQuery(STRATEGIES_KEY, readStrategies, { pollMs: POLL_MS, needs: [] });
}

async function readHealth(ids: string): Promise<Reading<HealthPayload>> {
  const response = await fetch(`/api/strategies/health?ids=${ids}`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("rpc-down", `health route answered ${response.status}`));
  const parsed = healthPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("rpc-down", "health payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** The runner's heartbeat, polled once a minute — the reference's `/api/desk/health` cadence. */
export function useStrategyHealth(strategyIds: readonly string[]): Reading<HealthPayload> | null {
  const ids = strategyIds.join(",");
  return useReadingQuery(strategyHealthKey(ids), () => readHealth(ids), { pollMs: HEALTH_POLL_MS, enabled: ids.length > 0, needs: [] });
}

/** The connected wallet's consents, read off the registry itself. */
export function useMySubscriptions(wallet: Address | null, strategyIds: readonly bigint[]): Reading<StrategySubscription[]> | null {
  const key = strategyIds.map(String).join(",");
  return useReadingQuery(subscriptionsKey(wallet ? `${wallet}:${key}` : null), () => listSubscriptionsOf(wallet as Address, strategyIds), {
    pollMs: POLL_MS,
    enabled: wallet !== null && strategyIds.length > 0,
  });
}

export function useRefreshStrategies(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY });
  }, [queryClient]);
}
