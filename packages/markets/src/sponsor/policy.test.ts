import {
  OWNER_DEPOSIT_AND_GRANT_DISCRIMINATOR,
  OWNER_DEPOSIT_DISCRIMINATOR,
  OWNER_FUND_GRANT_DISCRIMINATOR,
  OWNER_GRANT_DISCRIMINATOR,
  OWNER_MOVE_TO_PRIVATE_DISCRIMINATOR,
  OWNER_PLACE_DISCRIMINATOR,
  OWNER_REVOKE_DISCRIMINATOR,
  OWNER_WITHDRAW_DISCRIMINATOR,
  OWNER_WITHDRAW_PRIVATE_DISCRIMINATOR,
  PUBLIC_CRANK_SETTLE_DISCRIMINATOR,
} from "@agari/clients/agari-vault";
import { getRequestHeapFrameInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  AccountRole,
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { checkStatic } from "./policy";
import { sponsorFixture } from "./tx.fixture";

const LIMITS = { maxComputeUnits: 400_000, maxMicroLamports: 0n };

async function setup() {
  const f = await sponsorFixture();
  return { ...f, check: (bytes: Uint8Array) => checkStatic(bytes, f.sponsor.address, f.vault, LIMITS) };
}

describe("sponsor static policy (tap-trading.md §3 checks 1–5)", () => {
  it("passes a key's actor_place_for with a compute-unit limit, naming the instruction and the signer", async () => {
    const t = await setup();
    const verdict = await t.check(await t.wire(t.message([t.cu(60_000), t.vaultIx()])));
    expect(verdict).toMatchObject({ ok: true, instruction: "actor_place_for", signer: t.key.address, computeUnitLimit: 60_000 });
  });

  it("allows exactly the allowlist and refuses capital intake and attended orders", async () => {
    const t = await setup();
    const allowed = [
      [PUBLIC_CRANK_SETTLE_DISCRIMINATOR, "public_crank_settle"],
      [OWNER_WITHDRAW_DISCRIMINATOR, "owner_withdraw"],
      [OWNER_WITHDRAW_PRIVATE_DISCRIMINATOR, "owner_withdraw_private"],
      [OWNER_REVOKE_DISCRIMINATOR, "owner_revoke"],
    ] as const;
    for (const [d, name] of allowed) expect(await t.check(await t.wire(t.message([t.vaultIx(d)])))).toMatchObject({ ok: true, instruction: name });
    for (const d of [OWNER_DEPOSIT_DISCRIMINATOR, OWNER_DEPOSIT_AND_GRANT_DISCRIMINATOR, OWNER_GRANT_DISCRIMINATOR, OWNER_FUND_GRANT_DISCRIMINATOR, OWNER_PLACE_DISCRIMINATOR, OWNER_MOVE_TO_PRIVATE_DISCRIMINATOR]) {
      expect(await t.check(await t.wire(t.message([t.vaultIx(d)])))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("allowlist") });
    }
  });

  it("1: refuses garbage, trailing bytes, a legacy message and address-table lookups with 400", async () => {
    const t = await setup();
    expect(await t.check(Uint8Array.from([1, 2, 3]))).toMatchObject({ ok: false, status: 400 });
    const good = await t.wire(t.message([t.vaultIx()]));
    expect(await t.check(Uint8Array.from([...good, 0]))).toMatchObject({ ok: false, status: 400 });
    expect(await t.check(await t.wire(t.message([t.vaultIx()], t.sponsor.address, "legacy")))).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("v0") });
    const lut = (await generateKeyPairSigner()).address;
    const compressed = compressTransactionMessageUsingAddressLookupTables(t.message([t.vaultIx()]), { [lut]: [t.owner] });
    expect(await t.check(await t.wire(compressed))).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("lookups") });
  });

  it("2: refuses another fee payer, and a sponsor slot that is already filled", async () => {
    const t = await setup();
    expect(await t.check(await t.wire(t.message([t.vaultIx()], t.key.address)))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("fee payer") });
    const signedBySponsor = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(t.sponsor, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: t.blockhash, lastValidBlockHeight: 1_150n }, m),
      (m) => appendTransactionMessageInstructions([t.vaultIx()], m),
    );
    expect(await t.check(await t.wire(signedBySponsor))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("slot") });
  });

  it("3: refuses a tampered message, a missing signature and a third signer", async () => {
    const t = await setup();
    const tampered = await t.wire(t.message([t.vaultIx()]));
    // The last byte is the v0 lookup count; the one before it is the vault instruction's last data byte.
    tampered[tampered.length - 2]! ^= 1;
    expect(await t.check(tampered)).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("does not verify") });
    const unsigned = await t.wire(t.message([t.vaultIx()]));
    unsigned.fill(0, 65, 129);
    expect(await t.check(unsigned)).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("not signed") });
    const third = await generateKeyPairSigner();
    const three = t.message([t.vaultIx(undefined, [{ address: third.address, role: AccountRole.READONLY_SIGNER, signer: third } as never])]);
    expect(await t.check(await t.wire(three))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("at most 2") });
  });

  it("4: refuses another program, a second vault instruction, four instructions and compute budget over the caps", async () => {
    const t = await setup();
    const transfer = getTransferSolInstruction({ source: t.key, destination: t.account as Address, amount: 1n });
    expect(await t.check(await t.wire(t.message([t.vaultIx(), transfer])))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("only for agari-vault") });
    expect(await t.check(await t.wire(t.message([t.vaultIx(), t.vaultIx(OWNER_REVOKE_DISCRIMINATOR)])))).toMatchObject({ ok: false, status: 403 });
    const four = [t.cu(1), getSetComputeUnitPriceInstruction({ microLamports: 0 }), t.vaultIx(OWNER_REVOKE_DISCRIMINATOR), t.vaultIx(OWNER_REVOKE_DISCRIMINATOR)];
    expect(await t.check(await t.wire(t.message(four)))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("at most 3") });
    expect(await t.check(await t.wire(t.message([t.cu(400_001), t.vaultIx()])))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("compute-unit limit") });
    expect(await t.check(await t.wire(t.message([getSetComputeUnitPriceInstruction({ microLamports: 1 }), t.vaultIx()])))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("price") });
    expect(await t.check(await t.wire(t.message([getRequestHeapFrameInstruction({ bytes: 1_048_576 }), t.vaultIx()])))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("compute-budget") });
  });

  it("5: refuses when the sponsor's key is in an instruction's accounts", async () => {
    const t = await setup();
    const lent = t.message([t.vaultIx(PUBLIC_CRANK_SETTLE_DISCRIMINATOR, [{ address: t.sponsor.address, role: AccountRole.WRITABLE }])]);
    expect(await t.check(await t.wire(lent))).toMatchObject({ ok: false, status: 403, error: expect.stringContaining("appears in an instruction") });
  });
});
