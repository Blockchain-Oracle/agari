import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type TransactionReceipt } from "viem";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { recoverVaultExecution, recoverVaultReceipt, type VaultExecutionEvidence } from "./recovery";

const mocks = vi.hoisted(() => ({ receipt: vi.fn(), logs: vi.fn(), head: vi.fn(), transaction: vi.fn() }));
vi.mock("../runtime/read-runtime", () => ({
  getVaultDeployment: () => ({ eventVault: `0x${"44".repeat(20)}` }),
  getClient: () => ({ getViemClient: () => ({ getTransactionReceipt: mocks.receipt, getLogs: mocks.logs, getBlockNumber: mocks.head, getTransaction: mocks.transaction }) }),
}));
const owner = `0x${"11".repeat(20)}` as Address;
const actor = `0x${"22".repeat(20)}` as Address;
const vault = `0x${"44".repeat(20)}` as Address;
const other = `0x${"55".repeat(20)}` as Address;
const hash = `0x${"ab".repeat(32)}` as Hex;
const input: VaultExecutionEvidence = { owner, actor, marketId: toMarketId(`0x${"33".repeat(32)}`), grantId: 7n,
  side: "up", fromBlock: 100n, txHash: hash, expectedNonce: 9 };

function chain(over: { owner?: Address; actor?: Address; vault?: Address; side?: number; cash?: bigint; tokens?: bigint; grantId?: bigint; isBuy?: boolean } = {}): TransactionReceipt {
  const log = {
    address: over.vault ?? vault, removed: false, transactionHash: hash, blockNumber: 101n,
    topics: encodeEventTopics({ abi: eventVaultAbi, eventName: "Executed", args: { owner: over.owner ?? owner, marketId: input.marketId, grantId: over.grantId ?? 7n } }),
    data: encodeAbiParameters([{ type: "uint8" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "uint64" }],
      [over.side ?? 0, over.isBuy ?? true, over.cash ?? 1_234_567n, over.tokens ?? 2_469_134n, over.actor ?? actor, 1_800_000_000n]),
  };
  return { transactionHash: hash, status: "success", from: actor, to: vault, logs: [log] } as unknown as TransactionReceipt;
}

beforeEach(() => { vi.resetAllMocks(); mocks.head.mockResolvedValue(101n); mocks.receipt.mockResolvedValue(chain()); mocks.logs.mockResolvedValue(chain().logs); mocks.transaction.mockResolvedValue({ from: actor, to: vault, nonce: 9 }); });

describe("strict vault execution recovery", () => {
  it("retains exact event deltas and distinguishes zero-token execution from a fill", () => {
    expect(recoverVaultReceipt(input, chain(), vault)).toMatchObject({ status: "confirmed", txHash: hash, cashDelta: 1_234_567n, tokenDelta: 2_469_134n, side: "up" });
    expect(recoverVaultReceipt(input, chain({ tokens: 0n, cash: 0n }), vault)).toMatchObject({ status: "confirmed", tokenDelta: 0n });
  });
  it.each([{ owner: other }, { actor: other }, { vault: other }, { side: 1 }, { grantId: 8n }, { isBuy: false }])("rejects a different instruction identity", change => {
    expect(recoverVaultReceipt(input, chain(change), vault)).toEqual({ status: "unknown" });
  });
  it("rejects mismatched transaction identity and ambiguous or absent Executed logs", () => {
    const valid = chain();
    for (const receipt of [{ ...valid, from: other }, { ...valid, to: other }, { ...valid, transactionHash: `0x${"cd".repeat(32)}` },
      { ...valid, logs: [] }, { ...valid, logs: [...valid.logs, ...valid.logs] }]) {
      expect(recoverVaultReceipt(input, receipt as TransactionReceipt, vault)).toEqual({ status: "unknown" });
    }
  });
  it("reports a known reverted transaction only after checking actor and vault", () => {
    expect(recoverVaultReceipt(input, { ...chain(), status: "reverted", logs: [] }, vault)).toEqual({ status: "reverted", txHash: hash });
    expect(recoverVaultReceipt(input, { ...chain(), from: other, status: "reverted", logs: [] }, vault)).toEqual({ status: "unknown" });
  });
  it("recovers a lost broadcast hash only from a matching reserved nonce and full receipt", async () => {
    await expect(recoverVaultExecution({ ...input, txHash: null })).resolves.toMatchObject({ status: "confirmed", txHash: hash });
    expect(mocks.transaction).toHaveBeenCalledWith({ hash });
    expect(mocks.receipt).toHaveBeenCalledWith({ hash });
  });
  it("never borrows a different order's nonce or infers absence as permission to send", async () => {
    mocks.transaction.mockResolvedValue({ from: actor, to: vault, nonce: 10 });
    await expect(recoverVaultExecution({ ...input, txHash: null })).resolves.toEqual({ status: "unknown" });
    expect(mocks.receipt).not.toHaveBeenCalled();
    mocks.logs.mockClear();
    await expect(recoverVaultExecution({ ...input, txHash: null, expectedNonce: null })).resolves.toEqual({ status: "unknown" });
    expect(mocks.logs).not.toHaveBeenCalled();
  });
  it("pages block ranges and preserves uncertainty on a missing receipt", async () => {
    mocks.head.mockResolvedValue(100_101n); mocks.logs.mockResolvedValue([]);
    await expect(recoverVaultExecution({ ...input, txHash: null })).resolves.toEqual({ status: "unknown" });
    expect(mocks.logs).toHaveBeenCalledTimes(3);
    mocks.receipt.mockRejectedValue(new Error("RPC offline"));
    await expect(recoverVaultExecution(input)).resolves.toEqual({ status: "unknown" });
  });
});
