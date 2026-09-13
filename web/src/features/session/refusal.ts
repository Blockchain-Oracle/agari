import { formatBaseUnits } from "@masayume/core/units";
import type { CapRefusal } from "@masayume/core/vault";

/** The pre-check's refusal in the Ticket's own words — the same facts the vault would revert with. */
export function refusalText(refusal: CapRefusal, decimals: number, symbol: string): string {
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  switch (refusal.kind) {
    case "revoked":
      return "the grant was revoked";
    case "expired":
      return "the grant has expired";
    case "price":
      return "these odds are dearer than the grant's cap";
    case "escrow":
      return `it escrows ${money(refusal.worstBase)} and the budget holds ${money(refusal.budgetBase)}`;
    case "stake":
      return `${money(refusal.spendBase)} is over the ${money(refusal.capBase)} per-tap cap`;
    case "daily":
      return `it would take today past the ${money(refusal.capBase)} daily cap (resets 00:00 UTC)`;
    case "positions":
      return `it would be open Window ${refusal.wouldBe} of ${refusal.cap}`;
    default: {
      const exhaustive: never = refusal;
      return String(exhaustive);
    }
  }
}
