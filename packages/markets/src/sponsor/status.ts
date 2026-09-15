import type { Address } from "@agari/core/types";

/**
 * The fee-payer co-signer's status for `GET /api/sponsor` (tap-trading.md §3). On Solana the sponsor signs only as fee
 * payer, for an exact agari-vault instruction allowlist, after simulating; the allowlist is empty until the vault
 * deploys (S7). Browser-safe: only this type is re-exported from the package root.
 */
export interface SponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: bigint | null;
  /** Allowlisted instructions as `program:instruction` names. */
  allowlist: readonly string[];
  /** Why the sponsor is off or degraded (no vault, breaker open, "local counters"). */
  reason?: string;
}
