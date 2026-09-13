/**
 * The shared read-only DreamDEX runtime.
 *
 * One instance per browser tab or server process: public/indexer clients, market metadata,
 * subscriptions and caches. It has NO mutable account and NO signer, and it never exposes
 * `.trader` — so an endpoint rotation can never change any actor's signing authority, and
 * two actors can never end up sharing one mutable signer.
 *
 * Everything that signs uses its own SubmitterSession (see ../sessions).
 */
import { SOMNIA_TESTNET_PRICE_FEED, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { resolveAddresses } from "../addresses";
import { mark } from "../perf/milestones";
import { SOMNIA_SHANNON } from "../chain";
import type { MarketsEnv } from "../env";
import { resolveParlayDeployment } from "../parlay/deployment";
import { resolveRangeDeployment } from "../range/deployment";
import { resolveMakerDeployment } from "../maker/deployment";
import { resolveLeverageDeployment } from "../leverage/deployment";
import { resolvePrivateDeployment } from "../private/deployment";
import { resolveArenaDeployment } from "../games/deployment";
import { resolveVaultDeployment } from "../vault/deployment";
import type { ParlayDeployment } from "@masayume/core/parlay";
import type { RangeDeployment } from "@masayume/core/range";
import type { MakerDeployment } from "@masayume/core/maker";
import type { LeverageDeployment } from "@masayume/core/leverage";
import type { PrivateDeployment } from "@masayume/core/private";
import type { ArenaDeployment } from "@masayume/core/games";
import type { VaultDeployment } from "@masayume/core/vault";

type ExchangeConfig = ConstructorParameters<typeof SomniaMarkets>[0];

/** Runtime rotation rebuilds the singleton and drops every live watch, so it stays opt-in (plan ruling #8). */
export const AUTO_ROTATE_RPC = false;

let exchange: SomniaMarkets | null = null;
let vaultDeployment: VaultDeployment | null = null;
let parlayDeployment: ParlayDeployment | null = null;
let rangeDeployment: RangeDeployment | null = null;
let makerDeployment: MakerDeployment | null = null;
let leverageDeployment: LeverageDeployment | null = null;
let privateDeployment: PrivateDeployment | null = null;
let arenaDeployment: ArenaDeployment | null = null;
let version = 0;
let wsIndex = 0;
const listeners = new Set<() => void>();
const teardowns = new Set<() => void>();

function buildConfig(env: MarketsEnv, wsRpcUrl: string | undefined): ExchangeConfig {
  return {
    indexerUrl: env.indexerUrl,
    chain: SOMNIA_SHANNON,
    wsRpcUrl,
    addresses: resolveAddresses(),
    priceFeed: env.priceFeedUrl ? { url: env.priceFeedUrl, quote: env.priceFeedQuote } : SOMNIA_TESTNET_PRICE_FEED,
  };
}

/**
 * Builds the module-level read runtime. Every consumer (web, ops, scripts) shares this one
 * instance. It returns nothing on purpose: handing the SomniaMarkets object back would hand
 * out `.trader` and `.setSigner` with it, which is exactly the coupling this split removes.
 */
export function configureMarkets(env: MarketsEnv, options: { wsIndex?: number } = {}): void {
  wsIndex = options.wsIndex ?? wsIndex;
  const previous = exchange;
  exchange = new SomniaMarkets(buildConfig(env, env.rpcWsUrls[wsIndex] ?? env.rpcWsUrls[0]));
  vaultDeployment = resolveVaultDeployment(env);
  parlayDeployment = resolveParlayDeployment(env);
  rangeDeployment = resolveRangeDeployment(env);
  makerDeployment = resolveMakerDeployment(env);
  leverageDeployment = resolveLeverageDeployment(env);
  privateDeployment = resolvePrivateDeployment(env);
  arenaDeployment = resolveArenaDeployment(env);
  version += 1;
  mark("runtime.configured");
  if (previous) void previous.close().catch(() => undefined);
  for (const listener of listeners) listener();
}

/** Configures once per process; safe to call from every entry point. */
export function ensureMarkets(env: MarketsEnv): void {
  if (!exchange) configureMarkets(env);
}

function getExchange(): SomniaMarkets {
  if (!exchange) throw new Error("markets port not configured — call configureMarkets(env) first");
  return exchange;
}

export function getClient() {
  return getExchange().client;
}

/** The EventVault for the configured chain, or null where none is deployed — every vault read branches on this. */
export function getVaultDeployment(): VaultDeployment | null {
  return vaultDeployment;
}

/** The ParlayReserve for the configured chain, or null where none is deployed — every parlay read branches on this. */
export function getParlayDeployment(): ParlayDeployment | null {
  return parlayDeployment;
}

/** The RangeReserve for the configured chain, or null where none is deployed — every range read branches on this. */
export function getRangeDeployment(): RangeDeployment | null {
  return rangeDeployment;
}

/** The MarketMakerVault for the configured chain, or null where none is deployed — every maker read branches on this. */
export function getMakerDeployment(): MakerDeployment | null {
  return makerDeployment;
}

/** The GameArena for the configured chain, or null where none is deployed — every duel read branches on this. */
export function getArenaDeployment(): ArenaDeployment | null {
  return arenaDeployment;
}

/** Bumps whenever the singleton is rebuilt so React providers can re-key. */
export function exchangeVersion(): number {
  return version;
}

/**
 * Registers work that must run before the shared client is closed — releasing the watch handles
 * held on it, above all. Kept as a registry rather than a direct call so nothing downstream of the
 * runtime has to be imported back into it.
 */
export function onRuntimeClose(teardown: () => void): () => void {
  teardowns.add(teardown);
  return () => teardowns.delete(teardown);
}

/** Releases the shared runtime and its watches. */
export async function closeRuntime(): Promise<void> {
  const previous = exchange;
  exchange = null;
  for (const teardown of [...teardowns]) teardown();
  await previous?.close().catch(() => undefined);
}

export function activeWsIndex(): number {
  return wsIndex;
}

export function subscribeExchange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rebuilds the singleton on the next endpoint in the list (both testnet RPCs are configured, NFR-10). */
export function rotateRpc(env: MarketsEnv): void {
  const next = (wsIndex + 1) % Math.max(1, env.rpcWsUrls.length);
  configureMarkets(env, { wsIndex: next });
}

/** The LeverageReserve for the configured chain, or null where none is deployed — every boost read branches on this. */
export function getLeverageDeployment(): LeverageDeployment | null {
  return leverageDeployment;
}

/** The PrivateDesk for the configured chain, or null where none is deployed — every private read branches on this. */
export function getPrivateDeployment(): PrivateDeployment | null {
  return privateDeployment;
}
