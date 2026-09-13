import type { OrderRequest, StopGate } from "@masayume/core/ports";
import { toMarketId, type Address, type Hex, type Quote } from "@masayume/core/types";
import type { TransactionReceipt } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJournal } from "../submitter/journal";
import { createMemoryStore } from "../submitter/journal-memory";
import type { OrderLaneContext } from "../submitter/order-lane";
import { TxRevertedError } from "../submitter/steps/assert-tx-ok";
import { submitVaultOrder } from "./order";
import { getVaultHoldings, toVaultGrant } from "./read";
import { submitVaultTx, VaultBroadcastError, writeVault, type VaultContracts } from "./write";

vi.mock("../collateral", () => ({ getCollateral: () => ({ decimals: 6 }) }));
vi.mock("../submitter/gas", () => ({
  gasLimitFor: () => 500_000n,
  checkGas: async () => ({ ok: true, lane: "vault", balanceWei: 1n, requiredWei: 0n }),
}));
vi.mock("../submitter/steps/status-gate", () => ({ statusGate: async () => ({ expirySec: 1_800_000_900 }) }));
vi.mock("../submitter/steps/quote", () => ({ freshQuote: async ({ displayed }: { displayed: Quote }) => displayed }));
vi.mock("./read", () => ({
  getVaultSnapshot: async () => ({ ok: true, value: { account: { availableBase: 100_000_000n } } }),
  getVaultHoldings: vi.fn(),
  toVaultGrant: vi.fn(),
}));

const HASH = `0x${"11".repeat(32)}` as Hex;
const WALLET = `0x${"22".repeat(20)}` as Address;
const VAULT = `0x${"33".repeat(20)}` as Address;
const MARKET = toMarketId(`0x${"44".repeat(32)}`);
const NOW = 1_800_000_000_000;

const quote: Quote = {
  side: "up", stakeBase: 1_000_000n, contractsRaw: 2_000_000n,
  expectedCostBase: 1_000_000n, maxCostBase: 1_000_000n, limitPriceRaw: 500_000n,
  avgPriceBps: 5_000, oddsCents: 50, payoutIfRightBase: 2_000_000n,
  fillableStakeBase: 1_000_000n, partial: false, feeBps: 0, decimals: 6, quotedAtMs: NOW,
};

