/**
 * Surfpool-only helpers for the fork rehearsal (plan §8 C6 A): the `surfnet_*` cheatcodes over plain JSON-RPC (a
 * mainnet node answers none of them), an airdrop that waits for the balance, the fork's clock, prewarming a Jupiter
 * route's accounts and lookup tables so the fork holds one consistent copy before the swap (accounts are fetched
 * lazily from the datasource on first touch), and a token balance read. Never imported by the runner.
 */
import type { Signature } from "@agari/core/types";
import type { Address, Lamports, Rpc, SolanaRpcApi } from "@solana/kit";
import { fetchLookupTables } from "./lookup-tables";
import type { JupiterRoute } from "./jupiter-swap";

const CHUNK = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One raw JSON-RPC call; the cheatcodes are not in Kit's API surface. */
export async function surfnetCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { code: number; message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message} (${body.error.code})`);
  return body.result as T;
}

/** `requestAirdrop`, then waits until the balance reflects it (Surfpool credits within a slot or two). */
export async function forkAirdrop(rpc: Rpc<SolanaRpcApi>, address: Address, lamports: bigint): Promise<Signature> {
  const before = (await rpc.getBalance(address, { commitment: "confirmed" }).send()).value;
  const signature = await rpc.requestAirdrop(address, lamports as Lamports, { commitment: "confirmed" }).send();
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const now = (await rpc.getBalance(address, { commitment: "confirmed" }).send()).value;
    if (now >= before + lamports) return signature as string as Signature;
  }
  throw new Error(`airdrop of ${lamports} lamports to ${address} did not arrive`);
}

/** `surfnet_setTokenAccount`: the owner's associated token account of `mint` holds `amount` (created if missing). */
export async function forkSetTokenAccount(rpcUrl: string, i: { owner: Address; mint: Address; amount: bigint; tokenProgram: Address }): Promise<void> {
  await surfnetCall(rpcUrl, "surfnet_setTokenAccount", [i.owner, i.mint, { amount: Number(i.amount) }, i.tokenProgram]);
}

/** `surfnet_timeTravel` to `toSec` (the cheatcode takes milliseconds; the clock sysvar reports seconds). Only forward. */
export async function forkTimeTravel(rpcUrl: string, toSec: number): Promise<{ absoluteSlot: number; epoch: number }> {
  return surfnetCall(rpcUrl, "surfnet_timeTravel", [{ absoluteTimestamp: toSec * 1000 }]);
}

/** The fork's clock: the block time of the latest confirmed slot. */
export async function forkClockSec(rpc: Rpc<SolanaRpcApi>): Promise<number> {
  const slot = await rpc.getSlot({ commitment: "confirmed" }).send();
  return Number(await rpc.getBlockTime(slot).send());
}

export interface Prewarmed {
  /** The route's own accounts and lookup tables touched. */
  accounts: number;
  tables: number;
  /** Addresses inside the tables touched. */
  entries: number;
  /** Route accounts the fork could not serve (a datasource miss); non-zero means the swap will fail on the fork. */
  missing: number;
}

/**
 * Touches every account a route names, its lookup tables and every address inside them, in batches of 100.
 * `mayBeMissing` names accounts that do not exist yet by design (the desk PDA and its ATAs before the desk opens).
 */
export async function prewarmRoute(rpc: Rpc<SolanaRpcApi>, route: JupiterRoute, mayBeMissing: readonly Address[] = []): Promise<Prewarmed> {
  const own = [...new Set([...route.route.map((a) => a.address), ...route.lookupTables])];
  const allowed = new Set<string>(mayBeMissing);
  let missing = 0;
  for (let at = 0; at < own.length; at += CHUNK) {
    const slice = own.slice(at, at + CHUNK);
    const { value } = await rpc.getMultipleAccounts(slice, { encoding: "base64", commitment: "confirmed" }).send();
    missing += value.filter((a, i) => a === null && !allowed.has(slice[i] as string)).length;
  }
  const tables = await fetchLookupTables(rpc, route.lookupTables);
  const entries = [...new Set(Object.values(tables).flat())];
  for (let at = 0; at < entries.length; at += CHUNK) await rpc.getMultipleAccounts(entries.slice(at, at + CHUNK), { encoding: "base64", commitment: "confirmed" }).send();
  return { accounts: own.length, tables: Object.keys(tables).length, entries: entries.length, missing };
}

/**
 * `surfnet_resetAccount` on every non-executable account a route names except `keep` (the desk's own), so the fork
 * fetches the pools afresh at the next touch. A route prewarmed minutes ago is a stale pool for a fast name: Jupiter
 * quotes the live pool, the fork would fill against the old one, and the swap refuses on slippage (seen with OPENAI
 * on the C6 rehearsal: Jupiter 6001). Returns how many accounts were reset.
 */
export async function refreshRoute(rpc: Rpc<SolanaRpcApi>, rpcUrl: string, route: JupiterRoute, keep: readonly Address[] = []): Promise<number> {
  const kept = new Set<string>(keep);
  const addresses = [...new Set(route.route.map((a) => a.address))].filter((a) => !kept.has(a));
  let reset = 0;
  for (let at = 0; at < addresses.length; at += CHUNK) {
    const slice = addresses.slice(at, at + CHUNK);
    const { value } = await rpc.getMultipleAccounts(slice, { encoding: "base64", commitment: "confirmed" }).send();
    for (let i = 0; i < slice.length; i++) {
      const account = value[i];
      if (!account || account.executable) continue;
      await surfnetCall(rpcUrl, "surfnet_resetAccount", [slice[i], { includeOwnedAccounts: false }]);
      reset += 1;
    }
  }
  return reset;
}

/** The raw amount in a token account, or null when it does not exist. */
export async function tokenBalance(rpc: Rpc<SolanaRpcApi>, tokenAccount: Address): Promise<bigint | null> {
  try {
    const { value } = await rpc.getTokenAccountBalance(tokenAccount, { commitment: "confirmed" }).send();
    return BigInt(value.amount);
  } catch {
    return null;
  }
}
