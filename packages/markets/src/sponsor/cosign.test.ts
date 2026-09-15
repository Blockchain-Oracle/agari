import { generateKeyPairSync } from "node:crypto";
import { assertIsFullySignedTransaction, getBase64Encoder, getBase64EncodedWireTransaction, getSignatureFromTransaction, getTransactionDecoder, getPublicKeyFromAddress, verifySignature } from "@solana/kit";
import { describe, expect, it, vi } from "vitest";
import type { SponsorRpc, SponsorSimulation } from "./chain";
import { SponsorRpcError } from "./chain";
import { cosign, type SponsorLimits } from "./cosign";
import { createAttemptLimiter, createLocalLedger, gateVerdict, type CosignRow } from "./gates";
import { createSponsorService, NO_SPONSOR_KEY } from "./service";
import { sponsorFixture } from "./tx.fixture";

const LIMITS: SponsorLimits = {
  maxComputeUnits: 400_000,
  maxMicroLamports: 0n,
  maxFeeLamports: 10_000n,
  signerPerHour: 30,
  devicePerHour: 60,
  deviceDailyLamports: 5_000_000n,
  dailyLamports: 500_000_000n,
  minBalanceLamports: 200_000_000n,
  attemptsPerDevicePerMinute: 20,
  attemptsPerIpPerMinute: 60,
};
const NOW_MS = Date.UTC(2026, 8, 15, 12, 0, 0);
const BALANCE = 500_000_000n;

function fakeRpc(over: Partial<{ height: bigint; valid: boolean; fee: bigint | null; balance: bigint; simulation: Partial<SponsorSimulation> }> = {}) {
  return {
    getBlockHeight: vi.fn(async () => over.height ?? 1_000n),
    isBlockhashValid: vi.fn(async () => over.valid ?? true),
    getFeeForMessage: vi.fn(async () => (over.fee === undefined ? 10_000n : over.fee)),
    getBalance: vi.fn(async () => over.balance ?? BALANCE),
    simulate: vi.fn(async (): Promise<SponsorSimulation> => ({ err: null, unitsConsumed: 41_000n, sponsorPreLamports: BALANCE, sponsorPostLamports: BALANCE - 10_000n, ...over.simulation })),
  } satisfies SponsorRpc;
}

async function setup() {
  const f = await sponsorFixture();
  const wire = await f.wire(f.message([f.cu(60_000), f.vaultIx()]));
  const transaction = getBase64EncodedWireTransaction(getTransactionDecoder().decode(wire));
  const ledger = createLocalLedger();
  const attempts = createAttemptLimiter();
  let nowMs = NOW_MS;
  const run = (rpc: SponsorRpc, body: unknown = { transaction, lastValidBlockHeight: "1150" }, device = "device-1", ip = "203.0.113.7") =>
    cosign({ keyPair: f.sponsor.keyPair, sponsor: f.sponsor.address, vaultProgram: f.vault, limits: LIMITS, rpc, ledger, attempts, nowMs: () => nowMs }, { body, device, ip });
  return { ...f, ledger, run, advance: (ms: number) => void (nowMs += ms) };
}