function fixture() {
  const receipt = { status: "success", transactionHash: HASH, logs: [] } as unknown as TransactionReceipt;
  const simulate = vi.fn().mockResolvedValue({ request: { address: VAULT, functionName: "withdraw", args: [1n] } });
  const send = vi.fn().mockResolvedValue(HASH);
  const getReceipt = vi.fn().mockResolvedValue(receipt);
  const contracts = {
    deployment: { eventVault: VAULT },
    walletClient: { account: { address: WALLET }, writeContract: send },
    publicClient: { simulateContract: simulate, getTransactionReceipt: getReceipt, readContract: vi.fn().mockResolvedValue({}) },
  } as unknown as VaultContracts;
  const store = createMemoryStore();
  const journal = createJournal(store, () => NOW);
  const markSent = vi.spyOn(journal, "markSent");
  const markConfirmed = vi.spyOn(journal, "markConfirmed");
  const markFailed = vi.spyOn(journal, "markFailed");
  const markUnknown = vi.spyOn(journal, "markUnknown");
  const stopGate: StopGate = {
    checkAndReserve: vi.fn().mockResolvedValue({ ok: true, reservationId: "reservation" }),
    reconcile: vi.fn().mockResolvedValue(undefined),
  };
  const request = {
    market: { marketId: MARKET, asset: "BTC", poolAddress: VAULT, decimals: 6, intervalSec: 900 },
    wallet: WALLET, side: "up", stakeBase: quote.stakeBase, displayedQuote: quote, route: { kind: "vault" },
  } as OrderRequest;
  const context = { contracts, wallet: WALLET, journal, stopGate, nowMs: () => NOW } as OrderLaneContext & { contracts: VaultContracts };
  return { receipt, contracts, simulate, send, getReceipt, store, journal, markSent, markConfirmed, markFailed, markUnknown, stopGate, request, context };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("vault broadcast boundary", () => {
  it.each([false, true])("reports the hash before polling, including a sponsored send (%s)", async (sponsored) => {
    const f = fixture();
    const sponsoredSend = vi.fn().mockResolvedValue(HASH);
    if (sponsored) f.contracts.sponsor = { covers: () => true, send: sponsoredSend, lastRefusal: () => null };
    const broadcast = vi.fn(async (hash: Hex) => {
      expect(hash).toBe(HASH);
      expect(f.getReceipt).not.toHaveBeenCalled();
    });
    const sent = await writeVault(f.contracts, "withdraw", [1n], "withdraw", broadcast);
    expect(sent).toEqual({ hash: HASH, receipt: f.receipt });
    expect(broadcast).toHaveBeenCalledExactlyOnceWith(HASH);
    expect(f.send).toHaveBeenCalledTimes(sponsored ? 0 : 1);
    expect(sponsoredSend).toHaveBeenCalledTimes(sponsored ? 1 : 0);
  });

  it("keeps a timeout's broadcast hash and original cause without another send", async () => {
    const f = fixture();
    f.getReceipt.mockRejectedValue(new Error("not mined yet"));
    const result = writeVault(f.contracts, "withdraw", [1n], "withdraw").catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await result;
    expect(error).toBeInstanceOf(VaultBroadcastError);
    expect(error).toMatchObject({ txHash: HASH, cause: { name: "WaitForTransactionReceiptTimeoutError" } });
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it("keeps a known hash when the broadcast listener cannot persist it", async () => {
    const f = fixture();
    const cause = new Error("storage unavailable");
    const result = writeVault(f.contracts, "withdraw", [1n], "withdraw", async () => { throw cause; });
    await expect(result).rejects.toMatchObject({ name: "VaultBroadcastError", txHash: HASH, cause });
    expect(f.getReceipt).not.toHaveBeenCalled();
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it("leaves a mined revert as a typed revert", async () => {
    const f = fixture();
    f.getReceipt.mockResolvedValue({ ...f.receipt, status: "reverted" });
    await expect(writeVault(f.contracts, "withdraw", [1n], "withdraw")).rejects.toBeInstanceOf(TxRevertedError);
    expect(f.send).toHaveBeenCalledTimes(1);
  });
});

describe("vault transaction outcomes", () => {
  it("journals a hash before polling and keeps it in an unknown timeout outcome", async () => {
    const f = fixture();
    f.getReceipt.mockImplementation(async () => {
      expect(f.store.load()[0]).toMatchObject({ state: "sent", txHash: HASH });
      throw new Error("not mined yet");
    });
    const onPhase = vi.fn();
    const outcome = submitVaultTx(f.context, { kind: "vault-withdraw", amountBase: 1n }, onPhase);
    await vi.runAllTimersAsync();
    expect(await outcome).toMatchObject({ status: "unknown", txHash: HASH, diagnosis: { kind: "send-unknown", txHash: HASH } });
    expect(f.store.load()[0]).toMatchObject({ state: "unknown", txHash: HASH });
    expect(onPhase).toHaveBeenLastCalledWith("unknown", { txHash: HASH });
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it.each(["markSent", "markConfirmed"] as const)("does not turn %s failure after broadcast into a refusal", async (method) => {
    const f = fixture();
    f[method].mockRejectedValue(new Error("storage unavailable"));
    const outcome = await submitVaultTx(f.context, { kind: "vault-withdraw", amountBase: 1n });
    expect(outcome).toMatchObject({ status: "unknown", txHash: HASH });
    expect(f.markFailed).not.toHaveBeenCalled();
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it("keeps a known revert even when its journal cannot be updated", async () => {
    const f = fixture();
    f.getReceipt.mockResolvedValue({ ...f.receipt, status: "reverted" });
    f.markFailed.mockRejectedValue(new Error("storage unavailable"));
    const outcome = await submitVaultTx(f.context, { kind: "vault-withdraw", amountBase: 1n });
    expect(outcome).toMatchObject({ status: "reverted", txHash: HASH, diagnosis: { kind: "contract-revert" } });
    expect(outcome.status !== "confirmed" && outcome.diagnosis.technical).toContain("journal could not be fully updated");
  });

  it("still refuses a simulation failure without broadcasting", async () => {
    const f = fixture();
    f.simulate.mockRejectedValue(new Error("simulation refused"));
    expect(await submitVaultTx(f.context, { kind: "vault-withdraw", amountBase: 1n })).toMatchObject({ status: "refused" });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.store.load()[0]).toMatchObject({ state: "failed" });
  });
});

describe("vault order reservation safety", () => {
  it.each(["vault", "vault-grant"] as const)("retains an unknown %s order's hash and reservation after receipt timeout", async (route) => {
    const f = fixture();
    if (route === "vault-grant") {
      f.request.route = { kind: "vault-grant", grantId: 7n };
      vi.mocked(toVaultGrant).mockReturnValue({
        grantId: 7n, owner: WALLET, actor: WALLET, kind: "executor", revoked: false,
        expiresAtSec: NOW / 1_000 + 3_600, spentDay: Math.floor(NOW / 86_400_000),
        spentTodayBase: 0n, openPositions: 0, budgetBase: 25_000_000n,
        caps: { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 25_000_000n, maxOpenPositions: 4, maxPriceRaw: 950_000n },
      });
      vi.mocked(getVaultHoldings).mockResolvedValue({ ok: true, asOfMs: NOW, stale: false, value: { marketId: MARKET, upRaw: 0n, downRaw: 0n, upGrantId: 0n, downGrantId: 0n } });
    }
    f.getReceipt.mockRejectedValue(new Error("not mined yet"));
    const outcome = submitVaultOrder(f.context, f.request);
    await vi.runAllTimersAsync();
    expect(await outcome).toMatchObject({ status: "unknown", txHash: HASH });
    expect(f.store.load()[0]).toMatchObject({ state: "unknown", txHash: HASH });
    expect(f.stopGate.reconcile).not.toHaveBeenCalled();
    expect(f.simulate).toHaveBeenCalledWith(expect.objectContaining({
      functionName: route === "vault" ? "place" : "placeFor",
      args: [...(route === "vault-grant" ? [7n] : []), MARKET, 0, true, quote.limitPriceRaw, quote.contractsRaw, expect.any(BigInt)],
    }));
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it("also keeps a no-hash send timeout uncertain when the journal is unavailable", async () => {
    const f = fixture();
    f.send.mockRejectedValue(new Error("send timed out"));
    f.markUnknown.mockRejectedValue(new Error("storage unavailable"));
    const outcome = await submitVaultOrder(f.context, f.request);
    expect(outcome).toMatchObject({ status: "unknown", diagnosis: { kind: "send-unknown" } });
    expect(outcome).not.toHaveProperty("txHash");
    expect(f.stopGate.reconcile).not.toHaveBeenCalled();
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it.each(["markSent", "markConfirmed"] as const)("retains the reservation if %s fails after broadcast", async (method) => {
    const f = fixture();
    f[method].mockRejectedValue(new Error("storage unavailable"));
    f.markUnknown.mockRejectedValue(new Error("storage unavailable"));
    expect(await submitVaultOrder(f.context, f.request)).toMatchObject({ status: "unknown", txHash: HASH });
    expect(f.stopGate.reconcile).not.toHaveBeenCalled();
    expect(f.markFailed).not.toHaveBeenCalled();
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it("releases the reservation for a mined revert, even if its failure journal update fails", async () => {
    const f = fixture();
    f.getReceipt.mockResolvedValue({ ...f.receipt, status: "reverted" });
    f.markFailed.mockRejectedValue(new Error("storage unavailable"));
    expect(await submitVaultOrder(f.context, f.request)).toMatchObject({ status: "reverted", txHash: HASH });
    expect(f.stopGate.reconcile).toHaveBeenCalledExactlyOnceWith("reservation", 0n);
  });

  it("still confirms a mined order with no fills and reconciles zero spend", async () => {
    const f = fixture();
    expect(await submitVaultOrder(f.context, f.request)).toEqual({ status: "nothingFilled", txHash: HASH });
    expect(f.store.load()[0]).toMatchObject({ state: "confirmed", txHash: HASH });
    expect(f.stopGate.reconcile).toHaveBeenCalledExactlyOnceWith("reservation", 0n);
  });

  it("releases a reservation on simulation refusal without sending", async () => {
    const f = fixture();
    f.simulate.mockRejectedValue(new Error("simulation refused"));
    expect(await submitVaultOrder(f.context, f.request)).toMatchObject({ status: "refused" });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.stopGate.reconcile).toHaveBeenCalledExactlyOnceWith("reservation", 0n);
  });
});
