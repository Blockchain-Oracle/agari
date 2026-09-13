/** Native-token onboarding policy. All amounts are Shannon STT base units. */
export const STT_FAUCET_POLICY = {
  chainId: 50312,
  thresholdWei: 1_000_000_000_000_000_000n,
  targetWei: 2_000_000_000_000_000_000n,
  dailyWei: 40_000_000_000_000_000_000n,
  reserveWei: 10_000_000_000_000_000_000n,
  maxTransferFeeWei: 10_000_000_000_000_000n,
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
  amountWei: string;
  feeWei: string;
  nonce: number;
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
  amountWei: string;
  txHash: string;
  status: FaucetClaimStatus;
  nextClaimAtMs: number;
}
export interface FaucetStatus {
  configured: boolean;
  ready: boolean;
  address: string | null;
  fundingBalanceWei: string | null;
  walletBalanceWei: string | null;
  dailyRemainingWei: string | null;
  targetWei: string;
  thresholdWei: string;
  claim: FaucetClaimView | null;
  message: string;
}

export function faucetClaimView(claim: FaucetClaim): FaucetClaimView {
  return { id: claim.id, amountWei: claim.amountWei, txHash: claim.txHash, status: claim.status, nextClaimAtMs: claim.createdAtMs + STT_FAUCET_POLICY.cooldownMs };
}

export function faucetTopUpWei(balanceWei: bigint): bigint {
  return balanceWei < STT_FAUCET_POLICY.thresholdWei ? STT_FAUCET_POLICY.targetWei - balanceWei : 0n;
}

export function faucetChallengeMessage(input: { origin: string; wallet: string; id: string; expiresAtMs: number }): string {
  return ["Masayume testnet gas request", `Site: ${input.origin}`, `Wallet: ${input.wallet.toLowerCase()}`, "Network: Somnia Shannon (50312)", "Request: top up STT to 2 only if my balance is below 1; subject to availability and limits.", `Nonce: ${input.id}`, `Expires: ${new Date(input.expiresAtMs).toISOString()}`, "This message costs no gas and gives no permission to spend my funds."].join("\n");
}

export class FaucetError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
