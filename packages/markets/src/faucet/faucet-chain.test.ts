import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTransaction } from "viem";
import { STT_FAUCET_POLICY } from "@masayume/core/faucet";
import { createFaucetChain } from "./index";

const rpc = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getTransactionCount: vi.fn(),
  getGasPrice: vi.fn(),
  estimateGas: vi.fn(),
}));
vi.mock("viem", async (original) => ({ ...await original<object>(), createPublicClient: () => rpc }));

// Public test key; preparation signs locally but these tests never broadcast.
const key = `0x${"11".repeat(32)}` as const;
const recipient = `0x${"22".repeat(20)}` as const;
const amount = STT_FAUCET_POLICY.targetWei;

beforeEach(() => {
  vi.resetAllMocks();
  rpc.getChainId.mockResolvedValue(50312);
  rpc.getTransactionCount.mockResolvedValue(7);
  rpc.getGasPrice.mockResolvedValue(6_000_000_000n);
  rpc.estimateGas.mockResolvedValue(631_500n);
});

describe("Shannon STT funding transaction", () => {
  it("can fund an empty, previously unused wallet with Shannon's account-creation gas", async () => {
    // eth_estimateGas on Shannon, 2026-09-08: fresh address = 631,500; existing = 21,000.
    const transfer = await createFaucetChain(key).prepare(recipient, amount);
    expect(rpc.estimateGas).toHaveBeenCalledWith(expect.objectContaining({ to: recipient, value: amount }));
    expect(parseTransaction(transfer.rawTransaction)).toMatchObject({
      chainId: 50312, nonce: 7, to: recipient, value: amount,
      gas: 757_800n, gasPrice: 7_200_000_000n,
    });
    expect(BigInt(transfer.feeWei)).toBe(5_456_160_000_000_000n);
    expect(BigInt(transfer.feeWei)).toBeLessThan(STT_FAUCET_POLICY.maxTransferFeeWei);
  });

  it("keeps an existing recipient's transfer sized to its own estimate", async () => {
    rpc.estimateGas.mockResolvedValue(21_000n);
    const transfer = await createFaucetChain(key).prepare(recipient, amount);
    expect(parseTransaction(transfer.rawTransaction).gas).toBe(25_200n);
    expect(BigInt(transfer.feeWei)).toBe(181_440_000_000_000n);
  });

  it("still refuses transfers whose buffered fee would exceed 0.01 STT", async () => {
    rpc.estimateGas.mockResolvedValue(2_000_000n);
    await expect(createFaucetChain(key).prepare(recipient, amount)).rejects.toMatchObject({ code: "fees-high" });
    rpc.estimateGas.mockResolvedValue(631_500n);
    rpc.getGasPrice.mockResolvedValue(20_000_000_000n);
    await expect(createFaucetChain(key).prepare(recipient, amount)).rejects.toMatchObject({ code: "fees-high" });
  });

  it("does not prepare another transfer while a treasury nonce is pending", async () => {
    rpc.getTransactionCount.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    await expect(createFaucetChain(key).prepare(recipient, amount)).rejects.toMatchObject({ code: "busy" });
  });

  it("does not estimate or sign on the wrong network or when estimation fails", async () => {
    rpc.getChainId.mockResolvedValue(1);
    await expect(createFaucetChain(key).prepare(recipient, amount)).rejects.toMatchObject({ code: "wrong-network" });
    expect(rpc.estimateGas).not.toHaveBeenCalled();
    rpc.getChainId.mockResolvedValue(50312);
    rpc.estimateGas.mockRejectedValue(new Error("RPC unavailable"));
    await expect(createFaucetChain(key).prepare(recipient, amount)).rejects.toThrow("RPC unavailable");
  });
});
