import type { Address, Signature } from "@agari/core/types";
import { addressUrl, txUrl } from "@agari/core/urls";
import { webEnv } from "@/lib/env";

/**
 * The proofs on `/demo` — real transactions and real programs, nothing else.
 *
 * Every signature below is a ✅ row of `docs/plan/acceptance.md`, confirmed on Solana devnet: the S2 events drive
 * (2026-09-14 14:40–15:00Z, one Window walked from print to redeem, plus both void paths) and the S4 faucet run
 * through the app (2026-09-15 05:15Z). They were sent by the drive wallet `PROOF_WALLET` and by the venue's own
 * deployer, roller and faucet keys, so each records that the named action happened, not anyone's current balance.
 * A failed attempt never appears here; the ledger keeps those beside the successes.
 *
 * The program and venue addresses come from the env the whole app runs against (`NEXT_PUBLIC_AGARI_*`, checked
 * equal to `scripts/deploy/addresses.devnet.json`), never retyped, so a drift shows up here too.
 */
export const PROOF_WALLET: Address | null = "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP" as Address;
export const PROOFS_READ_ON: string | null = "2026-09-15";

export type ProofOperation = "deploy" | "listing" | "faucet" | "order" | "fill" | "print" | "settlement" | "payout" | "void";

export interface TxProof {
  hash: Signature;
  operation: ProofOperation;
  status: "confirmed";
  detail: string;
}

const sig = (value: string) => value as Signature;

export const TX_PROOFS: readonly TxProof[] = [
  { hash: sig("535nHdsRyvVbmuKVHPsuaBV9HCVEcfkTRbZnk2Gpr35DSnC8SAsFzkDJnm4qW6L6EKptVSrNzuhHkwzQ56hKRpQS"), operation: "deploy", status: "confirmed", detail: "agari-events deployed to devnet: one Anchor program for the book, the Windows, the prints and settlement." },
  { hash: sig("3gqWrR3Pn5e9kbNCuURUL3J6hAUZcEEdsRnr6fpa1yzh7HDYn6svRju2Jka8o27FYPyA2qzcnhCdatjGhewWyzLm"), operation: "listing", status: "confirmed", detail: "TSLA Regular 5m Series registered: the lane every TSLA five-minute Window is listed on." },
  { hash: sig("23Ge127UJi8JJeGx7BV5XBB2qEw94TrEygbEW7dosHwdAjN4MGNTaZ322TTWfXjj9WvkTf1AqJGFN3fFxmG5Qu5R"), operation: "faucet", status: "confirmed", detail: "Get test funds through the running app: 10,000 tUSDC to a fresh wallet on one challenge signature." },
  { hash: sig("3zPCG7CRTBzN4zy86KG8HX9xBMZiWAawPM68i3FRedczSEhWTMT28fHV33YzydC3ZcaMJJk2ax9SPEajLxtbGEH2"), operation: "order", status: "confirmed", detail: "TSLA 5m · a resting UP bid, 10,000 lots at 62¢, claims its seat on the Window's ledger." },
  { hash: sig("5n12bZvvyxk8DA8ja4Sh5DzDGziGALoDPdK2CHRK9jPHCTJPfzwg7gZPfoRz9bNcur3ySxpfgxKCYTcYkfmnGMaN"), operation: "fill", status: "confirmed", detail: "TSLA 5m · a DOWN buy at 38¢ or better meets the resting UP bid and mints a fresh pair: no house on the other side." },
  { hash: sig("591KLUFX9c17jbVogDPywoxpp7nHqmwdpDyJbYHhZPXzYfaFFH93AQb85w4xVhBnUgKYB2cd1MxKEvnVBfJUT1vd"), operation: "print", status: "confirmed", detail: "TSLA opening check print from RedStone, five signers verified on-chain at 14:40:00Z." },
  { hash: sig("xjKyBjRk51GitA35CZoP6fKd9huZ15EMH5RPmv8Lkj6XCKYn71zUDFfJaQPHyyresAX4Es13UCFGs4GSogvmzwt"), operation: "settlement", status: "confirmed", detail: "TSLA 5m settled UP: Pyth 358.20432 → 358.75, cross-checked against RedStone within 25 bps at both boundaries." },
  { hash: sig("3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg"), operation: "payout", status: "confirmed", detail: "TSLA 5m · the winning seat redeemed 7.37 tUSDC, exactly the amount the settlement rule predicts." },
  { hash: sig("3p3AwjvW66Y24cV97pPYH4CR7ftXeuFH7GYBeWXhsVCmf1htuSpoYXTNz1nSL7kZhPdmBw1wGB1sFmPQpMM2G1WH"), operation: "void", status: "confirmed", detail: "NVDA 5m voided for a missing print: no opening print by its deadline, so anyone could void it, and both sides were paid 0.5." },
];

const OPERATION_LABEL: Record<ProofOperation, string> = {
  deploy: "Program deployed",
  listing: "Series listed",
  faucet: "Test funds minted",
  order: "Order resting",
  fill: "Pair minted on a fill",
  print: "Signed print recorded",
  settlement: "Window settled",
  payout: "Winnings redeemed",
  void: "Window voided",
};

export function txProofLabel(proof: TxProof): string {
  return OPERATION_LABEL[proof.operation];
}

export function txProofHref(proof: TxProof): string {
  return txUrl(proof.hash, webEnv.markets.cluster);
}

/** The first confirmed proof of an operation; the depth cards cite one each. */
export function txProof(operation: ProofOperation): TxProof {
  const proof = TX_PROOFS.find((candidate) => candidate.operation === operation);
  if (!proof) throw new Error(`no confirmed proof for ${operation}`);
  return proof;
}

export type ContractKey = "events" | "vault" | "venue";

export interface ContractProof {
  key: ContractKey;
  label: string;
  /** Null when this build has no address configured for it; the row is then left out rather than invented. */
  address: Address | null;
}

const CONTRACTS: Record<ContractKey, { label: string; address: Address | undefined }> = {
  events: { label: "agari-events (the book, the Windows, the prints, settlement)", address: webEnv.markets.eventsProgramId },
  vault: { label: "agari-vault (the Trading Balance and its grants)", address: webEnv.markets.vaultProgramId },
  venue: { label: "Venue config (signers, thresholds and roles every Window reads)", address: webEnv.markets.venueId },
};

export const CONTRACT_PROOFS: readonly ContractProof[] = (Object.keys(CONTRACTS) as ContractKey[]).map((key) => ({
  key,
  label: CONTRACTS[key].label,
  address: CONTRACTS[key].address ?? null,
}));

export function contractProofHref(proof: ContractProof): string | null {
  return proof.address === null ? null : addressUrl(proof.address, webEnv.markets.cluster);
}
