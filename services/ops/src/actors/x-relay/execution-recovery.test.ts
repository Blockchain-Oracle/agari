import type { XReceipt } from "@masayume/core/x";
import { describe, expect, it, vi } from "vitest";
import { recoverExecutionReceipt, recoverXExecutions } from "./execution-recovery";

const receipt: XReceipt = { mentionId: "123", authorId: "456", handle: "caller", wallet: null, grantId: null, marketId: null,
  side: "up", stakeBase: "5000000", status: "submitted", reason: null, txHash: null, instruction: "fixture", atMs: 1, collateralDecimals: 6 };
const hash = `0x${"ab".repeat(32)}` as const;
describe("X receipt recovery without execution replay", () => {
  it("restores actual booked spend and a lost hash without replacing the requested amount", () => {
    expect(recoverExecutionReceipt(receipt, { status: "confirmed", txHash: hash, cashDelta: 1_234_567n, tokenDelta: 2_469_134n, side: "up", atSec: 1 }))
      .toMatchObject({ status: "filled", txHash: hash, bookedCostBase: "1234567", bookedContractsRaw: "2469134", avgPriceBps: 5000, stakeBase: "5000000" });
    expect(recoverExecutionReceipt(receipt, { status: "confirmed", txHash: hash, cashDelta: 0n, tokenDelta: 0n, side: "up", atSec: 1 })).toMatchObject({ status: "nothing-filled", txHash: hash });
  });
  it("keeps unknown, reverted, and missing decimal metadata honest", () => {
    expect(recoverExecutionReceipt(receipt, { status: "unknown" })).toMatchObject({ status: "unknown", txHash: null });
    expect(recoverExecutionReceipt(receipt, { status: "reverted", txHash: hash })).toMatchObject({ status: "reverted", txHash: hash });
    expect(recoverExecutionReceipt({ ...receipt, collateralDecimals: undefined }, { status: "confirmed", txHash: hash, cashDelta: 1n, tokenDelta: 1n, side: "up", atSec: 1 })).toMatchObject({ status: "unknown", txHash: hash });
  });
  it("saves uncertainty after an RPC error and continues independent candidates without a signer", async () => {
    const save = vi.fn(async (_before: XReceipt, _after: XReceipt) => true);
    const resolve = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "reverted", txHash: hash });
    await recoverXExecutions({ candidates: async () => [receipt, { ...receipt, mentionId: "124" }], resolve, save, log: vi.fn() });
    expect(save.mock.calls[0]).toEqual([receipt, expect.objectContaining({ status: "unknown" })]);
    expect(save.mock.calls[1]?.[1]).toMatchObject({ mentionId: "124", status: "reverted" });
  });
});
