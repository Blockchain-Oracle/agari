import { decodeBase58, encodeBase58 } from "@agari/core/types";
import { describe, expect, it, vi } from "vitest";
import type { SponsorRpc, SponsorSimulation } from "./chain";
import { cosign, type SponsorLimits } from "./cosign";
import { createLocalLedger, gateVerdict, type CosignRow } from "./gates";
import { anchorDiscriminator, COMPUTE_BUDGET_PROGRAM } from "./policy";
import { base64Bytes, decodeTransaction, toBase64 } from "./wire";
import { encodeMessageV0, encodeWire, fixtureKey, u32Instruction } from "./wire.fixture";

const LIMITS: SponsorLimits = {
  maxComputeUnits: 400_000,
  maxMicroLamports: 0n,
  maxFeeLamports: 10_000n,
  signerPerHour: 30,
  devicePerHour: 60,
  deviceDailyLamports: 5_000_000n,
  dailyLamports: 500_000_000n,
  minBalanceLamports: 200_000_000n,
};
const NOW_MS = Date.UTC(2026, 8, 15, 12, 0, 0);
const BALANCE = 500_000_000n;

function fakeRpc(over: Partial<{ height: bigint; valid: boolean; fee: bigint | null; balance: bigint; simulation: Partial<SponsorSimulation> }> = {}) {
  const rpc = {
    getBlockHeight: vi.fn(async () => over.height ?? 1_000n),
    isBlockhashValid: vi.fn(async () => over.valid ?? true),
    getFeeForMessage: vi.fn(async () => (over.fee === undefined ? 10_000n : over.fee)),
    getBalance: vi.fn(async () => over.balance ?? BALANCE),
    simulate: vi.fn(async (): Promise<SponsorSimulation> => ({ err: null, unitsConsumed: 41_000n, sponsorPreLamports: BALANCE, sponsorPostLamports: BALANCE - 10_000n, ...over.simulation })),
  } satisfies SponsorRpc;
  return rpc;
}

async function setup() {
  const [sponsor, key, vault, owner, blockhash] = await Promise.all([fixtureKey(), fixtureKey(), fixtureKey(), fixtureKey(), fixtureKey()]);
  const message = encodeMessageV0({
    signers: [sponsor.address, key.address],
    others: [owner.address],
    readonlyUnsigned: [COMPUTE_BUDGET_PROGRAM, vault.address],
    blockhash: blockhash.address,
    instructions: [
      { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: u32Instruction(2, 60_000) },
      { program: vault.address, accounts: [key.address, owner.address], data: anchorDiscriminator("actor_place_for") },
    ],
  });
  const wire = encodeWire([new Uint8Array(64), await key.sign(message)], message);
  const signer = { address: sponsor.address, sign: vi.fn(sponsor.sign) };
  const ledger = createLocalLedger();
  const run = (rpc: SponsorRpc, body: unknown = { transaction: toBase64(wire), lastValidBlockHeight: 1_150 }, device = "device-1") =>
    cosign({ signer, vaultProgram: vault.address, limits: LIMITS, rpc, ledger, nowMs: () => NOW_MS }, { body, device });
  return { sponsor, key, signer, ledger, run, message };
}

