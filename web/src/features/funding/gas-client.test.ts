import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaucetClaimView, FaucetStatus } from "@masayume/core/faucet";
import { requestGas } from "./gas-client";

const wallet = `0x${"ab".repeat(20)}`;
const claim: FaucetClaimView = { id: "request-1", amountWei: "2000000000000000000", txHash: `0x${"cd".repeat(32)}`, status: "confirmed", nextClaimAtMs: 1_900_000_000_000 };
const status: FaucetStatus = { configured: true, ready: true, address: wallet, fundingBalanceWei: "50000000000000000000", walletBalanceWei: "0", dailyRemainingWei: "40000000000000000000", targetWei: claim.amountWei, thresholdWei: "1000000000000000000", claim: null, message: "Eligible" };
const stored = new Map<string, string>();
const storageKey = `masayume.faucet.gas-request.${wallet}`;
const response = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });
const input = () => ({ wallet, status, current: () => true, sign: vi.fn(async () => "0x1234"), stage: vi.fn(), onClaim: vi.fn() });

beforeEach(() => {
  stored.clear();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("gas funding browser recovery", () => {
  it("does not request a transfer when the wallet rejects the free signature", async () => {
    const fetch = vi.fn(async () => response({ id: claim.id, message: "Verify" })); vi.stubGlobal("fetch", fetch);
    const run = input(); run.sign.mockRejectedValue(new Error("User rejected request"));
    await expect(requestGas(run)).rejects.toThrow("rejected");
    expect(fetch).toHaveBeenCalledTimes(1); expect(stored.size).toBe(0);
  });

  it("stops before submitting when the connected wallet changes during signing", async () => {
    const fetch = vi.fn(async () => response({ id: claim.id, message: "Verify" })); vi.stubGlobal("fetch", fetch);
    const run = input(); let current = true; run.current = () => current;
    run.sign.mockImplementation(async () => { current = false; return "0x1234"; });
    await expect(requestGas(run)).rejects.toThrow("Wallet changed");
    expect(fetch).toHaveBeenCalledTimes(1); expect(stored.size).toBe(0);
  });

  it("resumes the saved prepared request without another signature or new challenge", async () => {
    const saved = { id: claim.id, signature: "0x1234" }; stored.set(storageKey, JSON.stringify(saved));
    const fetch = vi.fn(async () => response({ claim })); vi.stubGlobal("fetch", fetch);
    const run = input(); run.status = { ...status, claim: { ...claim, status: "prepared" } };
    await requestGas(run);
    expect(run.sign).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual(["/api/faucet", expect.objectContaining({ body: JSON.stringify(saved) })]);
    expect(stored.size).toBe(0); expect(run.onClaim).toHaveBeenCalledWith(claim);
  });

  it("retains the signed request after a lost broadcast acknowledgement", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ id: claim.id, message: "Verify" })).mockRejectedValueOnce(new Error("Network interrupted")); vi.stubGlobal("fetch", fetch);
    await expect(requestGas(input())).rejects.toThrow("Network interrupted");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(stored.get(storageKey)!)).toEqual({ id: claim.id, signature: "0x1234" });
  });

  it("polls only the original transfer and reports uncertainty instead of requesting a second payout", async () => {
    vi.useFakeTimers();
    const pending = { ...claim, status: "prepared" as const };
    stored.set(storageKey, JSON.stringify({ id: claim.id, signature: "0x1234" }));
    const fetch = vi.fn().mockResolvedValueOnce(response({ claim: pending })).mockImplementation(async () => response({ ...status, claim: pending })); vi.stubGlobal("fetch", fetch);
    const run = input(); run.status = { ...status, claim: pending };
    const result = expect(requestGas(run)).rejects.toThrow("still confirming");
    await vi.runAllTimersAsync(); await result;
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(1);
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "GET")).toHaveLength(10);
    expect(stored.size).toBe(1);
  });
});
