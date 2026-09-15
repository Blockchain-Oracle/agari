/**
 * `@agari/markets/sponsor`: the fee-payer co-sign (tap-trading.md §3, D-065). Server-only: the co-signer reads the
 * `sponsor` role key. Not re-exported from the package root, so no web bundle pulls it; the root carries only
 * `SponsorStatus`. The route is a thin handler over `createSponsorService`; nothing here sends a transaction.
 */
export { checkChain, createSponsorRpc, MIN_BLOCKS_LEFT, SponsorRpcError, type ChainPass, type SponsorRpc, type SponsorSimulation } from "./chain";
export { cosign, type CosignAccepted, type CosignDeps, type CosignRequest, type SponsorKeyPair, type SponsorLimits } from "./cosign";
export { BREAKER_REASON, breakerOpen, createLocalLedger, gateVerdict, NO_DEVICE, type CosignRow, type GateLimits, type SponsorLedger } from "./gates";
export { checkStatic, type Refusal, type StaticLimits, type StaticPass } from "./policy";
export { createSponsorService, NO_SPONSOR_KEY, sponsorLimitsFrom, sponsorRoleSecret, type SponsorService } from "./service";
export { SPONSOR_ALLOWLIST, SPONSORABLE_INSTRUCTIONS, type SponsorableInstruction, type SponsorStatus } from "./status";
