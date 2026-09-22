import { describe, expect, it, vi } from "vitest";
import { faucetTopUpLamports, SOL_FAUCET_POLICY as POLICY, TUSDC_FAUCET_POLICY as TUSDC, type AnyFaucetClaim, type FaucetChallenge, type FaucetClaim, type FaucetClaimStatus, type TusdcFaucetClaim } from "@agari/core/faucet";
import { encodeBase58 } from "@agari/core/types";
import type { FaucetStore } from "@agari/db";
import type { FaucetChain } from "@agari/markets/faucet";
import { createFaucetService, TUSDC_FUNDING_FLOOR_LAMPORTS, verifyChallengeSignature } from "./faucet-service.server";

const key = (n: number, length = 32) => encodeBase58(new Uint8Array(length).fill(n));
const FUNDER = key(0xaa);
const wallet = (n: number) => key(n);
const W = wallet(1);
const SIG = key(0xab, 64);
const MINT = key(0xcc);
const sig = (n: number) => key(n, 64);
const NOW_MS = 1_900_000_000_000;
const SOL = 1_000_000_000n;
/** An in-memory claim journal with the Postgres store's rules (prepared/conflict hold, reverted still counts). */
function memoryJournal<C extends AnyFaucetClaim>(amountOf: (c: C) => string) {
  const claims = new Map<string, C>();
  const journal = {
    claim: vi.fn(async (id: string) => claims.get(id) ?? null),
    latest: vi.fn(async (w: string) => [...claims.values()].filter((c) => c.wallet === w).sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null),
    pending: vi.fn(async () => [...claims.values()].find((c) => c.status === "prepared" || c.status === "conflict") ?? null),
    used: vi.fn(async (since: number, ip: string) => {
      const list = [...claims.values()].filter((c) => c.createdAtMs >= since);
      return { amount: list.reduce((sum, c) => sum + BigInt(amountOf(c)), 0n), ip: list.filter((c) => c.ipHash === ip).length };
    }),
    insert: vi.fn(async (c: C) => { claims.set(c.id, c); }),
    mark: vi.fn(async (id: string, status: FaucetClaimStatus) => { const c = claims.get(id); if (c?.status === "prepared") claims.set(id, { ...c, status }); }),
  };
  return { claims, journal };
}
function harness({ mintAuthority = true } = {}) {
  const challenges = new Map<string, FaucetChallenge>();
  const sol = memoryJournal<FaucetClaim>((c) => c.amountLamports);
  const tusdc = memoryJournal<TusdcFaucetClaim>((c) => c.amountBase);
  const claims = sol.claims;
  const balances = new Map<string, bigint>([[FUNDER, 100n * SOL]]);
  const tokens = new Map<string, bigint>();
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
    sol: sol.journal,
    tusdc: tusdc.journal,
  };
  const lock = async <T>(run: (s: FaucetStore) => Promise<T>): Promise<T> => {
    const before = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await before;
    try { return await run(store); } finally { release(); }
  };
  const signed = async () => { sent += 1; return { lastValidBlockHeight: 1_000 + sent, feeLamports: "5000", txHash: sig(sent), rawTransaction: `raw-${sent}` }; };
  const chain = {
    address: FUNDER as FaucetChain["address"],
    mintAuthority: (mintAuthority ? key(0xbb) : null) as FaucetChain["mintAuthority"],
    cluster: "devnet",
    balance: vi.fn(async (w: string) => balances.get(w) ?? 0n),
    mint: vi.fn(async () => ({ address: MINT as FaucetChain["address"], decimals: 6, authority: key(0xbb) as FaucetChain["address"] })),
    tokenBalance: vi.fn(async (w: string) => tokens.get(w) ?? null),
    prepare: vi.fn(signed),
    prepareMint: vi.fn(signed),
    inspect: vi.fn(async (c: AnyFaucetClaim): Promise<FaucetClaimStatus> => landed.has(c.txHash) ? "confirmed" : "prepared"),
    broadcast: vi.fn(async (c: AnyFaucetClaim) => {
      // Nothing is broadcast before the durable reservation exists.
      expect((c.asset === "sol" ? sol.claims : tusdc.claims).has(c.id)).toBe(true);
      if (landed.has(c.txHash)) return;
      landed.add(c.txHash);
      if (c.asset === "tusdc") { tokens.set(c.wallet, (tokens.get(c.wallet) ?? 0n) + BigInt(c.amountBase)); return; }
      balances.set(c.wallet, (balances.get(c.wallet) ?? 0n) + BigInt(c.amountLamports));
      balances.set(FUNDER, balances.get(FUNDER)! - BigInt(c.amountLamports) - BigInt(c.feeLamports));
    }),
  } satisfies FaucetChain;
  const verify = vi.fn(async (_wallet: string, _message: string, _signature: string) => true);
  const deps = { read: async () => store, lock, now: () => nowMs, id: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`, verify };
  const service = createFaucetService(chain, deps);
  const request = async (w = W, ip = "ip-a") => { const c = await service.challenge(w, ip, "https://useagari.xyz"); return service.claim(c.id, SIG, ip); };
  return { service, chain, store, deps, verify, claims, mints: tusdc.claims, challenges, balances, tokens, landed, request, advance: (ms: number) => { nowMs += ms; } };
}

describe("devnet SOL faucet policy", () => {
  it("tops up to a target, never adds the target on top of an existing balance", () => {
    expect(faucetTopUpLamports(0n)).toBe(POLICY.targetLamports);
    expect(faucetTopUpLamports(POLICY.thresholdLamports - 1n)).toBe(POLICY.targetLamports - POLICY.thresholdLamports + 1n);
    expect(faucetTopUpLamports(POLICY.thresholdLamports)).toBe(0n);
  });
  it("binds the signature to domain, wallet, network, nonce and expiry", async () => {
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
    for (const part of ["https://useagari.xyz", W, "Solana devnet", c.id, "gives no permission"]) expect(c.message).toContain(part);
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
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
    await expect(h.service.claim(c.id, SIG, "ip-b")).rejects.toMatchObject({ code: "request-changed" });
    h.advance(POLICY.challengeTtlMs);
    await expect(h.service.claim(c.id, SIG, "ip-a")).rejects.toMatchObject({ code: "challenge-expired" });
    expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("rejects sufficient wallet balances, exhausted allocation, and the funding reserve", async () => {
    const funded = harness(); funded.balances.set(W, POLICY.thresholdLamports);
    await expect(funded.request()).rejects.toMatchObject({ code: "already-funded" });
    const budget = harness(); vi.mocked(budget.store.sol.used).mockResolvedValue({ amount: POLICY.dailyLamports, ip: 0 });
    await expect(budget.request()).rejects.toMatchObject({ code: "daily-limit" });
    const reserve = harness(); reserve.balances.set(FUNDER, POLICY.reserveLamports + POLICY.targetLamports - 1n);
    await expect(reserve.request()).rejects.toMatchObject({ code: "refill-needed" });
    for (const h of [funded, budget, reserve]) expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("fails closed when balances or claim history cannot be read", async () => {
    for (const kind of ["balance", "history"] as const) {
      const h = harness();
      if (kind === "balance") vi.mocked(h.chain.balance).mockRejectedValue(new Error("rpc-down"));
      else vi.mocked(h.store.sol.used).mockRejectedValue(new Error("db-down"));
      await expect(h.request()).rejects.toThrow();
      expect(h.chain.broadcast).not.toHaveBeenCalled();
    }
  });
  it("never broadcasts when saving the signed transfer fails", async () => {
    const h = harness(); vi.mocked(h.store.sol.insert).mockRejectedValue(new Error("db commit failed"));
    await expect(h.request()).rejects.toThrow("db commit failed");
    expect(h.chain.broadcast).not.toHaveBeenCalled();
  });
  it("concurrent retries produce one signed transaction and one payment", async () => {
    const h = harness(); const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
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
      h.landed.add(c.txHash); if (c.asset === "sol") h.balances.set(c.wallet, BigInt(c.amountLamports)); throw new Error("ack lost");
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
    const h = harness(); for (let n = 0; n < 6; n++) await h.service.challenge(W, "ip-a", "https://useagari.xyz");
    await expect(h.service.challenge(W, "ip-a", "https://useagari.xyz")).rejects.toMatchObject({ code: "rate-limited" });
    const other = harness(); vi.mocked(other.store.sol.used).mockResolvedValue({ amount: POLICY.targetLamports, ip: 10 });
    await expect(other.request()).rejects.toMatchObject({ code: "rate-limited" });
  });
  it("public status omits signed bytes and IP identifiers", async () => {
    const h = harness(); await h.request(); const status = await h.service.status(W);
    expect(status.walletBalanceLamports).toBe(String(POLICY.targetLamports));
    expect(JSON.stringify(status)).not.toContain("rawTransaction"); expect(JSON.stringify(status)).not.toContain("ip-a");
  });
});

describe("server-sent tUSDC claims (D-034)", () => {
  const AMOUNT = TUSDC.amountUnits * 1_000_000n;
  const claimBoth = async (h: ReturnType<typeof harness>, w = W, ip = "ip-a") => {
    const c = await h.service.challenge(w, ip, "https://useagari.xyz");
    return { c, sol: await h.service.claim(c.id, SIG, ip, "sol"), tusdc: await h.service.claim(c.id, SIG, ip, "tusdc") };
  };
  it("one challenge signature pays the SOL top-up and mints tUSDC once each", async () => {
    const h = harness(); const { c, sol, tusdc } = await claimBoth(h);
    expect(c.message).toContain("10,000 test tUSDC");
    expect(sol).toMatchObject({ asset: "sol", status: "confirmed" }); expect(tusdc).toMatchObject({ asset: "tusdc", amountBase: AMOUNT.toString(), status: "confirmed" });
    await Promise.all(Array.from({ length: 8 }, () => h.service.claim(c.id, SIG, "ip-a", "tusdc")));
    expect(h.chain.prepareMint).toHaveBeenCalledTimes(1); expect(h.tokens.get(W)).toBe(AMOUNT); expect(h.mints.size).toBe(1);
    expect(h.verify).toHaveBeenCalledTimes(10);
  });
  it("needs no wallet SOL and does not count against the SOL allocation", async () => {
    const h = harness(); h.balances.set(W, POLICY.thresholdLamports);
    const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
    await expect(h.service.claim(c.id, SIG, "ip-a", "tusdc")).resolves.toMatchObject({ status: "confirmed" });
    expect((await h.store.sol.used(0, "ip-a")).amount).toBe(0n);
  });
  it("refuses a second claim in 24 hours, the daily allocation, the IP limit and a funder below its floor", async () => {
    const cooled = harness(); await claimBoth(cooled);
    const again = await cooled.service.challenge(W, "ip-b", "https://useagari.xyz");
    await expect(cooled.service.claim(again.id, SIG, "ip-b", "tusdc")).rejects.toMatchObject({ code: "cooldown" });
    const budget = harness(); vi.mocked(budget.store.tusdc.used).mockResolvedValue({ amount: TUSDC.dailyUnits * 1_000_000n - AMOUNT + 1n, ip: 0 });
    const ip = harness(); vi.mocked(ip.store.tusdc.used).mockResolvedValue({ amount: 0n, ip: TUSDC.maxPerIpPerDay });
    const floor = harness(); floor.balances.set(FUNDER, TUSDC_FUNDING_FLOOR_LAMPORTS - 1n);
    expect(TUSDC_FUNDING_FLOOR_LAMPORTS).toBe(2_002_049_280n);
    for (const [h, code] of [[budget, "daily-limit"], [ip, "rate-limited"], [floor, "refill-needed"]] as const) {
      const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
      await expect(h.service.claim(c.id, SIG, "ip-a", "tusdc")).rejects.toMatchObject({ code });
      expect(h.chain.prepareMint).not.toHaveBeenCalled();
    }
    expect(cooled.chain.prepareMint).toHaveBeenCalledTimes(1);
  });
  it("recovers an interrupted mint with its saved bytes after the challenge expires", async () => {
    const h = harness(); vi.mocked(h.chain.broadcast).mockRejectedValueOnce(new Error("process interrupted"));
    const c = await h.service.challenge(W, "ip-a", "https://useagari.xyz");
    expect(await h.service.claim(c.id, SIG, "ip-a", "tusdc")).toMatchObject({ status: "prepared" });
    expect((await h.service.status(W)).tusdc.message).toContain("confirming");
    h.advance(POLICY.challengeTtlMs + 1);
    const recovered = await createFaucetService(h.chain, h.deps).claim(c.id, SIG, "new-ip", "tusdc");
    expect(recovered).toMatchObject({ status: "confirmed" }); expect(h.chain.prepareMint).toHaveBeenCalledTimes(1); expect(h.tokens.get(W)).toBe(AMOUNT);
  });
  it("reports tUSDC unavailable without a mint authority, and SOL keeps working", async () => {
    const h = harness({ mintAuthority: false }); const status = await h.service.status(W);
    expect(status.tusdc).toMatchObject({ configured: false, ready: false }); expect(status.ready).toBe(true);
  });
});