describe("sponsor co-sign (tap-trading.md §3 checks 6–9, then the fee-payer signature)", () => {
  it("signs the sponsor's slot only, returns bytes Kit accepts as fully signed, and records the co-sign", async () => {
    const t = await setup();
    const result = await t.run(fakeRpc());
    if (!result.ok) throw new Error(result.error);
    expect(result.instruction).toBe("agari_vault:actor_place_for");
    const signed = getTransactionDecoder().decode(getBase64Encoder().encode(result.transaction));
    assertIsFullySignedTransaction(signed);
    expect(getSignatureFromTransaction(signed)).toBe(result.signature);
    for (const signer of [t.sponsor.address, t.key.address]) expect(await verifySignature(await getPublicKeyFromAddress(signer), signed.signatures[signer]!, signed.messageBytes)).toBe(true);
    expect(t.ledger.rows()).toEqual([expect.objectContaining({ signature: result.signature, signer: t.key.address, device: "device-1", feeLamports: 10_000n, lastValidBlockHeight: 1_150n })]);
  });

  it("6: an expired blockhash or too few blocks left is 409, before simulation and without a co-sign", async () => {
    const t = await setup();
    const expired = fakeRpc({ valid: false });
    expect(await t.run(expired)).toMatchObject({ ok: false, status: 409 });
    expect(expired.simulate).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc({ fee: null }))).toMatchObject({ ok: false, status: 409 });
    expect(await t.run(fakeRpc({ height: 1_131n }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("blocks left") });
  });

  it("7: a fee above the cap is 403", async () => {
    const t = await setup();
    expect(await t.run(fakeRpc({ fee: 15_000n }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("fee") });
  });

  it("8: a failing simulation, units over the limit or more than the fee leaving the sponsor is 409; nothing recorded", async () => {
    const t = await setup();
    expect(await t.run(fakeRpc({ simulation: { err: { InstructionError: [1, { Custom: 7108 }] } } }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("7108") });
    expect(await t.run(fakeRpc({ simulation: { unitsConsumed: 60_001n } }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("compute units") });
    expect(await t.run(fakeRpc({ simulation: { sponsorPostLamports: BALANCE - 10_001n } }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("more than the fee") });
    expect(await t.run(fakeRpc({ simulation: { sponsorPreLamports: null, sponsorPostLamports: BALANCE - 2_000_000n } }))).toMatchObject({ ok: false, status: 409 });
    expect(t.ledger.rows()).toHaveLength(0);
  });

  it("9: no device refuses without an RPC call; the breaker is 503; an RPC failure is 502; a malformed body is 400", async () => {
    const t = await setup();
    const rpc = fakeRpc();
    expect(await t.run(rpc, undefined, "")).toMatchObject({ ok: false, status: 429 });
    expect(rpc.getBlockHeight).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc({ simulation: { sponsorPreLamports: 199_999_999n, sponsorPostLamports: 199_989_999n } }))).toMatchObject({ ok: false, status: 503 });
    expect(await t.run({ ...fakeRpc(), getBlockHeight: () => Promise.reject(new SponsorRpcError("getBlockHeight")) })).toMatchObject({ ok: false, status: 502 });
    expect(await t.run(fakeRpc(), { transaction: "not base64!", lastValidBlockHeight: 1 })).toMatchObject({ ok: false, status: 400 });
    expect(await t.run(fakeRpc(), { transaction: "AAAA", lastValidBlockHeight: -1 })).toMatchObject({ ok: false, status: 400 });
    expect(t.ledger.rows()).toHaveLength(0);
  });
});

describe("sponsor attempt limits (before any RPC)", () => {
  it("refuses a device's 21st attempt in a minute without an RPC call, and lets it back after the minute", async () => {
    const t = await setup();
    const rpc = fakeRpc();
    const garbage = { transaction: "AAAA", lastValidBlockHeight: 1 };
    for (let i = 0; i < 20; i += 1) expect(await t.run(rpc, garbage)).toMatchObject({ ok: false, status: 400 });
    const flooded = fakeRpc();
    expect(await t.run(flooded)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("device attempt") });
    expect(flooded.getBlockHeight).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc(), undefined, "device-2")).toMatchObject({ ok: true });
    t.advance(60_000);
    expect(await t.run(fakeRpc())).toMatchObject({ ok: true });
  });

  it("refuses an address's 61st attempt in a minute across rotating device ids; no forwarded address is one shared bucket", async () => {
    const t = await setup();
    const garbage = { transaction: "AAAA", lastValidBlockHeight: 1 };
    for (let i = 0; i < 60; i += 1) await t.run(fakeRpc(), garbage, `rotating-${i}`);
    const flooded = fakeRpc();
    expect(await t.run(flooded, undefined, "rotating-new")).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("network attempt") });
    expect(flooded.getBlockHeight).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc(), undefined, "rotating-new", "198.51.100.9")).toMatchObject({ ok: true });
    for (let i = 0; i < 60; i += 1) await t.run(fakeRpc(), garbage, `anon-${i}`, "");
    expect(await t.run(fakeRpc(), undefined, "anon-new", "")).toMatchObject({ ok: false, status: 429 });
  });
});

