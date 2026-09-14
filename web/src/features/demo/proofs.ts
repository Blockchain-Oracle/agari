import type { Address, Signature } from "@agari/core/types";
import { addressUrl, txUrl } from "@agari/core/urls";
import { webEnv } from "@/lib/env";

/**
 * The proofs on `/demo` — real transactions and real programs, nothing else.
 *
 * Masayume's list was its own Shannon receipts; none of them is an Agari action, so none is shown. The list refills
 * from the devnet signatures recorded in `docs/plan/acceptance.md` once agari-events runs (S4), each one checked on
 * Solana Explorer before it is added. Until then the section renders its honest pending state.
 */
export const PROOF_WALLET: Address | null = null;
export const PROOFS_READ_ON: string | null = null;

type ProofOperation = "publication" | "permission" | "subscription" | "purchase" | "settlement" | "payout" | "x-trade";

export interface TxProof {
  hash: Signature;
  operation: ProofOperation;
  status: "confirmed";
  detail: string;
}

export const TX_PROOFS: readonly TxProof[] = [];

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
  return txUrl(proof.hash, webEnv.markets.cluster);
}

export type ContractKey = "marketsCore" | "binaryModule" | "binarySettlement" | "oracleHub";

export interface ContractProof {
  key: ContractKey;
  label: string;
  /** Null until the program is deployed and its id configured. */
  address: Address | null;
}

/** One Anchor program, agari-events, is the book, the Windows, the settlement and the print verifier (plan §3.1). */
const CONTRACT_LABELS: Record<ContractKey, string> = {
  marketsCore: "agari-events (the CLOB)",
  binaryModule: "agari-events (the Windows)",
  binarySettlement: "agari-events (payouts)",
  oracleHub: "agari-events (the signed prints)",
};

export const CONTRACT_PROOFS: readonly ContractProof[] = (Object.keys(CONTRACT_LABELS) as ContractKey[]).map((key) => ({
  key,
  label: CONTRACT_LABELS[key],
  address: webEnv.markets.eventsProgramId ?? null,
}));

export function contractProofHref(proof: ContractProof): string | null {
  return proof.address === null ? null : addressUrl(proof.address, webEnv.markets.cluster);
}

export function contractProof(key: ContractKey): ContractProof {
  return CONTRACT_PROOFS.find((proof) => proof.key === key)!;
}
