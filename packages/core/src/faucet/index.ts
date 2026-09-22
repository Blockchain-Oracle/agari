import { SIGNED_MESSAGE_BRAND, networkLine } from "../auth/signed-message";
import { FAUCET_UNITS } from "../constants/faucet";
import { LAMPORTS_PER_SIGNATURE } from "../constants/fees";

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

/**
 * Test tUSDC, minted by the server (D-034): the `sol-faucet` key pays the fee and the ATA rent, `faucet-mint-authority`
 * signs `mintToChecked`. Amounts are whole tUSDC; the mint's own decimals turn them into base units.
 */
export const TUSDC_FAUCET_POLICY = {
  amountUnits: FAUCET_UNITS,
  dailyUnits: 20_000_000n,
  cooldownMs: 86_400_000,
  maxPerIpPerDay: 10,
  /** Rent-exempt minimum of a 165-byte SPL token account, paid when the wallet has no tUSDC account yet. */
  ataRentLamports: 2_039_280n,
  /** Two signatures: the fee payer and the mint authority. */
  maxMintFeeLamports: 2n * LAMPORTS_PER_SIGNATURE,
} as const;

export type FaucetAsset = "sol" | "tusdc";
export const FAUCET_ASSETS = ["sol", "tusdc"] as const satisfies readonly FaucetAsset[];
export type FaucetClaimStatus = "prepared" | "confirmed" | "reverted" | "conflict";

/** One server-signed faucet transaction, committed before it is broadcast and reconciled by signature. */
interface JournaledClaim {
  id: string;
  wallet: string;
  funder: string;
  ipHash: string;
  feeLamports: string;
  /** The signed transaction stays valid until this block height; a `prepared` claim is reconciled against it, never re-signed. */
  lastValidBlockHeight: number;
  txHash: string;
  rawTransaction: string;
  status: FaucetClaimStatus;
  createdAtMs: number;
}
export interface FaucetClaim extends JournaledClaim { asset: "sol"; amountLamports: string }
export interface TusdcFaucetClaim extends JournaledClaim { asset: "tusdc"; amountBase: string }
export type AnyFaucetClaim = FaucetClaim | TusdcFaucetClaim;

export interface FaucetChallenge {
  id: string;
  wallet: string;
  ipHash: string;
  message: string;
  createdAtMs: number;
  expiresAtMs: number;
}
export interface FaucetClaimView {
  asset: "sol";
  id: string;
  amountLamports: string;
  txHash: string;
  status: FaucetClaimStatus;
  nextClaimAtMs: number;
}
export interface TusdcFaucetClaimView {
  asset: "tusdc";
  id: string;
  amountBase: string;
  txHash: string;
  status: FaucetClaimStatus;
  nextClaimAtMs: number;
}
export type AnyFaucetClaimView = FaucetClaimView | TusdcFaucetClaimView;

/** The tUSDC half of `GET /api/faucet`. `configured` is false when the server has no mint authority key. */
export interface TusdcFaucetStatus {
  configured: boolean;
  ready: boolean;
  mint: string | null;
  decimals: number | null;
  amountBase: string | null;
  walletBalanceBase: string | null;
  dailyRemainingBase: string | null;
  claim: TusdcFaucetClaimView | null;
  message: string;
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
  tusdc: TusdcFaucetStatus;
  message: string;
}

export function faucetClaimView(claim: FaucetClaim): FaucetClaimView {
  return { asset: "sol", id: claim.id, amountLamports: claim.amountLamports, txHash: claim.txHash, status: claim.status, nextClaimAtMs: claim.createdAtMs + SOL_FAUCET_POLICY.cooldownMs };
}
export function tusdcClaimView(claim: TusdcFaucetClaim): TusdcFaucetClaimView {
  return { asset: "tusdc", id: claim.id, amountBase: claim.amountBase, txHash: claim.txHash, status: claim.status, nextClaimAtMs: claim.createdAtMs + TUSDC_FAUCET_POLICY.cooldownMs };
}
export function anyClaimView(claim: AnyFaucetClaim): AnyFaucetClaimView {
  return claim.asset === "sol" ? faucetClaimView(claim) : tusdcClaimView(claim);
}

/** The tUSDC half of a status when this server cannot mint (no mint authority key, or a key that is not the mint's). */
export function unavailableTusdcStatus(message = "In-app test tUSDC is unavailable on this deployment."): TusdcFaucetStatus {
  return { configured: false, ready: false, mint: null, decimals: null, amountBase: null, walletBalanceBase: null, dailyRemainingBase: null, claim: null, message };
}

export function faucetTopUpLamports(balanceLamports: bigint): bigint {
  return balanceLamports < SOL_FAUCET_POLICY.thresholdLamports ? SOL_FAUCET_POLICY.targetLamports - balanceLamports : 0n;
}

/** Whole tUSDC → base units at the mint's decimals. */
export function tusdcBaseUnits(units: bigint, decimals: number): bigint {
  return units * 10n ** BigInt(decimals);
}

/** One free signature covers both claims (D-034): it names the SOL top-up rule and the tUSDC amount. */
export function faucetChallengeMessage(input: { origin: string; wallet: string; id: string; expiresAtMs: number }): string {
  return [
    `${SIGNED_MESSAGE_BRAND} devnet test funds request`,
    `Site: ${input.origin}`,
    `Wallet: ${input.wallet}`,
    networkLine(SOL_FAUCET_POLICY.cluster),
    `Request: top up SOL to 0.02 only if my balance is below 0.005, and add ${TUSDC_FAUCET_POLICY.amountUnits.toLocaleString("en-US")} test tUSDC; subject to availability and limits.`,
    `Nonce: ${input.id}`,
    `Expires: ${new Date(input.expiresAtMs).toISOString()}`,
    "This message is not a transaction: it costs nothing and gives no permission to spend my funds.",
  ].join("\n");
}

export class FaucetError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
