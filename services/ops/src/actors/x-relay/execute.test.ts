import { beforeEach, describe, expect, it, vi } from "vitest";
import { toMarketId } from "@masayume/core/types";
import { executeMention, type ExecutorContext } from "./execute";
import { replyText } from "./reply-format";
import { xGrantCaps } from "@masayume/core/x";

const dependencies = vi.hoisted(() => ({
  link: vi.fn(), snapshot: vi.fn(), lanes: vi.fn(), quote: vi.fn(), submit: vi.fn(),
}));
vi.mock("@masayume/db", () => ({ xLinkByAuthor: dependencies.link, xReceiptUpsert: vi.fn() }));
vi.mock("@masayume/markets", () => ({
  getCollateral: () => ({ decimals: 6 }), getVaultSnapshot: dependencies.snapshot,
  resolveVenueId: vi.fn(), marketsProvider: { listLiveLanes: dependencies.lanes, freshQuoteStake: dependencies.quote, nowMs: () => 100_000 },
}));

const HASH = `0x${"ab".repeat(32)}`;
const ADDRESS = `0x${"11".repeat(20)}`;
const MARKET_ID = toMarketId(`0x${"22".repeat(32)}`);
const mention = { id: "1", authorId: "2", handle: "example", text: "BTC UP 100 5m", createdAtMs: 1 };
// Dependencies are stubbed at the database/chain boundary: these tests never create a signer or make a request.
const context = { session: { address: ADDRESS, submitter: { submitOrder: dependencies.submit } }, venueId: MARKET_ID, log: vi.fn() } as unknown as ExecutorContext;
const market = {
  marketId: MARKET_ID, asset: "BTC", intervalSec: 300, expirySec: 400, isUpDown: true,
  tradingStartSec: 100, openingPriceRaw: 1n, status: "Trading", voided: false, finalized: false,
  poolAddress: ADDRESS, decimals: 6,
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.link.mockResolvedValue({ wallet: ADDRESS });
  dependencies.snapshot.mockResolvedValue({ ok: true, value: { grants: { executor: { grantId: 7n, actor: ADDRESS, kind: "executor", caps: xGrantCaps(), budgetBase: 100_000_000n, expiresAtSec: Math.floor(Date.now() / 1000) + 3600 } } } });
  dependencies.lanes.mockResolvedValue({ ok: true, value: { lanes: [{ markets: [market] }] } });
  dependencies.quote.mockResolvedValue({ ok: true, value: { maxCostBase: 100_000_000n } });
  dependencies.submit.mockResolvedValue({ status: "confirmed", booked: { txHash: HASH, costBase: 1_234_567n, contractsRaw: 2_469_134n, avgPriceBps: 5000 } });
});

