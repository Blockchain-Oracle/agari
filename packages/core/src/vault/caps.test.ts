import { describe, expect, it } from "vitest";
import { capQuoteToGrant, simulateCaps, utcDayOf } from "./caps";
import type { VaultGrant } from "./types";
import { testAddress } from "../testing/ids";

const ONE = 1_000_000n;
const FILL_YES = 600_000n;
const NOW_SEC = 1_788_400_000;

interface Vector {
  name: string;
  caps: { maxStakePerTrade: string; maxDailySpend: string; maxOpenPositions: number; maxPriceRaw: string };
  budget: string;
  expired: boolean;
  prior: { outcomeIdx: 0 | 1; priceRaw: string; quantityRaw: string } | null;
  order: { outcomeIdx: 0 | 1; priceRaw: string; quantityRaw: string };
  expect: { ok: true; spendBase: string } | { ok: false; refusal: string; error: string };
}

import golden from "./caps.vectors.json";

const { vectors } = golden as unknown as { vectors: Vector[] };

const sidePrice = (outcomeIdx: 0 | 1, yesPriceRaw: bigint) => (outcomeIdx === 0 ? yesPriceRaw : ONE - yesPriceRaw);
/** The mock book: a buy fills in full when the limit reaches the fill price, at the fill price. */
const charge = (outcomeIdx: 0 | 1, limitYes: bigint, quantityRaw: bigint) =>
  sidePrice(outcomeIdx, limitYes) >= sidePrice(outcomeIdx, FILL_YES) ? (quantityRaw * sidePrice(outcomeIdx, FILL_YES)) / ONE : 0n;

function grantFor(v: Vector): VaultGrant {
  const priorSpend = v.prior ? charge(v.prior.outcomeIdx, BigInt(v.prior.priceRaw), BigInt(v.prior.quantityRaw)) : 0n;
  return {
    grantId: 1n,
    owner: testAddress(1),
    actor: testAddress(2),
    kind: "strategy",
    revoked: false,
    expiresAtSec: v.expired ? NOW_SEC - 1 : NOW_SEC + 86_400,
    spentDay: utcDayOf(NOW_SEC),
    spentTodayBase: priorSpend,
    openPositions: v.prior ? 1 : 0,
    caps: {
      maxStakePerTradeBase: BigInt(v.caps.maxStakePerTrade),
      maxDailySpendBase: BigInt(v.caps.maxDailySpend),
      maxOpenPositions: v.caps.maxOpenPositions,
      maxPriceRaw: BigInt(v.caps.maxPriceRaw),
    },
    budgetBase: BigInt(v.budget) - priorSpend,
  };
}

describe("simulateCaps mirrors EventVault.placeFor on the shared vectors", () => {
  for (const v of vectors) {
    it(v.name, () => {
      const limit = BigInt(v.order.priceRaw);
      const quantityRaw = BigInt(v.order.quantityRaw);
      const spendBase = charge(v.order.outcomeIdx, limit, quantityRaw);
      const opensNewPosition = !(v.prior && v.prior.outcomeIdx === v.order.outcomeIdx);
      const verdict = simulateCaps({ grant: grantFor(v), nowSec: NOW_SEC, sidePriceRaw: sidePrice(v.order.outcomeIdx, limit), quantityRaw, spendBase, one: ONE, opensNewPosition });
      if (v.expect.ok) {
        expect(verdict.ok, `expected ok, got ${JSON.stringify(verdict, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`).toBe(true);
        expect(spendBase).toBe(BigInt(v.expect.spendBase));
      } else if (v.expect.refusal === "venue") {
        // Every cap passes; it is the venue that refuses an IOC with nothing to cross, and the charge would be 0.
        expect(verdict.ok).toBe(true);
        expect(spendBase).toBe(0n);
      } else {
        expect(verdict.ok).toBe(false);
        if (!verdict.ok) expect(verdict.refusal.kind).toBe(v.expect.refusal);
      }
    });
  }
});

describe("capQuoteToGrant", () => {
  const one = 1_000_000n;
  const tick = 1_000n;
  const cap = 950_000n;
  // A 5m tap walked at 82.7¢ a contract, padded by the ~56 % cushion to a 99.9¢ limit.
  const walked = { limitPriceRaw: 999_000n, contractsRaw: 1_001_000n, expectedCostBase: 827_827n, maxCostBase: 999_999n };

  it("holds an UP tap's limit and escrow to the price cap when the walk fits under it", () => {
    const capped = capQuoteToGrant(walked, "up", cap, one, tick);
    expect(capped.limitPriceRaw).toBe(cap);
    expect(capped.maxCostBase).toBe((walked.contractsRaw * cap) / one);
    expect(capped.expectedCostBase).toBe(walked.expectedCostBase);
  });

  it("reads a DOWN tap's cap in its own terms (YES limit = 1 − cap)", () => {
    const down = { ...walked, limitPriceRaw: 1_000n };
    expect(capQuoteToGrant(down, "down", cap, one, tick).limitPriceRaw).toBe(one - cap);
  });

  it("leaves a quote already under the cap, a grant with no cap, and a walk priced over the cap unchanged", () => {
    const under = { ...walked, limitPriceRaw: 900_000n };
    expect(capQuoteToGrant(under, "up", cap, one, tick)).toBe(under);
    expect(capQuoteToGrant(walked, "up", 0n, one, tick)).toBe(walked);
    const dear = { ...walked, expectedCostBase: 980_000n };
    expect(capQuoteToGrant(dear, "up", cap, one, tick)).toBe(dear);
  });

  it("aligns the cap down to a whole tick", () => {
    expect(capQuoteToGrant(walked, "up", 950_500n, one, tick).limitPriceRaw).toBe(950_000n);
  });

  it("turns the 5m price refusal into an admitted tap", () => {
    // The practice wallet's live devnet grant (#16): 5 a tap, 25 a day, four Windows, 95¢, a 25 budget.
    const grant: VaultGrant = {
      grantId: 16n, owner: testAddress(1), actor: testAddress(2), kind: "session", revoked: false, expiresAtSec: NOW_SEC + 86_400,
      spentDay: 0, spentTodayBase: 0n, openPositions: 0, budgetBase: 25_000_000n,
      caps: { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 25_000_000n, maxOpenPositions: 4, maxPriceRaw: cap },
    };
    const verdict = (q: typeof walked) => simulateCaps({ grant, nowSec: NOW_SEC, sidePriceRaw: q.limitPriceRaw, quantityRaw: q.contractsRaw, spendBase: q.expectedCostBase, one, opensNewPosition: true });
    expect(verdict(walked).ok).toBe(false);
    expect(verdict(capQuoteToGrant(walked, "up", cap, one, tick)).ok).toBe(true);
  });
});
