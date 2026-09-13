import type { IntentJournal } from "@masayume/core/ports";
import type { StrategyIntent } from "@masayume/core/strategies";
import type { Address, Hex } from "@masayume/core/types";
import { mulBpsCeil } from "@masayume/core/units";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maxUint256 } from "viem";
import type { VaultContracts } from "../vault/write";

const mocks = vi.hoisted(() => ({ gas: vi.fn() }));
vi.mock("../submitter/gas", async (original) => ({ ...await original<object>(), checkGas: mocks.gas }));
vi.mock("./deployment", () => ({ resolveRegistryDeployment: () => ({ strategyRegistry: `0x${"11".repeat(20)}` }) }));
vi.mock("../collateral", () => ({ getCollateral: () => ({ address: `0x${"22".repeat(20)}`, decimals: 6 }) }));
import { sendStrategyIntent, submitStrategyTx } from "./write";
import { requiredGasWei } from "../submitter/gas";

const OWNER = `0x${"33".repeat(20)}` as Address;
const HASH = `0x${"44".repeat(32)}` as Hex;
const REGISTRY = `0x${"11".repeat(20)}`;
const spec = { preset: "momentum" as const, lookback: 6, thresholdBps: 10 };
const metadata = { name: "Shannon Momentum", portraitSeed: "a-unique-portrait", spec, description: "Public strategy metadata ".repeat(100) };
const publish: StrategyIntent = { kind: "strategy-publish", runner: OWNER, spec, metadata, feeBase: 0n, envelope: { maxStakePerTradeBase: 1n, maxDailySpendBase: 5n, maxOpenPositions: 2, maxPriceRaw: 0n } };

function fixture(initialAllowance = 0n, fee = 2n) {
  let allowance = initialAllowance;
  const estimate = vi.fn().mockResolvedValue(0x51e49cn);
  const simulate = vi.fn(async (request) => ({ request }));
  const read = vi.fn(async ({ functionName }) => functionName === "allowance" ? allowance : { active: true, subscriptionFee: fee });
  const send = vi.fn(async ({ functionName, args }) => {
    if (functionName === "approve") allowance = args[1];
    return HASH;
  });
  const receipt = vi.fn().mockResolvedValue({ status: "success", transactionHash: HASH });
  const contracts = { walletClient: { account: { address: OWNER }, writeContract: send }, publicClient: { simulateContract: simulate, estimateContractGas: estimate, readContract: read, getTransactionReceipt: receipt }, deployment: null } as unknown as VaultContracts;
  return { contracts, estimate, simulate, read, send, receipt, allowance: () => allowance };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.gas.mockResolvedValue({ ok: true, lane: "vault", balanceWei: 100n, requiredWei: 0n });
});

