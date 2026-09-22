"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { createBrowserDeskRpc, readOwnerDeskBalances, type DeskRpc, type OwnerDeskBalances } from "@agari/markets/desk";
import { useReadingQuery } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { z } from "zod";
import { MAINNET_RPC_PATH } from "@/providers/wallet/mainnet-signer";
import { decisionSchema, deskViewSchema, feedSchema, recordsPageSchema, type DecisionWire, type DeskViewWire, type RecordsPageWire } from "./protocol";

/**
 * TanStack Query over the desk's routes (plan §5.7): one key family, decimal strings parsed by zod at the edge, the
 * desk page polled every half minute while open (the desk wakes hourly; a poll only ever catches an approval or a
 * fresh check sooner). The mainnet balances read for the money sheet goes through `/api/rpc/mainnet` (D-121).
 */
export const DESK_POLL_MS = 30_000;
const BALANCES_POLL_MS = 20_000;
/** The route's honest 503: the desk index (C4) is not on this deployment. Surfaces say so, never a skeleton. */
export const DESK_NOT_CONFIGURED = "desk-index-not-configured";
export const DESK_NOT_SHARED = "desk-not-shared";
export const DESK_NOT_FOUND = "desk-not-found";

export const deskKeys = {
  all: ["agari", "desk"] as const,
  view: (key: string | null, viewer: string | null) => ["agari", "desk", "view", key, viewer] as const,
  records: (key: string | null, viewer: string | null, before: number | null) => ["agari", "desk", "records", key, viewer, before] as const,
  decision: (key: string | null, seq: number | null, viewer: string | null) => ["agari", "desk", "decision", key, seq, viewer] as const,
  feed: (key: string | null, viewer: string | null) => ["agari", "desk", "feed", key, viewer] as const,
  balances: (owner: string | null, symbols: string) => ["agari", "desk", "balances", owner, symbols] as const,
};

const viewerQuery = (viewer: string | null): string => (viewer ? `viewer=${encodeURIComponent(viewer)}` : "");

async function readRoute<T>(url: string, schema: z.ZodType<T>): Promise<Reading<T>> {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 503) return err(diagnosis("not-deployed", DESK_NOT_CONFIGURED));
  if (response.status === 404) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return err(diagnosis("unknown", body?.error === "this desk is not shared" ? DESK_NOT_SHARED : DESK_NOT_FOUND));
  }
  if (!response.ok) return err(diagnosis("unknown", `desk route answered ${response.status}`));
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", `desk payload did not parse: ${parsed.error.issues[0]?.path.join(".") ?? "?"}`));
  return ok(parsed.data, Date.now());
}

/** The desk page in one read; `key` is the owner's address or the desk's id, `viewer` the connected wallet. */
export function useDeskView(key: string | null, viewer: Address | null, enabled = true): Reading<DeskViewWire> | null {
  return useReadingQuery(deskKeys.view(key, viewer), () => readRoute(`/api/desk/${encodeURIComponent(key as string)}?${viewerQuery(viewer)}`, deskViewSchema), { pollMs: DESK_POLL_MS, enabled: enabled && key !== null, needs: [] });
}

export function useDeskRecords(key: string | null, viewer: Address | null, before: number | null): Reading<RecordsPageWire> | null {
  const url = `/api/desk/${encodeURIComponent(key as string)}/records?${viewerQuery(viewer)}${before ? `&before=${before}` : ""}`;
  return useReadingQuery(deskKeys.records(key, viewer, before), () => readRoute(url, recordsPageSchema), { ...(before ? {} : { pollMs: DESK_POLL_MS }), enabled: key !== null, needs: [] });
}

export function useDecision(key: string | null, seq: number | null, viewer: Address | null): Reading<DecisionWire> | null {
  const url = `/api/desk/${encodeURIComponent(key as string)}/records/${seq}?${viewerQuery(viewer)}`;
  return useReadingQuery(deskKeys.decision(key, seq, viewer), () => readRoute(url, decisionSchema), { enabled: key !== null && seq !== null, needs: [] });
}

/** What happened after `since`, for the watcher: polled once a minute while Agari is open, only by the owner. */
export function useDeskFeed(key: string | null, viewer: Address | null, since: number, enabled: boolean, pollMs: number) {
  const url = `/api/desk/${encodeURIComponent(key as string)}/feed?${viewerQuery(viewer)}&since=${since}`;
  return useReadingQuery(deskKeys.feed(key, viewer), () => readRoute(url, feedSchema), { pollMs, enabled: enabled && key !== null && viewer !== null, needs: [] });
}

let browserRpc: DeskRpc | null = null;
const mainnetRpc = (): DeskRpc => (browserRpc ??= createBrowserDeskRpc(MAINNET_RPC_PATH));
type KitAddress = Parameters<typeof readOwnerDeskBalances>[1];

/** The owner's own mainnet SOL, USDC and the basket's names, for the money sheet's receipts; read only while it is open. */
export function useOwnerBalances(owner: Address | null, symbols: readonly PreIpoSymbol[], enabled: boolean): Reading<OwnerDeskBalances> | null {
  const list = symbols.join(",");
  return useReadingQuery(
    deskKeys.balances(owner, list),
    () => readOwnerDeskBalances(mainnetRpc(), owner as unknown as KitAddress, symbols, Math.floor(Date.now() / 1000)).then((value) => ok(value, Date.now())),
    { pollMs: BALANCES_POLL_MS, enabled: enabled && owner !== null, needs: [] },
  );
}

/** Every desk read refetches after a write: one family, one call. */
export function useInvalidateDesk(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: deskKeys.all }), [queryClient]);
}
