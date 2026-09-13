import type { Address, Hex } from "@masayume/core/types";
import { addressUrl, txUrl } from "@masayume/core/urls";
import { PINNED_TESTNET } from "@masayume/markets";

/**
 * The proofs on `/demo` — real transactions and real contracts, nothing else.
 *
 * These are this project's own demo-wallet receipts, verified through Shannon RPC
 * on `PROOFS_READ_ON`: each succeeded and its emitted event establishes the
 * named operation for `PROOF_WALLET`. The X fill was sent by its delegated
 * executor; the other listed operations were sent by the wallet. See the dated acceptance
 * ledger for the browser evidence. A confirmed setup or purchase is historical
 * evidence of that action; it does not establish current permission or a payout.
 * The Momentum fill affected by the opening/EMA price-basis bug is excluded.
 *
 * The contract addresses come from the pinned file the whole app is verified
 * against — never retyped here, so a drift check catches a stale demo too.
 */
export const PROOF_WALLET = "0xd357019E2c55375477802A047dB7bC1A77819358" as Address;
export const PROOFS_READ_ON = "2026-09-06";

type ProofOperation = "publication" | "permission" | "subscription" | "purchase" | "settlement" | "payout" | "x-trade";

export interface TxProof {
  hash: Hex;
  operation: ProofOperation;
  status: "confirmed";
  detail: string;
}

export const TX_PROOFS: readonly TxProof[] = [
  { hash: "0x11c193f9547e1a52e370cebe0edb6396104636af26197c5ba9727215005a2d9f", operation: "publication", status: "confirmed", detail: "Shannon Momentum #1 registered with its public strategy and trading limits." },
  { hash: "0x96250651c1706a9de51d4aa5ec29b34e6e6414be4069ef6ae243bbbc84f1f9a0", operation: "permission", status: "confirmed", detail: "2 tUSDC budget · 1 tUSDC per trade · 1 open position allowed." },
  { hash: "0xa2f6547b0e6631aee769650dc5920a694105b777d562a90cd0bd11b06aa6f202", operation: "subscription", status: "confirmed", detail: "Strategy #1 subscription · 0 tUSDC fee. Future copies were later paused." },
  { hash: "0xefc7fe4c652ea288230f01485706cbc72e725bf2520e25d87e96c58a0fa1c8ef", operation: "purchase", status: "confirmed", detail: "Moonshot round #3 · BTC 1h · long 2×. Actual stake: 1.000354 tUSDC." },
  { hash: "0x2411021930e8d592baff1192273cc4d9c9a18522ba1aea9bc4cf292a007e5320", operation: "settlement", status: "confirmed", detail: "Moonshot round #3 settled as a win, with a closing print of $79,922.31." },
  { hash: "0x5e99e6496c2a4ece6ba33226c8e5dacd5ddef0f8b3247b462d5f3484ace9ee7f", operation: "payout", status: "confirmed", detail: "Moonshot round #3 paid 2.000132 tUSDC to the demo wallet." },
  { hash: "0x072a0259bd75c22697d960da29c513ff9a0d3b0f24ba5eefbe626810093fa26b", operation: "x-trade", status: "confirmed", detail: "X command · BTC 4h UP. Grant #4 spent 0.90852 tUSDC for 1.34 contracts in one confirmed execution." },
];

const OPERATION_LABEL: Record<ProofOperation, string> = {
  publication: "Strategy published",
  permission: "Bounded Vault permission",
  subscription: "Copy subscription consent",
  purchase: "Moonshot purchase",
  settlement: "Moonshot settled",
  payout: "Moonshot payout claimed",
  "x-trade": "X trade filled",
};

/** Operation success is distinct from a market outcome or a permission's current state. */
export function txProofLabel(proof: TxProof): string {
  return `${OPERATION_LABEL[proof.operation]} · ${proof.status}`;
}

export function txProofHref(proof: TxProof): string {
  return txUrl(proof.hash);
}

export type ContractKey = "marketsCore" | "binaryModule" | "binarySettlement" | "oracleHub";

export interface ContractProof {
  key: ContractKey;
  label: string;
  address: Address;
}

const CONTRACT_LABELS: Record<ContractKey, string> = {
  marketsCore: "Markets core (the CLOB)",
  binaryModule: "Binary module (the Windows)",
  binarySettlement: "Binary settlement (payouts)",
  oracleHub: "Oracle hub (the prints)",
};

export const CONTRACT_PROOFS: readonly ContractProof[] = (Object.keys(CONTRACT_LABELS) as ContractKey[]).map((key) => ({
  key,
  label: CONTRACT_LABELS[key],
  address: PINNED_TESTNET.addresses[key] as Address,
}));

export function contractProofHref(proof: ContractProof): string {
  return addressUrl(proof.address);
}

export function contractProof(key: ContractKey): ContractProof {
  return CONTRACT_PROOFS.find((proof) => proof.key === key)!;
}
