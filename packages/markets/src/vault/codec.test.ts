import {
  AGARI_VAULT_PROGRAM_ADDRESS,
  findSeatPda,
  findVaultConfigPda,
  getActorPlaceForInstructionDataDecoder,
  getExecutedEventEncoder,
  getGrantDecoder,
  getGrantEncoder,
  getOwnerDepositAndGrantInstructionDataDecoder,
  getPublicCrankSettleInstructionDataDecoder,
  getVaultAccountDecoder,
  getVaultAccountEncoder,
} from "@agari/clients/agari-vault";
import { encodeBase58, toAddress, toMarketId, toSignature } from "@agari/core/types";
import { getBase58Decoder, type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import type { JsonTransaction } from "../submitter/events";
import { grantAddress, slotOf, sideOf, toVaultGrant, vaultEventAuthority } from "./accounts";
import { decodeVaultEvents } from "./events";
import { capsArgsOf, crankIx, depositAndGrantIx, engineBlockOf, lotsOf, placeIx, ticksOf } from "./instructions";
import { bookVaultEvents } from "./order";

const key = (n: number) => encodeBase58(new Uint8Array(32).fill(n)) as Address;
const signer = (n: number) => ({ address: key(n), signTransactions: async () => [] }) as never;
const OWNER = key(1);
const KEY = key(2);
const MARKET = key(3);
const engine = engineBlockOf({ address: MARKET, data: { series: key(4), book: key(5), ledger: key(6), mvault: key(7) } } as never, key(8));
const caps = { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 25_000_000n, maxOpenPositions: 4, maxPriceRaw: 950_000n };
const terms = { kind: "session" as const, actor: toAddress(KEY), caps, expiresAtSec: 1_788_486_400, budgetBase: 25_000_000n };

describe("vault instruction encoding", () => {
  it("the generated client's baked-in singletons are this program's PDAs", async () => {
    const program = { programAddress: AGARI_VAULT_PROGRAM_ADDRESS };
    expect((await findVaultConfigPda(program))[0]).toBe("FEhH7ACA3zhz2wsLxc4wRUCZg6mDCahtUNEzf1BRn9Sb");
    expect((await findSeatPda(program))[0]).toBe("H767WASSs2TXBBYwcVunaN2kfFbQ8CWTLWdZB9nP8k8");
  });

  it("a delegated tap carries the grant, YES-terms ticks, whole lots and the owner's account seeds", async () => {
    const ix = await placeIx({ kind: "vault-grant", actor: signer(2), owner: OWNER, grantId: 9n }, engine, { outcome: 1, isBuy: true, priceTicks: 350, lots: 2_000n, expireTs: 1_788_400_290 });
    const data = getActorPlaceForInstructionDataDecoder().decode(ix.data!);
    expect(data).toMatchObject({ grantId: 9n, outcome: 1, isBuy: true, priceTicks: 350, lots: 2_000n, expireTs: 1_788_400_290n });
    expect(ix.accounts![0]!.address).toBe(KEY);
    expect(ix.accounts![2]!.address).toBe(await grantAddress(9n));
    expect(ix.accounts![3]!.address).toBe(OWNER);
    expect(ix.accounts!.at(-2)!.address).toBe(await vaultEventAuthority());
  });

  it("price and size must sit on the grid, and a price cap converts to own-side ticks exactly", () => {
    expect(ticksOf(650_000n, 1_000n)).toBe(650);
    expect(() => ticksOf(650_500n, 1_000n)).toThrow(/whole number/);
    expect(() => ticksOf(0n, 1_000n)).toThrow(/outside/);
    expect(lotsOf(5_000_000n, 1_000n)).toBe(5_000n);
    expect(() => lotsOf(5_000_500n, 1_000n)).toThrow(/whole number/);
    expect(capsArgsOf({ caps }, 1_000n)).toEqual({ maxStakePerTrade: 5_000_000n, maxDailySpend: 25_000_000n, maxOpenPositions: 4, maxPriceTicks: 950 });
    expect(capsArgsOf({ caps: { ...caps, maxPriceRaw: 0n } }, 1_000n).maxPriceTicks).toBe(0);
    expect(() => capsArgsOf({ caps: { ...caps, maxPriceRaw: 950_001n } }, 1_000n)).toThrow(/whole number/);
  });

  it("enable is one deposit-and-grant carrying the previous grant only when one is active", async () => {
    const first = await depositAndGrantIx(signer(1), key(10), key(8), 25_000_000n, { grantId: 3n, terms, tickBase: 1_000n, previousGrantId: 0n });
    const decoded = getOwnerDepositAndGrantInstructionDataDecoder().decode(first.data!);
    expect(decoded).toMatchObject({ amount: 25_000_000n, grantId: 3n, kind: 0, actor: KEY, expiresAtSec: 1_788_486_400n, budget: 25_000_000n });
    const addresses = first.accounts!.map((a) => a.address);
    expect(addresses).toContain(await grantAddress(3n));
    expect(addresses).toContain(AGARI_VAULT_PROGRAM_ADDRESS); // the absent previous grant is the program id
    const rekey = await depositAndGrantIx(signer(1), key(10), key(8), 1n, { grantId: 4n, terms, tickBase: 1_000n, previousGrantId: 3n });
    expect(rekey.accounts!.map((a) => a.address)).toContain(await grantAddress(3n));
  });

  it("a crank passes a shared grant once as yes_grant, and a NO-only grant as no_grant", async () => {
    const block = { series: engine.series, market: engine.market, ledger: engine.ledger, mvault: engine.mvault, collateralMint: engine.collateralMint };
    const slots = async (yes: bigint, no: bigint) => (await crankIx(signer(9), OWNER, block, { yes, no })).accounts!.slice(5, 7).map((a) => a.address);
    expect(await slots(5n, 5n)).toEqual([await grantAddress(5n), AGARI_VAULT_PROGRAM_ADDRESS]);
    expect(await slots(0n, 6n)).toEqual([AGARI_VAULT_PROGRAM_ADDRESS, await grantAddress(6n)]);
    expect(await slots(5n, 6n)).toEqual([await grantAddress(5n), await grantAddress(6n)]);
    expect(await slots(0n, 0n)).toEqual([AGARI_VAULT_PROGRAM_ADDRESS, AGARI_VAULT_PROGRAM_ADDRESS]);
    expect(getPublicCrankSettleInstructionDataDecoder().decode((await crankIx(signer(9), OWNER, block, { yes: 0n, no: 0n })).data!)).toBeDefined();
  });
});

describe("vault account decoding", () => {
  it("maps slots, attribution and grant caps from the zero-copy bytes", () => {
    const empty = { market: key(0), yesLots: 0n, noLots: 0n, yesGrant: 0n, noGrant: 0n };
    const positions = Array.from({ length: 16 }, (_, i) => (i === 3 ? { market: MARKET, yesLots: 0n, noLots: 2_500n, yesGrant: 0n, noGrant: 9n } : empty));
    const bytes = getVaultAccountEncoder().encode({
      owner: OWNER, available: 12_000_000n, privateAvailable: 1n, totalDeposited: 40_000_000n, totalWithdrawn: 3n, activeGrants: [9n, 0n, 0n],
      custodyBump: 254, bump: 253, slotsUsed: 1, pad: new Uint8Array(4), reserved: new Uint8Array(32), positions,
    });
    expect(bytes.length).toBe(1_160);
    const account = getVaultAccountDecoder().decode(bytes);
    expect(sideOf(slotOf(account, MARKET), 1)).toEqual({ lots: 2_500n, grantId: 9n });
    expect(sideOf(slotOf(account, MARKET), 0)).toEqual({ lots: 0n, grantId: 0n });
    expect(slotOf(account, key(0))).toBeNull();

    const grant = getGrantDecoder().decode(getGrantEncoder().encode({
      owner: OWNER, actor: KEY, grantId: 9n, expiresAtSec: 1_788_486_400n, spentDay: 20_699n, spentToday: 4n, budget: 21_000_000n, maxStakePerTrade: 5_000_000n,
      maxDailySpend: 25_000_000n, maxOpenPositions: 4, openPositions: 1, maxPriceTicks: 950, kind: 0, revoked: 0, bump: 250, pad: new Uint8Array(3), reserved: new Uint8Array(32),
    }));
    expect(toVaultGrant(grant, 1_000n)).toMatchObject({ grantId: 9n, kind: "session", revoked: false, openPositions: 1, budgetBase: 21_000_000n, caps: { maxPriceRaw: 950_000n, maxOpenPositions: 4 } });
  });
});

describe("vault events", () => {
  const TAG = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d];
  const executed = (isBuy: boolean) =>
    getExecutedEventEncoder().encode({ owner: OWNER, market: MARKET, grantId: 9n, outcome: 1, isBuy, cashDelta: 1_300_000n, lotsDelta: 2_000n, actor: KEY, atSec: 1_788_400_100n, fills: 2 });
  const txWith = async (payload: ArrayLike<number>, authority?: string): Promise<JsonTransaction> => ({
    meta: { err: null, innerInstructions: [{ index: 1, instructions: [{ programIdIndex: 1, accounts: [2], data: getBase58Decoder().decode(Uint8Array.from([...TAG, ...Array.from(payload)])) }] }] },
    transaction: { signatures: ["sig"], message: { accountKeys: [KEY, AGARI_VAULT_PROGRAM_ADDRESS, authority ?? (await vaultEventAuthority())] } },
  });

  it("books a tap from its Executed: contracts, cost in own terms, fills; a sell books proceeds", async () => {
    const events = await decodeVaultEvents(await txWith(executed(true)));
    const txHash = toSignature(encodeBase58(new Uint8Array(64).fill(1)));
    const ctx = { owner: toAddress(OWNER), marketId: toMarketId(MARKET), side: "down" as const, grantId: 9n, isBuy: true, series: { lotBase: 1_000n, cashUnit: 1n }, txHash };
    expect(bookVaultEvents(events, ctx)).toEqual({ marketId: MARKET, side: "down", contractsRaw: 2_000_000n, costBase: 1_300_000n, avgPriceBps: 6_500, txHash, fillCount: 2 });
    expect(bookVaultEvents(events, { ...ctx, grantId: 8n })).toBeNull();
    const sold = await decodeVaultEvents(await txWith(executed(false)));
    expect(bookVaultEvents(sold, { ...ctx, isBuy: false })).toMatchObject({ costBase: 0n, proceedsBase: 1_300_000n, contractsRaw: 2_000_000n });
  });

  it("ignores a look-alike payload from another authority and every event of a failed transaction", async () => {
    expect(await decodeVaultEvents(await txWith(executed(true), key(42)))).toEqual([]);
    const failed = await txWith(executed(true));
    expect(await decodeVaultEvents({ ...failed, meta: { ...failed.meta!, err: { InstructionError: [1, { Custom: 7108 }] } } })).toEqual([]);
  });
});
