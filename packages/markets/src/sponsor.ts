import type { Address } from "@agari/core/types";

/**
 * The fee-payer co-signer's status for `GET /api/sponsor` (plan §3.2). On Solana the sponsor signs only as fee payer,
 * for an allowlist of exact instruction discriminators per Agari program; the allowlist is empty until the vault
 * and product programs exist (S7).
 */
export interface SponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: bigint | null;
  /** Allowlisted instructions as `program:instruction` names. */
  allowlist: readonly string[];
}
