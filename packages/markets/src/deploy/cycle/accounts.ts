/** Window addresses, the clock, hand-decoded Ledger seats and policy-version selection for the drive. */
import { AGARI_EVENTS_PROGRAM_ADDRESS, findLedgerPda, findMvaultPda, type Series } from "@agari/clients/agari-events";
import { address, getAddressDecoder, getAddressEncoder, getProgramDerivedAddress, getU64Encoder, type Address } from "@solana/kit";
import type { DeployClient } from "../client";

export type WindowAddresses = { series: Address; index: bigint; market: Address; ledger: Address; mvault: Address };

export async function eventAuthority(): Promise<Address> {
  const [authority] = await getProgramDerivedAddress({ programAddress: AGARI_EVENTS_PROGRAM_ADDRESS, seeds: ["__event_authority"] });
  return authority;
}

/** Market `["market", series, index u64 LE]`, Ledger `["ledger", market]`, mvault `["mvault", market]`. */
export async function windowAddresses(series: Address, index: bigint): Promise<WindowAddresses> {
  const [market] = await getProgramDerivedAddress({
    programAddress: AGARI_EVENTS_PROGRAM_ADDRESS,
    seeds: ["market", getAddressEncoder().encode(series), getU64Encoder().encode(index)],
  });
  const [[ledger], [mvault]] = await Promise.all([findLedgerPda({ market }), findMvaultPda({ market })]);
  return { series, index, market, ledger, mvault };
}

const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");

/** The cluster clock (Surfpool's after time travel), not the wall clock: `Clock.unix_timestamp` at byte 32. */
export async function chainNowSec(client: DeployClient): Promise<number> {
  const info = await client.rpc.getAccountInfo(CLOCK_SYSVAR, { encoding: "base64" }).send();
  if (!info.value) throw new Error("clock sysvar not found");
  return Number(new DataView(base64Bytes(info.value.data[0]).buffer).getBigInt64(32, true));
}

const base64Bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const I64_MAX = 9_223_372_036_854_775_807n;

/** prints.md §2.3: the highest version covering both boundaries, or null (the Window isn't listed). */
export function coveringVersion(series: Series, startSec: number, expirySec: number): number | null {
  for (let i = series.versionCount - 1; i >= 0; i--) {
    const v = series.policyVersions[i]!;
    const until = v.validUntilTs === I64_MAX ? Number.MAX_SAFE_INTEGER : Number(v.validUntilTs);
    if (Number(v.validFromTs) <= startSec && expirySec <= until) return i;
  }
  return null;
}

export type Seat = {
  index: number;
  owner: Address;
  credit: bigint;
  lockedCash: bigint;
  yesFree: bigint;
  yesLocked: bigint;
  noFree: bigint;
  noLocked: bigint;
  openOrders: number;
  flags: number;
};

const LEDGER_HEADER = 8 + 96;
const SEAT_BYTES = 88;

/** Seats past the IDL's fixed header (events-accounts.md §3.8), decoded by hand; only owned seats are returned. */
export async function readSeats(client: DeployClient, ledger: Address): Promise<Seat[]> {
  const info = await client.rpc.getAccountInfo(ledger, { encoding: "base64" }).send();
  if (!info.value) throw new Error(`ledger ${ledger} not found`);
  const data = base64Bytes(info.value.data[0]);
  const view = new DataView(data.buffer);
  const capacity = view.getUint16(8 + 72, true);
  const decodeAddress = getAddressDecoder();
  const seats: Seat[] = [];
  for (let i = 0; i < capacity; i++) {
    const at = LEDGER_HEADER + i * SEAT_BYTES;
    const ownerBytes = data.subarray(at, at + 32);
    if (ownerBytes.every((b) => b === 0)) continue;
    const u64 = (off: number) => view.getBigUint64(at + off, true);
    seats.push({
      index: i,
      owner: decodeAddress.decode(ownerBytes),
      credit: u64(32),
      lockedCash: u64(40),
      yesFree: u64(48),
      yesLocked: u64(56),
      noFree: u64(64),
      noLocked: u64(72),
      openOrders: view.getUint16(at + 80, true),
      flags: data[at + 82]!,
    });
  }
  return seats;
}