describe("sponsor gates (quotas, daily budgets, breaker)", () => {
  const row = (over: Partial<CosignRow> = {}): CosignRow => ({ signature: "s", signer: "signer-a", device: "device-a", instruction: "agari_vault:actor_place_for", feeLamports: 10_000n, lastValidBlockHeight: 1n, createdAtMs: NOW_MS, ...over });

  it("caps a signer and a device per hour, and lets the hour roll off", () => {
    const bySigner = Array.from({ length: 30 }, (_, i) => row({ device: `d${i}`, createdAtMs: NOW_MS - 3_599_000 + i }));
    expect(gateVerdict(bySigner, row({ device: "fresh" }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("signer") });
    expect(gateVerdict(bySigner, row({ device: "fresh", createdAtMs: NOW_MS + 1_000 }), LIMITS, BALANCE)).toEqual({ ok: true });
    const byDevice = Array.from({ length: 60 }, (_, i) => row({ signer: `s${i}` }));
    expect(gateVerdict(byDevice, row({ signer: "fresh" }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("device cap") });
  });

  it("holds the device and global daily lamports, resetting at 00:00 UTC", () => {
    const earlier = NOW_MS - 3 * 3_600_000;
    const deviceSpent = [row({ feeLamports: 4_995_000n, signer: "x", createdAtMs: earlier })];
    expect(gateVerdict(deviceSpent, row({ feeLamports: 5_000n }), LIMITS, BALANCE)).toEqual({ ok: true });
    expect(gateVerdict(deviceSpent, row({ feeLamports: 5_001n }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("this device") });
    const globalSpent = [row({ device: "other", signer: "y", feeLamports: 499_995_000n, createdAtMs: earlier })];
    expect(gateVerdict(globalSpent, row({ feeLamports: 5_001n }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("today's budget") });
    expect(gateVerdict(globalSpent, row({ feeLamports: 5_001n, createdAtMs: Date.UTC(2026, 8, 16, 0, 0, 1) }), LIMITS, BALANCE)).toEqual({ ok: true });
  });

  it("opens the breaker below the floor and records nothing it refuses", async () => {
    const ledger = createLocalLedger();
    expect(await ledger.admit(row(), LIMITS, 199_999_999n)).toMatchObject({ ok: false, status: 503 });
    expect(await ledger.admit(row({ device: "" }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429 });
    expect(ledger.rows()).toHaveLength(0);
    expect(await ledger.admit(row(), LIMITS, BALANCE)).toEqual({ ok: true });
    expect(ledger.rows()).toHaveLength(1);
  });
});

describe("sponsor service (the route's status and co-sign)", () => {
  const cliKeypair = () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const d = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
    const x = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
    return JSON.stringify([...d, ...x]);
  };
  const vault = "84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9" as never;

  it("says why it is off: no key, not deployed, unreadable balance, breaker; configured on local counters otherwise", async () => {
    expect(await createSponsorService({ AGARI_KEYS_DIR: "/nonexistent" }).status(vault)).toMatchObject({ configured: false, reason: NO_SPONSOR_KEY });
    const env = { SPONSOR_PRIVATE_KEY: cliKeypair(), AGARI_KEYS_DIR: "/nonexistent" };
    expect(await createSponsorService(env, { rpc: fakeRpc() }).status(null)).toMatchObject({ configured: false, reason: expect.stringContaining("not deployed") });
    expect(await createSponsorService(env, { rpc: { ...fakeRpc(), getBalance: () => Promise.reject(new Error("down")) } }).status(vault)).toMatchObject({ configured: false, balanceLamports: null });
    expect(await createSponsorService(env, { rpc: fakeRpc({ balance: 1n }) }).status(vault)).toMatchObject({ configured: false, balanceLamports: 1n, reason: expect.stringContaining("floor") });
    const on = await createSponsorService(env, { rpc: fakeRpc() }).status(vault);
    expect(on).toMatchObject({ configured: true, balanceLamports: BALANCE, reason: "local counters" });
    expect(on.allowlist).toContain("agari_vault:actor_place_for");
    expect(await createSponsorService({ ...env, SPONSOR_PRIVATE_KEY: "[1,2,3]" }).status(vault)).toMatchObject({ configured: false, reason: NO_SPONSOR_KEY });
  });

  it("refuses to co-sign with 503 before reading the body while nothing is deployed", async () => {
    const env = { SPONSOR_PRIVATE_KEY: cliKeypair() };
    expect(await createSponsorService(env, { rpc: fakeRpc() }).cosign(null, { transaction: "AAAA", lastValidBlockHeight: 1 }, "d", "")).toMatchObject({ ok: false, status: 503 });
  });
});