describe("mention execution receipt integration", () => {
  it("reports failed market reads as unavailable, never as a nonexistent Window", async () => {
    dependencies.lanes.mockResolvedValue({ ok: false, error: { technical: "private provider error" } });
    expect(await executeMention(context, mention)).toMatchObject({ refusalCode: "market-data-unavailable", asset: "BTC", intervalSec: 300 });
    expect(dependencies.lanes).toHaveBeenCalledTimes(2);
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
  it("recovers from one failed market read without repeating an execution", async () => {
    dependencies.lanes.mockResolvedValueOnce({ ok: false, error: {} });
    expect((await executeMention(context, mention)).status).toBe("filled");
    expect(dependencies.submit).toHaveBeenCalledTimes(1);
  });
  it("retains the matched Window and cutoff when entry has closed", async () => {
    dependencies.lanes.mockResolvedValue({ ok: true, value: { lanes: [{ markets: [{ ...market, tradingStartSec: 0, expirySec: 130 }] }] } });
    expect(await executeMention(context, mention)).toMatchObject({ refusalCode: "window-entry-closed", marketId: MARKET_ID, entryClosesAtSec: 100, expirySec: 130 });
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
  it("preserves the missing-field diagnosis for both the reply text and image", async () => {
    const result = await executeMention(context, { ...mention, text: "BTC long 5" });
    expect(result.parseRefusal).toBe("no-cadence");
    expect(replyText(result, 6)).toContain("Add a timeframe");
    expect(replyText(result, 6)).toContain("BTC UP 5 15m");
  });
  it("routes a funded legacy permission to its update flow before quoting or submitting", async () => {
    dependencies.snapshot.mockResolvedValue({ ok: true, value: { grants: { executor: {
      grantId: 10n, actor: ADDRESS, kind: "executor", expiresAtSec: Math.floor(Date.now() / 1000) + 3600,
      caps: { ...xGrantCaps(), maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 5_000_000n }, budgetBase: 55_000_000n,
    } } } });
    expect(await executeMention(context, { ...mention, text: "BTC long 25 5m" })).toMatchObject({ status: "refused", refusalCode: "grant-update-required", grantId: "10", txHash: null });
    expect(dependencies.quote).not.toHaveBeenCalled();
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
  it("refuses a request above the allocated X balance, without using other wallet funds", async () => {
    const snapshot = await dependencies.snapshot();
    snapshot.value.grants.executor.budgetBase = 5_000_000n;
    expect(await executeMention(context, { ...mention, text: "BTC long 25 5m" })).toMatchObject({ status: "refused", refusalCode: "insufficient-funds" });
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
  it("durably captures sender routing, target, block and nonce before the submitter is allowed to send", async () => {
    const order: string[] = [];
    const checkpoint = vi.fn(async () => { order.push("checkpoint"); });
    dependencies.submit.mockImplementation(async () => { order.push("submit"); return { status: "nothingFilled", txHash: HASH }; });
    const durableContext = { ...context, checkpoint, session: { ...context.session, contracts: { publicClient: {
      getBlockNumber: vi.fn(async () => 1234n), getTransactionCount: vi.fn(async () => 9),
    } } } } as unknown as ExecutorContext;
    await executeMention(durableContext, mention);
    expect(order).toEqual(["checkpoint", "checkpoint", "submit"]);
    expect(checkpoint.mock.calls[1]).toEqual([expect.objectContaining({ wallet: ADDRESS, marketId: MARKET_ID, grantId: "7",
      executionActor: ADDRESS, collateralDecimals: 6, recoveryFromBlock: "1234", expectedNonce: 9, handle: "example" })]);
  });

  it("fails closed before submit if the durable snapshot cannot be stored", async () => {
    const checkpoint = vi.fn(async () => { throw new Error("database unavailable"); });
    await expect(executeMention({ ...context, checkpoint }, mention)).rejects.toThrow("database unavailable");
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it.each(["missing", "mismatched", "expired"])("refuses a %s grant before sending", async kind => {
    dependencies.snapshot.mockResolvedValue({ ok: true, value: { grants: { executor: kind === "missing" ? null : {
      grantId: 7n, actor: kind === "mismatched" ? `0x${"33".repeat(20)}` : ADDRESS,
      expiresAtSec: kind === "expired" ? 1 : Math.floor(Date.now() / 1000) + 3600,
    } } } });
    const result = await executeMention(context, mention);
    expect(result.status).toBe("refused"); expect(result.refusalCode).toMatch(/^grant-/);
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it.each(["snapshot", "lanes", "quote"] as const)("refuses last-good stale %s data after a refresh failure", async dependency => {
    const value = await dependencies[dependency]();
    dependencies[dependency].mockResolvedValue({ ...value, stale: true, staleReason: "refresh-failed" });
    expect((await executeMention(context, mention)).status).toBe("refused");
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
  it("passes the requested budget to the grant and records independently booked amounts plus the resolved Window", async () => {
    const result = await executeMention(context, mention);
    expect(dependencies.submit).toHaveBeenCalledWith(expect.objectContaining({ stakeBase: 100_000_000n, route: { kind: "vault-grant", grantId: 7n } }));
    expect(result).toMatchObject({ stakeBase: "100000000", bookedCostBase: "1234567", bookedContractsRaw: "2469134", avgPriceBps: 5000, marketId: MARKET_ID, asset: "BTC", intervalSec: 300, expirySec: 400, grantId: "7", status: "filled", txHash: HASH });
    expect(replyText(result, 6)).toContain("Spent 1.234567 tUSDC.");
  });

  it("does not submit an unlinked account and returns the stable public category", async () => {
    dependencies.link.mockResolvedValue(null);
    const result = await executeMention(context, mention);
    expect(result).toMatchObject({ status: "refused", refusalCode: "account-not-linked", txHash: null });
    expect(dependencies.snapshot).not.toHaveBeenCalled();
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it("does not echo invalid mention tokens into the public refusal", async () => {
    const result = await executeMention(context, { ...mention, text: "BTC UP 100 5m secret123" });
    expect(result).toMatchObject({ status: "refused", refusalCode: "instruction-invalid" });
    expect(result.reason).not.toContain("secret123");
    expect(replyText(result, 6)).not.toContain("secret123");
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it("does not leak provider errors while retaining the resolved Window for a failed quote", async () => {
    dependencies.quote.mockResolvedValue({ ok: false, error: { technical: "https://private-rpc.example?key=secret" } });
    const result = await executeMention(context, mention);
    expect(result).toMatchObject({ status: "refused", refusalCode: "quote-unavailable", marketId: MARKET_ID, expirySec: 400 });
    expect(result.reason).not.toMatch(/private-rpc|secret/);
    expect(dependencies.submit).not.toHaveBeenCalled();
  });

  it("records uncertainty without inventing a broadcast or booked amount", async () => {
    dependencies.submit.mockResolvedValue({ status: "unknown", diagnosis: { kind: "send-unknown", technical: "private provider detail" } });
    const result = await executeMention(context, mention);
    expect(result).toMatchObject({ status: "unknown", txHash: null, stakeBase: "100000000" });
    expect(result.bookedCostBase).toBeUndefined();
    expect(replyText(result, 6)).toContain("Status needs checking");
    expect(replyText(result, 6)).not.toContain("private provider");
  });

  it("keeps a tiny requested stake exact even when no quote is fillable", async () => {
    dependencies.quote.mockResolvedValue({ ok: true, value: null });
    const result = await executeMention(context, { ...mention, text: "BTC UP 0.000001 5m" });
    expect(result).toMatchObject({ stakeBase: "1", status: "refused", refusalCode: "no-liquidity" });
    expect(result.reason).not.toContain("0.00");
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
});
