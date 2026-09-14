/**
 * The shared read runtime (one per browser tab or server process).
 *
 * It holds the configured cluster, endpoints and program ids, and has no signer. Every signer lives in its own
 * `SubmitterSession` (../sessions), so a read-endpoint change can never move a write's authority. It is a descriptor:
 * the Kit RPC and subscriptions are built from it lazily (`solana.ts`) and rebuilt when it is reconfigured.
 */
import type { Cluster } from "@agari/core/constants";
import type { ArenaDeployment } from "@agari/core/games";
import type { LeverageDeployment } from "@agari/core/leverage";
import type { MakerDeployment } from "@agari/core/maker";
import type { ParlayDeployment } from "@agari/core/parlay";
import type { PrivateDeployment } from "@agari/core/private";
import type { RangeDeployment } from "@agari/core/range";
import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import type { MarketsEnv } from "../env";
import { mark } from "../perf/milestones";

/** What the runtime is pointed at. A descriptor, not a connection (`solana()` builds the Kit clients from it). */
export interface ReadClient {
  cluster: Cluster;
  rpcHttpUrl: string;
  rpcWsUrl: string | null;
  /** The agari-events program id, or null until S2 deploys it. */
  eventsProgramId: Address | null;
}

let client: ReadClient | null = null;
let version = 0;
const listeners = new Set<() => void>();
const teardowns = new Set<() => void>();

/** Builds the module-level runtime. Every consumer (web, ops, scripts) shares this one instance. */
export function configureMarkets(env: MarketsEnv): void {
  client = {
    cluster: env.cluster,
    rpcHttpUrl: env.rpcHttpUrls[0] as string,
    rpcWsUrl: env.rpcWsUrls[0] ?? null,
    eventsProgramId: env.eventsProgramId ?? null,
  };
  version += 1;
  mark("runtime.configured");
  for (const listener of listeners) listener();
}

/** Configures once per process; safe to call from every entry point. */
export function ensureMarkets(env: MarketsEnv): void {
  if (!client) configureMarkets(env);
}

export function getClient(): ReadClient {
  if (!client) throw new Error("markets port not configured — call configureMarkets(env) first");
  return client;
}

/** The configured runtime, or null before `configureMarkets` (a script or test reading with the devnet defaults). */
export function peekClient(): ReadClient | null {
  return client;
}

/** Bumps whenever the runtime is rebuilt so React providers can re-key. */
export function exchangeVersion(): number {
  return version;
}

export function subscribeExchange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Registers work that must run before the runtime is closed (releasing account subscriptions, from S4). */
export function onRuntimeClose(teardown: () => void): () => void {
  teardowns.add(teardown);
  return () => teardowns.delete(teardown);
}

export async function closeRuntime(): Promise<void> {
  client = null;
  for (const teardown of [...teardowns]) teardown();
}

/**
 * Product deployments on the configured cluster. Every product read branches on these, and each is null until its
 * program is deployed (vault S7, maker S8, strategies S9, parlay/range/leverage/private S10, arena S12).
 */
export const getVaultDeployment = (): VaultDeployment | null => null;
export const getParlayDeployment = (): ParlayDeployment | null => null;
export const getRangeDeployment = (): RangeDeployment | null => null;
export const getMakerDeployment = (): MakerDeployment | null => null;
export const getLeverageDeployment = (): LeverageDeployment | null => null;
export const getPrivateDeployment = (): PrivateDeployment | null => null;
export const getArenaDeployment = (): ArenaDeployment | null => null;
