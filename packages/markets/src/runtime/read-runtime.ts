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
  /** The agari-events program id override; null reads the Codama client's (the deployed one). */
  eventsProgramId: Address | null;
  /** The configured venue id override (`NEXT_PUBLIC_AGARI_VENUE_ID`); it must equal the derived config PDA. */
  venueId: Address | null;
  /** The agari-vault program id (`NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID`); null = no vault on this cluster (S7). */
  vaultProgramId: Address | null;
  rangeProgramId: Address | null;
  makerProgramId: Address | null;
  /** `/api/index` base (absolute); null = no indexer, lists read `indexer-down`. */
  indexerUrl: string | null;
  /** The ops HTTP base serving `/prices/latest` and `/prices/stream`; null = no spot. */
  priceFeedUrl: string | null;
}

let client: ReadClient | null = null;
let version = 0;
/** What `loadVaultDeployment` last learned about one vault program id on these endpoints; dropped with the runtime. */
let vaultProbe: VaultProbe | null = null;

export interface VaultProbe {
  programId: Address;
  /** Null = the program's `VaultConfig` account does not exist: not deployed. */
  deployment: VaultDeployment | null;
  checkedAtMs: number;
}
const listeners = new Set<() => void>();
const teardowns = new Set<() => void>();

/** Builds the module-level runtime. Every consumer (web, ops, scripts) shares this one instance. */
export function configureMarkets(env: MarketsEnv): void {
  client = {
    cluster: env.cluster,
    rpcHttpUrl: env.rpcHttpUrls[0] as string,
    rpcWsUrl: env.rpcWsUrls[0] ?? null,
    eventsProgramId: env.eventsProgramId ?? null,
    venueId: env.venueId ?? null,
    vaultProgramId: env.vaultProgramId ?? null,
    rangeProgramId: env.rangeProgramId ?? null,
    makerProgramId: env.makerProgramId ?? null,
    indexerUrl: env.indexerUrl ?? null,
    priceFeedUrl: env.priceFeedUrl ?? null,
  };
  version += 1;
  vaultProbe = null;
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
  vaultProbe = null;
  for (const teardown of [...teardowns]) teardown();
}

/**
 * Product deployments on the configured cluster. Every product read branches on these, and each is null until its
 * program is deployed (vault S7: once a read has found its `VaultConfig`, `vault/deployment.ts`; maker S8, strategies S9, parlay/range/leverage/private S10, arena S12).
 */
export const getVaultDeployment = (): VaultDeployment | null =>
  client?.vaultProgramId && vaultProbe?.programId === client.vaultProgramId ? vaultProbe.deployment : null;

/** The vault probe's slot (`vault/deployment.ts` writes it), kept here so every reader sees one answer per runtime. */
export function peekVaultProbe(): VaultProbe | null {
  return vaultProbe;
}

export function recordVaultProbe(probe: VaultProbe): void {
  vaultProbe = probe;
}
export const getParlayDeployment = (): ParlayDeployment | null => null;
export const getRangeDeployment = (): RangeDeployment | null => null;
export const getMakerDeployment = (): MakerDeployment | null => null;
export const getLeverageDeployment = (): LeverageDeployment | null => null;
export const getPrivateDeployment = (): PrivateDeployment | null => null;
export const getArenaDeployment = (): ArenaDeployment | null => null;