describe("sponsor co-sign (tap-trading.md §3 checks 6–9, then the fee-payer signature)", () => {
  it("signs slot 0 as fee payer only, returns the full bytes and records the co-sign", async () => {
    const t = await setup();
    const result = await t.run(fakeRpc());
    expect(result).toMatchObject({ ok: true, instruction: "agari_vault:actor_place_for" });
    if (!result.ok) throw new Error(result.error);
    const signed = decodeTransaction(base64Bytes(result.transaction)!);
    expect(encodeBase58(signed.signatures[0]!)).toBe(result.signature);
    expect(Buffer.from(signed.messageBytes).equals(Buffer.from(t.message))).toBe(true);
    const sponsorKey = await crypto.subtle.importKey("raw", new Uint8Array(decodeBase58(t.sponsor.address)!), "Ed25519", false, ["verify"]);
    expect(await crypto.subtle.verify("Ed25519", sponsorKey, new Uint8Array(signed.signatures[0]!), new Uint8Array(t.message))).toBe(true);
    expect(t.ledger.rows()).toEqual([expect.objectContaining({ signature: result.signature, signer: t.key.address, device: "device-1", feeLamports: 10_000n, lastValidBlockHeight: 1_150n })]);
  });

  it("6: an expired blockhash or too few blocks left is 409, before simulation and without signing", async () => {
    const t = await setup();
    const expired = fakeRpc({ valid: false });
    expect(await t.run(expired)).toMatchObject({ ok: false, status: 409 });
    expect(expired.simulate).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc({ fee: null }))).toMatchObject({ ok: false, status: 409 });
    expect(await t.run(fakeRpc({ height: 1_131n }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("blocks left") });
    expect(t.signer.sign).not.toHaveBeenCalled();
  });

  it("7: a fee above the cap is 403", async () => {
    const t = await setup();
    expect(await t.run(fakeRpc({ fee: 15_000n }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("fee") });
  });

  it("8: a failing simulation, units over the limit or more than the fee leaving the sponsor is 409 — nothing signed or recorded", async () => {
    const t = await setup();
    const failing = { err: { InstructionError: [1, { Custom: 7108 }] } };
    expect(await t.run(fakeRpc({ simulation: failing }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("7108") });
    expect(await t.run(fakeRpc({ simulation: { unitsConsumed: 60_001n } }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("compute units") });
    expect(await t.run(fakeRpc({ simulation: { sponsorPostLamports: BALANCE - 10_001n } }))).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("more than the fee") });
    expect(await t.run(fakeRpc({ simulation: { sponsorPreLamports: null, sponsorPostLamports: BALANCE - 2_000_000n } }))).toMatchObject({ ok: false, status: 409 });
    expect(t.signer.sign).not.toHaveBeenCalled();
    expect(t.ledger.rows()).toHaveLength(0);
  });

  it("9: no device id refuses without spending an RPC call; the breaker is 503; an RPC failure is 502", async () => {
    const t = await setup();
    const rpc = fakeRpc();
    expect(await t.run(rpc, undefined, "")).toMatchObject({ ok: false, status: 429 });
    expect(rpc.getBlockHeight).not.toHaveBeenCalled();
    expect(await t.run(fakeRpc({ simulation: { sponsorPreLamports: 199_999_999n, sponsorPostLamports: 199_989_999n } }))).toMatchObject({ ok: false, status: 503 });
    const down = { ...fakeRpc(), getBlockHeight: async () => Promise.reject(new (await import("./chain")).SponsorRpcError("getBlockHeight")) };
    expect(await t.run(down)).toMatchObject({ ok: false, status: 502 });
    expect(t.ledger.rows()).toHaveLength(0);
  });

  it("refuses a malformed body with 400", async () => {
    const t = await setup();
    expect(await t.run(fakeRpc(), { transaction: "not base64!", lastValidBlockHeight: 1 })).toMatchObject({ ok: false, status: 400 });
    expect(await t.run(fakeRpc(), { transaction: toBase64(new Uint8Array(8)), lastValidBlockHeight: -1 })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("sponsor gates (quotas, daily budgets, breaker)", () => {
  const row = (over: Partial<CosignRow> = {}): CosignRow => ({ signature: "s", signer: "signer-a", device: "device-a", instruction: "agari_vault:actor_place_for", feeLamports: 10_000n, lastValidBlockHeight: 1n, createdAtMs: NOW_MS, ...over });

  it("caps a signer at its hourly count and lets the hour roll off", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({ device: `d${i}`, createdAtMs: NOW_MS - 3_599_000 + i }));
    expect(gateVerdict(rows, row({ device: "fresh" }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("signer") });
    expect(gateVerdict(rows, row({ device: "fresh", createdAtMs: NOW_MS + 1_000 }), LIMITS, BALANCE)).toEqual({ ok: true });
  });

  it("caps a device at its hourly count across signers", () => {
    const rows = Array.from({ length: 60 }, (_, i) => row({ signer: `s${i}` }));
    expect(gateVerdict(rows, row({ signer: "fresh" }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("device cap") });
  });

  it("holds the device and global daily lamports, resetting at 00:00 UTC", () => {
    const earlier = NOW_MS - 3 * 3_600_000;
    const deviceSpent = [row({ feeLamports: 4_995_000n, signer: "x", createdAtMs: earlier })];
    expect(gateVerdict(deviceSpent, row({ feeLamports: 5_000n }), LIMITS, BALANCE)).toEqual({ ok: true });
    expect(gateVerdict(deviceSpent, row({ feeLamports: 5_001n }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("this device") });
    const globalSpent = [row({ device: "other", signer: "y", feeLamports: 499_995_000n, createdAtMs: earlier })];
    expect(gateVerdict(globalSpent, row({ feeLamports: 5_001n }), LIMITS, BALANCE)).toMatchObject({ ok: false, status: 429, error: expect.stringContaining("today's budget") });
    const nextDay = Date.UTC(2026, 8, 16, 0, 0, 1);
    expect(gateVerdict(globalSpent, row({ feeLamports: 5_001n, createdAtMs: nextDay }), LIMITS, BALANCE)).toEqual({ ok: true });
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
