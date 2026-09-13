import type { AttributionHook, IntentJournal, StopGate } from "@masayume/core/ports";
import type { Address } from "@masayume/core/types";
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { createPublicClient, createWalletClient, http, type Account, type Hex, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveVaultDeployment } from "../vault/deployment";
import type { SponsorTransport } from "../vault/sponsor";
import type { VaultContracts } from "../vault/write";
import { resolveAddresses } from "../addresses";
import { SOMNIA_SHANNON } from "../chain";
import type { MarketsEnv } from "../env";
import { createSubmitter, type MarketsSubmitter } from "../submitter/create";
import type { AuthorityKind } from "./authority";
import { createNonceQueue } from "./nonce-queue";
import type { SessionTrader } from "./trader";

/** Exactly one of these — a session signs one way, decided once, at construction. */
export type SessionSigner = { walletClient: WalletClient } | { privateKey: Hex } | { account: Account };

export interface SubmitterSessionConfig {
  env: MarketsEnv;
  authority: AuthorityKind;
  signer: SessionSigner;
  /** Off-chain durability for this actor's intents. Defaults to an in-memory journal. */
  journal?: IntentJournal;
  stopGate?: StopGate;
  attribution?: AttributionHook;
  nowMs?: () => number;
  /** A relayer that pays for this session's allowlisted vault calls (the sponsorship policy). */
  sponsor?: SponsorTransport;
}

export interface SubmitterSession {
  readonly authority: AuthorityKind;
  readonly address: Address;
  readonly chainId: number;
  readonly submitter: MarketsSubmitter;
  readonly trader: SessionTrader;
  /** The same signer as viem clients, for Masayume's own contracts — what the open lane and the spikes hand to `submitParlayOpen`. */
  readonly contracts: VaultContracts;
  readonly disposed: boolean;
  /** Releases the session's own SDK instance. A disposed session can never sign again. */
  dispose(): Promise<void>;
}

/** The same signer, as a viem wallet client, for Masayume's own contracts. */
function walletClientFor(signer: SessionSigner, env: MarketsEnv): WalletClient {
  if ("walletClient" in signer) return signer.walletClient;
  const account = "privateKey" in signer ? privateKeyToAccount(signer.privateKey) : signer.account;
  return createWalletClient({ account, chain: SOMNIA_SHANNON, transport: http(env.rpcHttpUrls[0]) });
}

export class SessionDisposedError extends Error {
  constructor(authority: AuthorityKind) {
    super(`the ${authority} session has been disposed; construct a new one to sign again`);
    this.name = "SessionDisposedError";
  }
}

/**
 * One account, one chain, one authority, one writer.
 *
 * The session builds its OWN SomniaMarkets with the signer supplied in the constructor and
 * never calls `setSigner`, so its authority cannot be swapped underneath an in-flight write.
 * That is the whole difference from a process-wide mutable signer: two actors using the same
 * RPC endpoint no longer share a signing identity just because they share a transport.
 *
 * No `wsRpcUrl` is passed. The SDK only opens a socket when one is configured, so sessions
 * stay indexer-only and every subscription remains on the single shared read runtime.
 *
 * Disposal is required on disconnect, account switch, chain switch, grant expiry, or
 * revocation — the session is the unit that stops existing when authority ends.
 */
export async function createSubmitterSession(config: SubmitterSessionConfig): Promise<SubmitterSession> {
  const { env, authority, signer } = config;

  const exchange = new SomniaMarkets({
    indexerUrl: env.indexerUrl,
    chain: SOMNIA_SHANNON,
    addresses: resolveAddresses(),
    ...signer,
  });

  const address = exchange.walletAddress;
  if (!address) {
    await exchange.close().catch(() => undefined);
    throw new Error(`${authority} session was given a signer that resolves to no address`);
  }

  let disposed = false;
  const enqueue = createNonceQueue();
  const guardedEnqueue = <T>(task: () => Promise<T>): Promise<T> =>
    enqueue(() => {
      if (disposed) return Promise.reject(new SessionDisposedError(authority));
      return task();
    });

  const contracts: VaultContracts = {
    walletClient: walletClientFor(signer, env),
    // Our own HTTP client on the configured RPC: the SDK's viem client is WebSocket-only and, with no
    // socket configured, would answer from the chain's default endpoint — and a session opens no socket.
    publicClient: createPublicClient({ chain: SOMNIA_SHANNON, transport: http(env.rpcHttpUrls[0]) }),
    deployment: resolveVaultDeployment(env),
    ...(config.sponsor ? { sponsor: config.sponsor } : {}),
  };

  const submitter = createSubmitter({
    trader: exchange.trader,
    wallet: address as Address,
    enqueue: guardedEnqueue,
    contracts,
    ...(config.journal ? { journal: config.journal } : {}),
    ...(config.stopGate ? { stopGate: config.stopGate } : {}),
    ...(config.attribution ? { attribution: config.attribution } : {}),
    ...(config.nowMs ? { nowMs: config.nowMs } : {}),
  });

  return {
    authority,
    address: address as Address,
    chainId: SOMNIA_SHANNON.id,
    submitter,
    trader: exchange.trader,
    contracts,
    get disposed() {
      return disposed;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await exchange.close().catch(() => undefined);
    },
  };
}
