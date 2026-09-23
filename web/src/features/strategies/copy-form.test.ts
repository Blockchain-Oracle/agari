import { describe, expect, it } from "vitest";
import { checkCopyForm, type CopyFormInput } from "./copy-form";

const base: CopyFormInput = {
  budgetText: "100", perTradeText: "5", decimals: 6, symbol: "tUSDC", strategyMaxBase: 5_000_000n, walletBase: 200_000_000n, reusableBase: 0n,
  feeBase: 0n, feeError: null, busy: false, canSign: true, readable: true, otherPendingId: null, releasePending: false, resuming: false,
};
const check = (over: Partial<CopyFormInput>) => checkCopyForm({ ...base, ...over });

describe("checkCopyForm (S23 copy drawer)", () => {
  it("passes a sound setup and takes the top-up from the wallet", () => {
    const r = check({});
    expect(r.blockedBy).toBeNull();
    expect(r.topUpBase).toBe(100_000_000n);
  });

  it("names a per-trade limit above the strategy's ceiling on the field and the button", () => {
    const r = check({ perTradeText: "10" });
    expect(r.perTradeError).toBe("Above this strategy's 5.00 tUSDC per trade");
    expect(r.blockedBy).toBe(r.perTradeError);
  });

  it("names a per-trade limit above the budget", () => {
    const r = check({ budgetText: "3", perTradeText: "5" });
    expect(r.perTradeError).toBe("More than your total budget");
    expect(r.maxPerTradeBase).toBe(3_000_000n);
  });

  it("names a wallet that cannot cover the top-up and fee", () => {
    const r = check({ walletBase: 40_000_000n, feeBase: 1_000_000n, reusableBase: 10_000_000n });
    expect(r.budgetError).toBe("Your wallet holds 40.00 tUSDC; this setup needs 91.00 tUSDC");
    expect(r.maxBudgetBase).toBe(49_000_000n);
  });

  it("orders session reasons before field reasons", () => {
    expect(check({ busy: true, perTradeText: "10" }).blockedBy).toBe("Finish the wallet action in progress first.");
    expect(check({ canSign: false }).blockedBy).toBe("Connect a wallet that can sign.");
    expect(check({ readable: false }).blockedBy).toBe("Your current permission is still being checked.");
    expect(check({ otherPendingId: "7" }).blockedBy).toBe("Finish or release the unfinished copy of strategy #7 first.");
    expect(check({ releasePending: true }).blockedBy).toBe("A permission release is still being checked.");
  });

  it("asks for a budget and a per-trade limit, then for the fee", () => {
    expect(check({ budgetText: "" }).blockedBy).toBe("Enter a total budget.");
    expect(check({ perTradeText: "0" }).blockedBy).toBe("Enter the most you allow per trade.");
    expect(check({ feeBase: null }).blockedBy).toBe("The subscription fee is still loading.");
    expect(check({ feeBase: null, feeError: "The strategy could not be read." }).blockedBy).toBe("The strategy could not be read.");
  });

  it("marks text that is not an amount", () => {
    expect(check({ budgetText: "ten" }).budgetError).toBe("Enter an amount like 25 or 12.50");
  });

  it("does not re-check fixed numbers when resuming a saved setup", () => {
    const r = check({ resuming: true, perTradeText: "10", budgetText: "" });
    expect(r.perTradeError).toBeNull();
    expect(r.blockedBy).toBeNull();
  });
});
