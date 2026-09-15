import { describe, expect, it } from "vitest";
import { encodeBase58, toAddress, type Address } from "@agari/core/types";
import { utcDayOf, type VaultGrant } from "@agari/core/vault";
import golden from "../../../core/src/vault/caps.vectors.json";
import { grantBuyRefusal } from "./refusal";

const ONE = 1_000_000n;
const FILL_YES = 600_000n;
const NOW_SEC = 1_788_400_000;
const address = (n: number): Address => toAddress(encodeBase58(new Uint8Array(32).fill(n)));
const OWNER = address(1);
const ACTOR = address(2);

interface Vector {
  name: string;
  caps: { maxStakePerTrade: string; maxDailySpend: string; maxOpenPositions: number; maxPriceRaw: string };
  budget: string;
  expired: boolean;
  prior: { outcomeIdx: 0 | 1; priceRaw: string; quantityRaw: string } | null;
  order: { outcomeIdx: 0 | 1; priceRaw: string; quantityRaw: string };
  expect: { ok: true; spendBase: string } | { ok: false; refusal: string; error: string };
}
const { vectors } = golden as unknown as { vectors: Vector[] };

const sidePrice = (o: 0 | 1, yes: bigint) => (o === 0 ? yes : ONE - yes);
const charge = (o: 0 | 1, limitYes: bigint, quantityRaw: bigint) => (sidePrice(o, limitYes) >= sidePrice(o, FILL_YES) ? (quantityRaw * sidePrice(o, FILL_YES)) / ONE : 0n);

function grantFor(v: Vector): VaultGrant {
  const prior = v.prior ? charge(v.prior.outcomeIdx, BigInt(v.prior.priceRaw), BigInt(v.prior.quantityRaw)) : 0n;
  return {
    grantId: 7n, owner: OWNER, actor: ACTOR, kind: "session", revoked: v.expect.ok === false && v.expect.error === "GrantIsRevoked",
    expiresAtSec: v.expired ? NOW_SEC - 1 : NOW_SEC + 86_400, spentDay: utcDayOf(NOW_SEC), spentTodayBase: prior, openPositions: v.prior ? 1 : 0,
    caps: { maxStakePerTradeBase: BigInt(v.caps.maxStakePerTrade), maxDailySpendBase: BigInt(v.caps.maxDailySpend), maxOpenPositions: v.caps.maxOpenPositions, maxPriceRaw: BigInt(v.caps.maxPriceRaw) },
    budgetBase: BigInt(v.budget) - prior,
  };
}

describe("the tap's client-side cap check refuses exactly what agari-vault would, before any signature", () => {
  for (const v of vectors) {
    it(v.name, () => {
      const quote = { limitPriceRaw: BigInt(v.order.priceRaw), contractsRaw: BigInt(v.order.quantityRaw), expectedCostBase: charge(v.order.outcomeIdx, BigInt(v.order.priceRaw), BigInt(v.order.quantityRaw)) };
      // A prior buy on the same side left lots in the slot attributed to this grant, so this buy opens nothing new.
      const held = v.prior && v.prior.outcomeIdx === v.order.outcomeIdx ? { lots: 1n, grantId: 7n } : { lots: 0n, grantId: 0n };
      const refusal = grantBuyRefusal({ grant: grantFor(v), actor: ACTOR, side: v.order.outcomeIdx === 0 ? "up" : "down", quote, decimals: 6, nowSec: NOW_SEC, held });
      if (v.expect.ok || v.expect.refusal === "venue") expect(refusal).toBeNull();
      else {
        expect(refusal?.kind).toBe("grant-refused");
        expect(refusal?.errorName).toBe(v.expect.error);
      }
    });
  }

  it("refuses a key that is not the grant's actor, by name", () => {
    const v = vectors[0]!;
    const quote = { limitPriceRaw: 700_000n, contractsRaw: 1_000_000n, expectedCostBase: 600_000n };
    const refusal = grantBuyRefusal({ grant: grantFor(v), actor: address(9), side: "up", quote, decimals: 6, nowSec: NOW_SEC, held: { lots: 0n, grantId: 0n } });
    expect(refusal?.errorName).toBe("NotGrantActor");
  });

  it("counts a new position as the program books it: a side sold to zero but still attributed opens nothing", () => {
    const v = { ...vectors[0]!, caps: { ...vectors[0]!.caps, maxOpenPositions: 1 } };
    const grant = { ...grantFor(v), openPositions: 1 };
    const quote = { limitPriceRaw: 700_000n, contractsRaw: 1_000_000n, expectedCostBase: 600_000n };
    const input = { grant, actor: ACTOR, side: "up" as const, quote, decimals: 6, nowSec: NOW_SEC };
    expect(grantBuyRefusal({ ...input, held: { lots: 0n, grantId: 0n } })?.errorName).toBe("OverPositionCap");
    expect(grantBuyRefusal({ ...input, held: { lots: 0n, grantId: 7n } })).toBeNull();
  });
});
