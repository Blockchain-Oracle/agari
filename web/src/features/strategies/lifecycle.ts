import type { StrategySubscription } from "@masayume/core/strategies";
import type { VaultGrant } from "@masayume/core/vault";

export type CopyState = "checking" | "not-copying" | "inactive" | "paused" | "expired" | "replaced" | "runner-changed" | "unfunded" | "copying";

/** Registry consent alone is not permission to spend: the current grant must agree. */
export function copyStateOf(card: { active: boolean; runner: string }, sub: StrategySubscription | null, grant: VaultGrant | null, nowSec: number, readable = true): CopyState {
  if (!readable) return "checking";
  if (!card.active) return "inactive";
  if (!sub) return "not-copying";
  if (!sub.active || grant?.revoked) return "paused";
  if (!grant || grant.grantId !== sub.grantId) return "replaced";
  if (grant.expiresAtSec <= nowSec) return "expired";
  if (grant.actor.toLowerCase() !== card.runner.toLowerCase()) return "runner-changed";
  if (grant.budgetBase <= 0n) return "unfunded";
  return sub.live ? "copying" : "paused";
}

export const COPY_STATE_LABEL: Record<CopyState, string> = {
  checking: "Checking permission", "not-copying": "Not copying", inactive: "Strategy inactive", paused: "Copying paused", expired: "Permission expired", replaced: "Permission replaced or revoked", "runner-changed": "Runner changed", unfunded: "Budget used up", copying: "Copying enabled",
};
