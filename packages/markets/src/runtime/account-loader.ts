/**
 * Account reads, batched. Every `loadAccount` made in the same turn of the event loop with the same data slice joins one
 * `getMultipleAccounts` (≤ 100 addresses), and an address asked for twice is fetched once. A Window snapshot (Market,
 * Series, GlobalConfig), a balance sheet (ATA + Ledgers) or several surfaces mounting together cost one request.
 */
import { getBase64Encoder, type Address, type Base64EncodedDataResponse } from "@solana/kit";
import { solana } from "./solana";

const MULTIPLE_ACCOUNTS_MAX = 100;

export interface DataSlice {
  offset: number;
  length: number;
}

/** `bytes` null = the account does not exist. `slot` is the context slot of the batch that read it. */
export interface LoadedAccount {
  bytes: Uint8Array | null;
  lamports: bigint;
  slot: bigint;
}

interface Waiter {
  resolve: (account: LoadedAccount) => void;
  reject: (error: unknown) => void;
}

interface Batch {
  slice: DataSlice | undefined;
  waiters: Map<Address, Waiter[]>;
}

const batches = new Map<string, Batch>();
let scheduled = false;

const sliceKey = (slice: DataSlice | undefined) => (slice ? `${slice.offset}:${slice.length}` : "full");

async function fetchChunk(addresses: readonly Address[], slice: DataSlice | undefined): Promise<LoadedAccount[]> {
  const { context, value } = await solana()
    .rpc.getMultipleAccounts(addresses, {
      encoding: "base64",
      commitment: "confirmed",
      ...(slice ? { dataSlice: slice } : {}),
    })
    .send();
  const encoder = getBase64Encoder();
  return value.map((account) => ({
    bytes: account ? (encoder.encode((account.data as Base64EncodedDataResponse)[0]) as Uint8Array) : null,
    lamports: account ? BigInt(account.lamports) : 0n,
    slot: context.slot,
  }));
}

function settle(batch: Batch): void {
  const addresses = [...batch.waiters.keys()];
  for (let i = 0; i < addresses.length; i += MULTIPLE_ACCOUNTS_MAX) {
    const chunk = addresses.slice(i, i + MULTIPLE_ACCOUNTS_MAX);
    fetchChunk(chunk, batch.slice).then(
      (accounts) => chunk.forEach((address, k) => batch.waiters.get(address)?.forEach((w) => w.resolve(accounts[k]!))),
      (error) => chunk.forEach((address) => batch.waiters.get(address)?.forEach((w) => w.reject(error))),
    );
  }
}

function flush(): void {
  scheduled = false;
  const pending = [...batches.values()];
  batches.clear();
  for (const batch of pending) settle(batch);
}

/** One account's base64 data (optionally a slice of it) at `confirmed`, batched with every other read this turn. */
export function loadAccount(address: Address, slice?: DataSlice): Promise<LoadedAccount> {
  return new Promise((resolve, reject) => {
    const key = sliceKey(slice);
    let batch = batches.get(key);
    if (!batch) batches.set(key, (batch = { slice, waiters: new Map() }));
    const waiters = batch.waiters.get(address) ?? [];
    waiters.push({ resolve, reject });
    batch.waiters.set(address, waiters);
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, 0);
  });
}

export function loadAccounts(addresses: readonly Address[], slice?: DataSlice): Promise<LoadedAccount[]> {
  return Promise.all(addresses.map((address) => loadAccount(address, slice)));
}
