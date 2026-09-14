import { SIGNED_MESSAGE_BRAND, networkLine } from "../auth/signed-message";

/** Devnet SOL onboarding policy, in lamports: enough for fees when a send isn't sponsored, never a balance. */
export const SOL_FAUCET_POLICY = {
  cluster: "devnet",
  thresholdLamports: 5_000_000n,
  targetLamports: 20_000_000n,
  dailyLamports: 1_000_000_000n,
  reserveLamports: 2_000_000_000n,
  maxTransferFeeLamports: 10_000n,
  cooldownMs: 86_400_000,
  challengeTtlMs: 300_000,
  maxPerIpPerDay: 10,
} as const;

export type FaucetClaimStatus = "prepared" | "confirmed" | "reverted" | "conflict";
export interface FaucetClaim {
  id: string;
  wallet: string;
  funder: string;
  ipHash: string;
  amountLamports: string;
  feeLamports: string;
  /** The signed transfer stays valid until this block height; a `prepared` claim is reconciled against it, never resent. */
  lastValidBlockHeight: number;
  txHash: string;
  rawTransaction: string;
  status: FaucetClaimStatus;
  createdAtMs: number;
}
export interface FaucetChallenge {
  id: string;
  wallet: string;
  ipHash: string;
  message: string;
  createdAtMs: number;
  expiresAtMs: number;
}
export interface FaucetClaimView {
  id: string;
  amountLamports: string;
  txHash: string;
  status: FaucetClaimStatus;
  nextClaimAtMs: number;
}
export interface FaucetStatus {
  configured: boolean;
  ready: boolean;
  address: string | null;
  fundingBalanceLamports: string | null;
  walletBalanceLamports: string | null;
  dailyRemainingLamports: string | null;
  targetLamports: string;
  thresholdLamports: string;
  claim: FaucetClaimView | null;
  message: string;
}

export function faucetClaimView(claim: FaucetClaim): FaucetClaimView {
  return { id: claim.id, amountLamports: claim.amountLamports, txHash: claim.txHash, status: claim.status, nextClaimAtMs: claim.createdAtMs + SOL_FAUCET_POLICY.cooldownMs };
}

export function faucetTopUpLamports(balanceLamports: bigint): bigint {
  return balanceLamports < SOL_FAUCET_POLICY.thresholdLamports ? SOL_FAUCET_POLICY.targetLamports - balanceLamports : 0n;
}

export function faucetChallengeMessage(input: { origin: string; wallet: string; id: string; expiresAtMs: number }): string {
  return [
    `${SIGNED_MESSAGE_BRAND} devnet SOL request`,
    `Site: ${input.origin}`,
    `Wallet: ${input.wallet}`,
    networkLine(SOL_FAUCET_POLICY.cluster),
    "Request: top up SOL to 0.02 only if my balance is below 0.005; subject to availability and limits.",
    `Nonce: ${input.id}`,
    `Expires: ${new Date(input.expiresAtMs).toISOString()}`,
    "This message is not a transaction: it costs nothing and gives no permission to spend my funds.",
  ].join("\n");
}

export class FaucetError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
