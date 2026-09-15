import type { Address } from "@agari/core/types";

/**
 * The fee-payer co-signer's status for `GET /api/sponsor` (tap-trading.md §3). On Solana the sponsor signs only as fee
 * payer, for an exact agari-vault instruction allowlist, after simulating. Browser-safe: only the type is re-exported
 * from the package root.
 */
export interface SponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: bigint | null;
  /** Allowlisted instructions as `program:instruction` names. */
  allowlist: readonly string[];
  /** Why the sponsor is off or degraded (no key, no vault, breaker open, "local counters"). */
  reason?: string;
}

/** Masayume's `SPONSORABLE_FUNCTIONS` (`M:packages/markets/src/vault/sponsor.ts:25-27`) on agari-vault, minus `sweep`. */
export const SPONSORABLE_INSTRUCTIONS = ["actor_place_for", "public_crank_settle", "owner_withdraw", "owner_withdraw_private", "owner_revoke"] as const;
export type SponsorableInstruction = (typeof SPONSORABLE_INSTRUCTIONS)[number];
export const SPONSOR_ALLOWLIST: readonly string[] = SPONSORABLE_INSTRUCTIONS.map((name) => `agari_vault:${name}`);
