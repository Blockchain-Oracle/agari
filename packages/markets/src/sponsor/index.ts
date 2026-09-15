/**
 * `@agari/markets/sponsor`: the fee-payer co-sign (tap-trading.md §3, D-065). Server-only: the co-signer reads the
 * `sponsor` role key. Not re-exported from the package root, so no web bundle pulls it; the root carries only
 * `SponsorStatus`. Lane 7b adds the pure policy (`policy.ts`) and the co-signer (`cosign.ts`) here.
 */
export type { SponsorStatus } from "./status";
