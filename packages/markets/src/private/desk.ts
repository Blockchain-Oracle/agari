/**
 * The private desk's server side. On Solana it is `agari-private` plus an ed25519 desk key whose claims are verified
 * off-chain (PD-4, S10). Until then the desk client exists only to name its key, and every desk operation refuses.
 */
import { CLUSTER_ID, DEFAULT_CLUSTER } from "@agari/core/constants";
import { PRIVATE_NOT_DEPLOYED, type PrivateCashoutResult, type PrivateClaim, type PrivateOpenResult, type PrivateStatus } from "@agari/core/private";
import type { Address, MarketId, Side, Signature } from "@agari/core/types";
import { keypairAddress } from "../sessions/keypair";

export interface DeskClient {
  readonly address: Address;
  /** The numeric cluster id product types still bind (D-012). */
  readonly chainId: number;
  /** The `agari-private` desk account, or null until S10 deploys it. */
  readonly contract: Address | null;
}

export interface DeskClientConfig {
  /** The desk role's 64-byte Solana keypair (`PRIVATE_DESK_PRIVATE_KEY`, parsed with `parseSecretKey`). */
  secretKey: Uint8Array;
  rpcUrl: string;
}

export function createDeskClient({ secretKey }: DeskClientConfig): DeskClient {
  return { address: keypairAddress(secretKey), chainId: CLUSTER_ID[DEFAULT_CLUSTER], contract: null };
}

export class ClaimRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimRefusedError";
  }
}

export interface DeskOpenInput {
  owner: Address;
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  minQuantityRaw: bigint;
  /** The owner's ed25519 signature over `privateOpenMessage` (base58). */
  authSignature: Signature;
  issuedAtMs: number;
  asset: string;
  intervalSec: number;
  expirySec: number;
}

/** The first line only: an RPC error's message can carry the endpoint and request body, which anonymous callers never see. */
export function publicReason(technical: string): string {
  return technical.split("\n")[0]?.trim() || "the desk could not complete this";
}

/** Whether the private route can run right now, and every reason it cannot — so the control never silently does nothing. */
export async function deskHealth(desk: DeskClient | null): Promise<PrivateStatus> {
  const reasons: string[] = [PRIVATE_NOT_DEPLOYED];
  if (!desk) reasons.push("no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
  return {
    ready: false,
    reasons,
    mode: "desk-signed-slot",
    desk: desk?.address ?? null,
    contract: null,
    chainId: desk?.chainId ?? CLUSTER_ID[DEFAULT_CLUSTER],
    minStakeBase: null,
    maxStakeBase: null,
    paused: false,
  };
}

/** Nothing moves without the desk program: the bet is refused before any charge. */
export async function openPrivateBet(_desk: DeskClient, _input: DeskOpenInput): Promise<PrivateOpenResult> {
  return { status: "refused", reason: PRIVATE_NOT_DEPLOYED, technical: "not-deployed", refundedBase: "0", txs: {} };
}

export async function cashOutPrivateBet(_desk: DeskClient, _claim: PrivateClaim, _signature: Signature): Promise<PrivateCashoutResult> {
  throw new ClaimRefusedError(PRIVATE_NOT_DEPLOYED);
}
