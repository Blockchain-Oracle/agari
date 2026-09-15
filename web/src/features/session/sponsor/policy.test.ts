import { describe, expect, it } from "vitest";
import { anchorDiscriminator, checkStatic, COMPUTE_BUDGET_PROGRAM } from "./policy";
import { encodeMessageV0, encodeWire, fixtureKey, u32Instruction, u64Instruction, type FixtureInstruction, type FixtureMessage } from "./wire.fixture";

const LIMITS = { maxComputeUnits: 400_000, maxMicroLamports: 0n };
const SYSTEM = "11111111111111111111111111111111";

async function setup() {
  const [sponsor, key, vault, owner, account, blockhash] = await Promise.all([fixtureKey(), fixtureKey(), fixtureKey(), fixtureKey(), fixtureKey(), fixtureKey()]);
  const vaultIx = (name: string, accounts: string[] = [key.address, owner.address, account.address]): FixtureInstruction => ({
    program: vault.address,
    accounts,
    data: Uint8Array.from([...anchorDiscriminator(name), 7, 0, 0, 0]),
  });
  const cu = (units: number): FixtureInstruction => ({ program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: u32Instruction(2, units) });
  const base = (): FixtureMessage => ({
    signers: [sponsor.address, key.address],
    others: [owner.address, account.address],
    readonlyUnsigned: [COMPUTE_BUDGET_PROGRAM, vault.address, SYSTEM],
    blockhash: blockhash.address,
    instructions: [cu(60_000), vaultIx("actor_place_for")],
  });
  /** The key signs slot 1 over the exact message; slot 0 (the sponsor's) stays empty unless `sponsorSigns`. */
  const wire = async (message: FixtureMessage, opts: { sponsorSigns?: boolean; mutate?: (m: Uint8Array) => Uint8Array; extraSigners?: number } = {}) => {
    let bytes = encodeMessageV0(message);
    const keySig = await key.sign(bytes);
    if (opts.mutate) bytes = opts.mutate(bytes);
    const sponsorSig = opts.sponsorSigns ? await sponsor.sign(bytes) : new Uint8Array(64);
    return encodeWire([sponsorSig, keySig, ...Array.from({ length: opts.extraSigners ?? 0 }, () => new Uint8Array(64).fill(1))], bytes);
  };
  const check = (bytes: Uint8Array) => checkStatic(bytes, sponsor.address, vault.address, LIMITS);
  return { sponsor, key, vault, owner, account, base, wire, check, vaultIx, cu };
}

describe("sponsor static policy (tap-trading.md §3 checks 1–5)", () => {
  it("passes a key's actor_place_for with a compute-unit limit, naming the instruction and the signer", async () => {
    const t = await setup();
    const verdict = await t.check(await t.wire(t.base()));
    expect(verdict).toMatchObject({ ok: true, instruction: "actor_place_for", signer: t.key.address, computeUnitLimit: 60_000 });
  });

  it("allows every allowlisted instruction and refuses capital intake", async () => {
    const t = await setup();
    for (const name of ["public_crank_settle", "owner_withdraw", "owner_withdraw_private", "owner_revoke"]) {
      expect(await t.check(await t.wire({ ...t.base(), instructions: [t.vaultIx(name)] }))).toMatchObject({ ok: true, instruction: name });
    }
    for (const name of ["owner_deposit", "owner_deposit_and_grant", "owner_grant", "owner_fund_grant", "owner_place", "owner_move_to_private"]) {
      expect(await t.check(await t.wire({ ...t.base(), instructions: [t.vaultIx(name)] }))).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("1: refuses garbage, a legacy message and address-table lookups with 400", async () => {
    const t = await setup();
    expect(await t.check(Uint8Array.from([1, 2, 3]))).toMatchObject({ ok: false, status: 400 });
    const legacy = await t.wire(t.base(), { mutate: (m) => m.subarray(1, m.length - 1) });
    expect(await t.check(legacy)).toMatchObject({ ok: false, status: 400 });
    expect(await t.check(await t.wire({ ...t.base(), lookups: 1 }))).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("lookups") });
  });

  it("2: refuses another fee payer, and a sponsor slot that is already filled", async () => {
    const t = await setup();
    const swapped = { ...t.base(), signers: [t.key.address, t.sponsor.address] };
    expect(await t.check(await t.wire(swapped))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("fee payer") });
    expect(await t.check(await t.wire(t.base(), { sponsorSigns: true }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("slot") });
  });

  it("3: refuses a tampered message, a missing signature and a third signer", async () => {
    const t = await setup();
    const tampered = await t.wire(t.base(), { mutate: (m) => Uint8Array.from(m, (b, i) => (i === m.length - 2 ? b ^ 1 : b)) });
    expect(await t.check(tampered)).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("does not verify") });
    const unsigned = await t.wire(t.base());
    unsigned.fill(0, 65, 129);
    expect(await t.check(unsigned)).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("not signed") });
    const third = await fixtureKey();
    const three = await t.wire({ ...t.base(), signers: [t.sponsor.address, t.key.address, third.address] }, { extraSigners: 1 });
    expect(await t.check(three)).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("at most 2") });
  });

  it("4: refuses an extra program, a second vault instruction, four instructions and compute budget over the caps", async () => {
    const t = await setup();
    const transfer: FixtureInstruction = { program: "11111111111111111111111111111111", accounts: [t.key.address, t.account.address], data: Uint8Array.from([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]) };
    expect(await t.check(await t.wire({ ...t.base(), instructions: [t.vaultIx("actor_place_for"), transfer] }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("only for agari-vault") });
    expect(await t.check(await t.wire({ ...t.base(), instructions: [t.vaultIx("actor_place_for"), t.vaultIx("owner_revoke")] }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("exactly one") });
    const four = [t.cu(1), { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: u64Instruction(3, 0n) }, t.vaultIx("owner_revoke"), t.vaultIx("owner_revoke")];
    expect(await t.check(await t.wire({ ...t.base(), instructions: four }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("at most 3") });
    expect(await t.check(await t.wire({ ...t.base(), instructions: [t.cu(400_001), t.vaultIx("actor_place_for")] }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("compute-unit limit") });
    const priced = [{ program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: u64Instruction(3, 1n) }, t.vaultIx("actor_place_for")];
    expect(await t.check(await t.wire({ ...t.base(), instructions: priced }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("price") });
    const heap = [{ program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: u32Instruction(1, 1_048_576) }, t.vaultIx("actor_place_for")];
    expect(await t.check(await t.wire({ ...t.base(), instructions: heap }))).toMatchObject({ ok: false, status: 403 });
    expect(await t.check(await t.wire({ ...t.base(), instructions: [t.cu(1)] }))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("no agari-vault") });
  });

  it("5: refuses when the sponsor's key is in an instruction's accounts", async () => {
    const t = await setup();
    const lent = { ...t.base(), instructions: [t.vaultIx("public_crank_settle", [t.sponsor.address, t.owner.address])] };
    expect(await t.check(await t.wire(lent))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("appears in an instruction") });
  });
});