describe("registry gas based on actual metadata", () => {
  it.each(["strategy-publish", "strategy-update"] as const)("estimates the exact long-metadata %s call instead of truncating it to 4m gas", async (kind) => {
    const f = fixture();
    const intent = kind === "strategy-publish" ? publish : { kind, strategyId: 1n, spec, metadata, feeBase: 0n };
    await sendStrategyIntent(f.contracts, intent);
    const request = f.simulate.mock.calls[0]![0];
    expect(request.args).toContain(JSON.stringify(metadata));
    expect(f.estimate).toHaveBeenCalledExactlyOnceWith(request);
    const gas = mulBpsCeil(0x51e49cn, 12_000);
    expect(gas).toBeGreaterThan(4_000_000n);
    expect(f.send).toHaveBeenCalledExactlyOnceWith({ ...request, gas });
    expect(mocks.gas).toHaveBeenCalledExactlyOnceWith(OWNER, "vault", gas);
    expect(requiredGasWei("vault", gas)).toBeGreaterThan(requiredGasWei("vault"));
  });
  it("refuses before a signature when the computed native envelope is not funded", async () => {
    const f = fixture();
    const technical = "native balance 658688458000000000 wei is below the 810296568000000000 wei vault envelope";
    mocks.gas.mockResolvedValue({ ok: false, lane: "vault", balanceWei: 658_688_458_000_000_000n, requiredWei: 810_296_568_000_000_000n, diagnosis: { kind: "out-of-gas", technical } });
    await expect(sendStrategyIntent(f.contracts, publish)).rejects.toMatchObject({
      message: "Not enough STT for network gas. Your wallet has 0.658688 STT; this step needs at least 0.810297 STT available. Add STT from the Somnia testnet faucet, then retry.",
      diagnosis: { kind: "out-of-gas" },
      cause: { message: technical },
    });
    expect(f.send).not.toHaveBeenCalled();
  });
  it("preserves unreadable balance errors instead of asking for a refill without a balance", async () => {
    const f = fixture();
    mocks.gas.mockResolvedValue({ ok: false, lane: "vault", balanceWei: null, requiredWei: 10n, diagnosis: { kind: "rpc-down", technical: "native balance RPC unavailable" } });
    await expect(sendStrategyIntent(f.contracts, publish)).rejects.toThrow("native balance RPC unavailable");
    expect(f.send).not.toHaveBeenCalled();
  });
  it("holds an unavailable estimate and preserves simulation errors before estimating", async () => {
    const f = fixture();
    f.estimate.mockRejectedValueOnce(new Error("estimate unavailable"));
    await expect(sendStrategyIntent(f.contracts, publish)).rejects.toThrow("estimate unavailable");
    const refusal = new Error("BadEnvelope()");
    f.simulate.mockRejectedValueOnce(refusal);
    await expect(sendStrategyIntent(f.contracts, publish)).rejects.toBe(refusal);
    expect(f.estimate).toHaveBeenCalledTimes(1);
    expect(f.send).not.toHaveBeenCalled();
  });
});

describe("reviewed subscription fee allowance", () => {
  it.each([0n, 2n])("replaces an old unlimited allowance with exactly the reviewed %s fee", async (fee) => {
    const f = fixture(maxUint256, fee);
    await sendStrategyIntent(f.contracts, { kind: "strategy-subscribe", strategyId: 1n, grantId: 8n, feeBase: fee });
    expect(f.send.mock.calls[0]![0]).toMatchObject({ functionName: "approve", args: [REGISTRY, fee] });
    expect(f.allowance()).toBe(fee);
    expect(f.send.mock.calls[1]![0]).toMatchObject({ functionName: "subscribe", args: [1n, 8n] });
  });
  it("does not add an approval transaction when allowance already equals the reviewed fee", async () => {
    const f = fixture(2n);
    await sendStrategyIntent(f.contracts, { kind: "strategy-subscribe", strategyId: 1n, grantId: 8n, feeBase: 2n });
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.send.mock.calls[0]![0]).toMatchObject({ functionName: "subscribe" });
  });
  it("stops if the creator changes the fee while the approval confirms", async () => {
    const f = fixture(0n);
    let reads = 0;
    f.read.mockImplementation(async ({ functionName }) => functionName === "allowance" ? f.allowance() : { active: true, subscriptionFee: ++reads === 1 ? 2n : 3n });
    await expect(sendStrategyIntent(f.contracts, { kind: "strategy-subscribe", strategyId: 1n, grantId: 8n, feeBase: 2n })).rejects.toThrow("subscription fee or strategy status changed");
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.send.mock.calls[0]![0]).toMatchObject({ functionName: "approve", args: [REGISTRY, 2n] });
    expect(f.allowance()).toBe(2n);
  });
});

describe("registry broadcast evidence", () => {
  it("keeps a successful publication's known hash when persisting confirmation fails", async () => {
    const f = fixture();
    const journal = { record: vi.fn(async () => ({ id: "1" })), markSent: vi.fn(), markConfirmed: vi.fn().mockRejectedValue(new Error("storage unavailable")), markUnknown: vi.fn(), markFailed: vi.fn() } as unknown as IntentJournal;
    expect(await submitStrategyTx({ contracts: f.contracts, wallet: OWNER, journal }, publish)).toMatchObject({ status: "unknown", txHash: HASH });
    expect(journal.markSent).toHaveBeenCalledWith("1", HASH);
    expect(journal.markFailed).not.toHaveBeenCalled();
    expect(f.send).toHaveBeenCalledTimes(1);
  });
});
