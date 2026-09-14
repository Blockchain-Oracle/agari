import type { Cluster } from "@agari/core/constants";
import type { AttributionHook, IntentJournal, StopGate } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import type { WalletSession } from "../react/wallet-session";
import { createSubmitter, type MarketsSubmitter } from "../submitter/create";
import type { VaultContracts } from "../vault/contracts";
import type { AuthorityKind } from "./authority";
import type { WriteRpc } from "../submitter/steps/message";
import { keypairAddress } from "./keypair";
import { keypairSigner } from "./keypair-signer";
import { createNonceQueue } from "./nonce-queue";

/**
 * Exactly one of these — a session signs one way, decided once, at construction:
 * - `wallet`: the person's Wallet Standard wallet, as a Kit signer (D-014, D-023);
 * - `secretKey`: a server role's 64-byte Solana keypair (ops actors, the desk, the settler).
 */
export type SessionSigner = { wallet: WalletSession } | { secretKey: Uint8Array };

export interface SubmitterSessionConfig {
  env: MarketsEnv;
  authority: AuthorityKind;
  signer: SessionSigner;
  /** Off-chain durability for this actor's intents. Defaults to an in-memory journal. */
  journal?: IntentJournal;
  stopGate?: StopGate;
  attribution?: AttributionHook;
  nowMs?: () => number;
  /** A server or script session's own RPC; a browser session uses the read runtime's. */
  rpc?: WriteRpc;
}

export interface SubmitterSession {
  readonly authority: AuthorityKind;
  readonly address: Address;
  readonly cluster: Cluster;
  /** The numeric cluster id product intents still bind (D-012). */
  readonly chainId: number;
  readonly submitter: MarketsSubmitter;
  /** Who signs product writes, and against which deployment. */
  readonly contracts: VaultContracts;
  readonly disposed: boolean;
  /** A disposed session can never sign again. */
  dispose(): Promise<void>;
}

export class SessionDisposedError extends Error {
  constructor(authority: AuthorityKind) {
    super(`the ${authority} session has been disposed; construct a new one to sign again`);
    this.name = "SessionDisposedError";
  }
}

/**
 * One account, one cluster, one authority, one writer.
 *
 * The signer is fixed at construction and never swapped, so an in-flight write can't find a different authority
 * than the one it started with. Disposal is required on disconnect, account switch, grant expiry or revocation.
 * A wallet session signs with the wallet's Kit signer; a `{ secretKey }` session with a Kit keypair signer (§3.4).
 */
export async function createSubmitterSession(config: SubmitterSessionConfig): Promise<SubmitterSession> {
  const { env, authority, signer } = config;
  const address = "wallet" in signer ? signer.wallet.address : keypairAddress(signer.secretKey);
  const transactionSigner = "wallet" in signer ? signer.wallet.signer : await keypairSigner(signer.secretKey);

  let disposed = false;
  const enqueue = createNonceQueue();
  const guardedEnqueue = <T>(task: () => Promise<T>): Promise<T> =>
    enqueue(() => (disposed ? Promise.reject(new SessionDisposedError(authority)) : task()));

  const contracts: VaultContracts = { signer: address, deployment: null };
  const submitter = createSubmitter({
    wallet: address,
    signer: transactionSigner,
    enqueue: guardedEnqueue,
    ...(config.rpc ? { rpc: config.rpc } : {}),
    ...(config.journal ? { journal: config.journal } : {}),
    ...(config.stopGate ? { stopGate: config.stopGate } : {}),
    ...(config.attribution ? { attribution: config.attribution } : {}),
    ...(config.nowMs ? { nowMs: config.nowMs } : {}),
  });

  return {
    authority,
    address,
    cluster: env.cluster,
    chainId: env.chainId,
    submitter,
    contracts,
    get disposed() {
      return disposed;
    },
    async dispose() {
      disposed = true;
    },
  };
}
