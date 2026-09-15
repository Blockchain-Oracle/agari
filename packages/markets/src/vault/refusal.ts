/**
 * The grant pre-check a delegated buy runs before any signature or co-sign request (tap-trading.md §1.3 step 5,
 * Masayume `vault/order.ts:24-86`): the actor must be the grant's, then core `simulateCaps` in the program's order.
 * Pure, so the caps vectors and the client mirror are checked without a chain.
 */
import type { Quote, Side } from "@agari/core/types";
import { diagnosis, type Address, type Diagnosis } from "@agari/core/types";
import { formatBaseUnits, oneUnit, ownTermsPriceRaw } from "@agari/core/units";
import { simulateCaps, type CapRefusal, type VaultGrant } from "@agari/core/vault";

const ERROR_NAMES: Record<CapRefusal["kind"], string> = {
  revoked: "GrantIsRevoked",
  expired: "GrantExpired",
  price: "OverPriceCap",
  escrow: "Insufficient",
  stake: "OverStakeCap",
  daily: "OverDailyCap",
  positions: "OverPositionCap",
};

export function capRefusalText(refusal: CapRefusal, decimals: number): string {
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  switch (refusal.kind) {
    case "revoked":
      return "the grant has been revoked";
    case "expired":
      return `the grant expired at ${new Date(refusal.expiresAtSec * 1000).toISOString()}`;
    case "price":
      return `the side is priced ${refusal.sidePriceRaw} against a cap of ${refusal.capRaw}`;
    case "escrow":
      return `the order escrows ${money(refusal.worstBase)} but the grant's budget is ${money(refusal.budgetBase)}`;
    case "stake":
      return `the order would spend ${money(refusal.spendBase)} against a per-trade cap of ${money(refusal.capBase)}`;
    case "daily":
      return `today's spend would reach ${money(refusal.wouldBeBase)} against a daily cap of ${money(refusal.capBase)} (resets 00:00 UTC)`;
    case "positions":
      return `this would be open position ${refusal.wouldBe} of ${refusal.cap}`;
    default: {
      const exhaustive: never = refusal;
      return String(exhaustive);
    }
  }
}

export interface GrantBuyCheck {
  grant: VaultGrant;
  actor: Address;
  side: Side;
  quote: Pick<Quote, "limitPriceRaw" | "contractsRaw" | "expectedCostBase">;
  decimals: number;
  nowSec: number;
  /** The owner's vault slot on this side: lots held and the grant that opened it (0 = attended or none). */
  held: { lots: bigint; grantId: bigint };
}

/**
 * Null when the program would admit the buy; else the refusal, with Masayume's `errorName`. A position counts as new
 * exactly when the program books it so: nothing held on that side and no grant attributed to it (vault.md §3.4).
 */
export function grantBuyRefusal(input: GrantBuyCheck): Diagnosis | null {
  const { grant, quote, decimals } = input;
  if (grant.actor !== input.actor) return diagnosis("grant-refused", `${input.actor} is not grant #${grant.grantId}'s actor`, { errorName: "NotGrantActor" });
  const verdict = simulateCaps({
    grant,
    nowSec: input.nowSec,
    sidePriceRaw: ownTermsPriceRaw(quote.limitPriceRaw, input.side, decimals),
    quantityRaw: quote.contractsRaw,
    spendBase: quote.expectedCostBase,
    one: oneUnit(decimals),
    opensNewPosition: input.held.lots === 0n && input.held.grantId === 0n,
  });
  if (verdict.ok) return null;
  return diagnosis("grant-refused", capRefusalText(verdict.refusal, decimals), { errorName: ERROR_NAMES[verdict.refusal.kind] });
}
