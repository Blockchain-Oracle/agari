import type { VaultCaps, VaultGrant } from "../vault/types";

// The deployed vault requires monetary cap fields. Their ceiling leaves the separately allocated
// budget as X's spending boundary, including after later top-ups.
//
// It is a u64 ceiling because that is the width the program actually stores: `CapsArgs`
// (`instructions/grants.rs:20`, IDL `max_stake_per_trade`) is `u64`, and the state layout test
// pins the field at 8 bytes. Until 2026-09-22 this read `(1n << 128n) - 1n`, which no u64 codec
// can encode — so *every* X grant was refused before it left the browser ("Codec [u64] expected
// number to be in the range [0, 18446744073709551615]"), and `isBalanceOnlyXGrant` compared live
// grants against a value none of them could hold. Nothing could authorize, so nothing could trade.
export const X_MONETARY_CEILING = (1n << 64n) - 1n;
export const X_GRANT = { openWindows: 8, days: 30 } as const;

export function xGrantCaps(): VaultCaps {
  return { maxStakePerTradeBase: X_MONETARY_CEILING, maxDailySpendBase: X_MONETARY_CEILING, maxOpenPositions: X_GRANT.openWindows, maxPriceRaw: 0n };
}

export function isBalanceOnlyXGrant(grant: VaultGrant): boolean {
  return grant.kind === "executor" && grant.caps.maxStakePerTradeBase === X_MONETARY_CEILING
    && grant.caps.maxDailySpendBase === X_MONETARY_CEILING && grant.caps.maxPriceRaw === 0n;
}

export type XPermissionState = "checking" | "unavailable" | "unfunded" | "update" | "expired" | "mismatch" | "ready";

export function xPermissionState(grant: VaultGrant | null, executor: string | null, nowSec: number): XPermissionState {
  if (!executor) return "unavailable";
  if (!grant || grant.revoked) return "unfunded";
  if (grant.actor !== executor) return "mismatch";
  if (grant.expiresAtSec <= nowSec) return "expired";
  if (!isBalanceOnlyXGrant(grant)) return "update";
  return grant.budgetBase > 0n ? "ready" : "unfunded";
}
