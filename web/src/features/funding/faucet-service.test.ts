import { describe, expect, it, vi } from "vitest";
import { faucetTopUpLamports, SOL_FAUCET_POLICY as POLICY, type FaucetChallenge, type FaucetClaim } from "@agari/core/faucet";
import { encodeBase58 } from "@agari/core/types";
import type { FaucetStore } from "@agari/db";
import type { FaucetChain } from "@agari/markets/faucet";
import { createFaucetService, verifyChallengeSignature } from "./faucet-service.server";

const key = (n: number, length = 32) => encodeBase58(new Uint8Array(length).fill(n));
const FUNDER = key(0xaa);
const wallet = (n: number) => key(n);
const W = wallet(1);
const SIG = key(0xab, 64);
const sig = (n: number) => key(n, 64);
const NOW_MS = 1_900_000_000_000;
const SOL = 1_000_000_000n;
function harness() {
  const challenges = new Map<string, FaucetChallenge>();
  const claims = new Map<string, FaucetClaim>();
  const balances = new Map<string, bigint>([[FUNDER, 100n * SOL]]);
  const landed = new Set<string>();
  let nowMs = NOW_MS;
  let id = 0;
  let sent = 0;
  let tail = Promise.resolve();
  const store: FaucetStore = {
    challenge: vi.fn(async (id) => challenges.get(id) ?? null),
    addChallenge: vi.fn(async (c) => { challenges.set(c.id, c); }),
    challengeCounts: vi.fn(async (w, ip, since) => {
      const list = [...challenges.values()].filter((c) => c.createdAtMs >= since);
      return { total: list.length, wallet: list.filter((c) => c.wallet === w).length, ip: list.filter((c) => c.ipHash === ip).length };
    }),
    claim: vi.fn(async (id) => claims.get(id) ?? null),
    latest: vi.fn(async (w) => [...claims.values()].filter((c) => c.wallet === w).sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null),
    pending: vi.fn(async () => [...claims.values()].find((c) => c.status === "prepared" || c.status === "conflict") ?? null),
    used: vi.fn(async (since, ip) => {
      const list = [...claims.values()].filter((c) => c.createdAtMs >= since);
      return { amountLamports: list.reduce((sum, c) => sum + BigInt(c.amountLamports), 0n), ip: list.filter((c) => c.ipHash === ip).length };
    }),
    insert: vi.fn(async (c) => { claims.set(c.id, c); }),
    mark: vi.fn(async (id, status) => { const c = claims.get(id); if (c?.status === "prepared") claims.set(id, { ...c, status }); }),
  };
  const lock = async <T>(run: (s: FaucetStore) => Promise<T>): Promise<T> => {
    const before = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await before;
    try { return await run(store); } finally { release(); }
  };
  const chain: FaucetChain = {
    address: FUNDER as FaucetChain["address"],
    cluster: "devnet",
    verify: vi.fn(async () => false),
    balance: vi.fn(async (w) => balances.get(w) ?? 0n),
    prepare: vi.fn(async () => { sent += 1; return { lastValidBlockHeight: 1_000 + sent, feeLamports: "5000", txHash: sig(sent), rawTransaction: `raw-${sent}` }; }),
    inspect: vi.fn(async (c) => landed.has(c.txHash) ? "confirmed" : "prepared"),
    broadcast: vi.fn(async (c) => {
      expect(claims.has(c.id)).toBe(true); // Nothing is broadcast before the durable reservation exists.
      if (!landed.has(c.txHash)) {
        landed.add(c.txHash);
        balances.set(c.wallet, (balances.get(c.wallet) ?? 0n) + BigInt(c.amountLamports));
        balances.set(FUNDER, balances.get(FUNDER)! - BigInt(c.amountLamports) - BigInt(c.feeLamports));
      }
    }),
  };
  const verify = vi.fn(async (_wallet: string, _message: string, _signature: string) => true);
  const deps = { read: async () => store, lock, now: () => nowMs, id: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`, verify };
  const service = createFaucetService(chain, deps);
  const request = async (w = W, ip = "ip-a") => { const c = await service.challenge(w, ip, "https://agari.xyz"); return service.claim(c.id, SIG, ip); };
  return { service, chain, store, deps, verify, claims, challenges, balances, landed, request, advance: (ms: number) => { nowMs += ms; } };
}

describe("devnet SOL faucet policy", () => {
  it("tops up to a target, never adds the target on top of an existing balance", () => {
    expect(faucetTopUpLamports(0n)).toBe(POLICY.targetLamports);
    expect(faucetTopUpLamports(POLICY.thresholdLamports - 1n)).toBe(POLICY.targetLamports - POLICY.thresholdLamports + 1n);
    expect(faucetTopUpLamports(POLICY.thresholdLamports)).toBe(0n);
  });
  it("binds the signature to domain, wallet, network, nonce and expiry", async () => {
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://agari.xyz");
    for (const part of ["https://agari.xyz", W, "Solana devnet", c.id, "gives no permission"]) expect(c.message).toContain(part);
  });
  it("refuses a malformed wallet or signature before any crypto runs", async () => {
    expect(await verifyChallengeSignature("0x1234", "message", SIG)).toBe(false);
    expect(await verifyChallengeSignature(W, "message", "0xab")).toBe(false);
  });
  it("does not reserve or broadcast an invalid signature", async () => {
    const h = harness(); h.verify.mockResolvedValue(false);
    await expect(h.request()).rejects.toMatchObject({ code: "signature-invalid" });
    expect(h.claims.size).toBe(0); expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("refuses expired and changed-connection requests before funding", async () => {
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://agari.xyz");
    await expect(h.service.claim(c.id, SIG, "ip-b")).rejects.toMatchObject({ code: "request-changed" });
    h.advance(POLICY.challengeTtlMs);
    await expect(h.service.claim(c.id, SIG, "ip-a")).rejects.toMatchObject({ code: "challenge-expired" });
    expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("rejects sufficient wallet balances, exhausted allocation, and the funding reserve", async () => {
    const funded = harness(); funded.balances.set(W, POLICY.thresholdLamports);
    await expect(funded.request()).rejects.toMatchObject({ code: "already-funded" });
    const budget = harness(); vi.mocked(budget.store.used).mockResolvedValue({ amountLamports: POLICY.dailyLamports, ip: 0 });
    await expect(budget.request()).rejects.toMatchObject({ code: "daily-limit" });
    const reserve = harness(); reserve.balances.set(FUNDER, POLICY.reserveLamports + POLICY.targetLamports - 1n);
    await expect(reserve.request()).rejects.toMatchObject({ code: "refill-needed" });
    for (const h of [funded, budget, reserve]) expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("fails closed when balances or claim history cannot be read", async () => {
    for (const kind of ["balance", "history"] as const) {
      const h = harness();
      if (kind === "balance") vi.mocked(h.chain.balance).mockRejectedValue(new Error("rpc-down"));
      else vi.mocked(h.store.used).mockRejectedValue(new Error("db-down"));
      await expect(h.request()).rejects.toThrow();
      expect(h.chain.broadcast).not.toHaveBeenCalled();
    }
  });
  it("never broadcasts when saving the signed transfer fails", async () => {
    const h = harness(); vi.mocked(h.store.insert).mockRejectedValue(new Error("db commit failed"));
    await expect(h.request()).rejects.toThrow("db commit failed");
    expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("concurrent retries produce one signed transaction and one payment", async () => {
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://agari.xyz");
    await Promise.all(Array.from({ length: 16 }, () => h.service.claim(c.id, SIG, "ip-a")));
    expect(h.claims.size).toBe(1); expect(h.chain.prepare).toHaveBeenCalledTimes(1); expect(h.landed.size).toBe(1);
    expect(h.balances.get(W)).toBe(POLICY.targetLamports);
  });
  it("a second challenge cannot bypass wallet cooldown after moving funds away", async () => {
    const h = harness(); await h.request(); h.balances.set(W, 0n);
    await expect(h.request(W, "another-ip")).rejects.toMatchObject({ code: "cooldown" });
    h.advance(POLICY.cooldownMs + 1);
    await expect(h.request()).resolves.toMatchObject({ status: "confirmed" });
    expect(h.landed.size).toBe(2);
  });
  it("recovers a crash after reservation with the exact saved transaction", async () => {
    const h = harness(); vi.mocked(h.chain.broadcast).mockRejectedValueOnce(new Error("process interrupted"));
    const initial = await h.request(); expect(initial.status).toBe("prepared");
    h.advance(POLICY.challengeTtlMs + 1);
    const restarted = createFaucetService(h.chain, h.deps);
    const recovered = await restarted.claim(initial.id, SIG, "new-connection");
    expect(recovered).toMatchObject({ txHash: initial.txHash, status: "confirmed" });
    expect(h.chain.prepare).toHaveBeenCalledTimes(1); expect(h.landed.size).toBe(1);
  });
  it("recovers a lost broadcast acknowledgement without a second payment", async () => {
    const h = harness(); const send = h.chain.broadcast;
    vi.mocked(h.chain.broadcast).mockImplementationOnce(async (c) => {
      h.landed.add(c.txHash); h.balances.set(c.wallet, BigInt(c.amountLamports)); throw new Error("ack lost");
    });
    const result = await h.request(); expect(result.status).toBe("confirmed");
    await h.service.claim(result.id, SIG, "ip-a");
    expect(send).toHaveBeenCalledTimes(1); expect(h.chain.prepare).toHaveBeenCalledTimes(1);
  });
  it("an unresolved or conflicting transfer holds all new allocations", async () => {
    const h = harness(); vi.mocked(h.chain.broadcast).mockRejectedValue(new Error("offline"));
    await h.request();
    await expect(h.request(wallet(2))).rejects.toMatchObject({ code: "pending-transfer" });
    vi.mocked(h.chain.inspect).mockResolvedValue("conflict");
    await expect(h.request(wallet(2))).rejects.toMatchObject({ code: "pending-transfer" });
    expect(h.chain.prepare).toHaveBeenCalledTimes(1);
  });
  it("limits challenge spam and repeated claims from one connection", async () => {
    const h = harness(); for (let n = 0; n < 6; n++) await h.service.challenge(W, "ip-a", "https://agari.xyz");
    await expect(h.service.challenge(W, "ip-a", "https://agari.xyz")).rejects.toMatchObject({ code: "rate-limited" });
    const other = harness(); vi.mocked(other.store.used).mockResolvedValue({ amountLamports: POLICY.targetLamports, ip: 10 });
    await expect(other.request()).rejects.toMatchObject({ code: "rate-limited" });
  });
  it("public status omits signed bytes and IP identifiers", async () => {
    const h = harness(); await h.request(); const status = await h.service.status(W);
    expect(status.walletBalanceLamports).toBe(String(POLICY.targetLamports));
    expect(JSON.stringify(status)).not.toContain("rawTransaction"); expect(JSON.stringify(status)).not.toContain("ip-a");
  });
});
