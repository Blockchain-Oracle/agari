// Shared setup for the S3 operator scripts (init-series, fund-roles, roller-plan): cluster endpoints, the addresses
// record and role keypairs. Server-only: the Helius key rides in the URL and is never printed (`redactKey`).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VenueRecord } from "@agari/markets/deploy";
import { ensureRole } from "./roles.mjs";

export type Cluster = "devnet" | "localnet";

export const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
export const flag = (name: string) => process.argv.includes(name);

export function clusterArg(): Cluster {
  const cluster = arg("--cluster", "devnet");
  if (cluster !== "devnet" && cluster !== "localnet") throw new Error(`--cluster must be devnet or localnet, got ${cluster}`);
  return cluster;
}

/** localnet → Surfpool on `SURFPOOL_PORT` (default 8899); devnet → Helius when `HELIUS_API_KEY` is set. */
export function endpoints(cluster: Cluster): { rpcUrl: string; rpcSubscriptionsUrl: string; label: string } {
  if (cluster === "localnet") {
    const [http, ws] = [process.env.SURFPOOL_PORT ?? "8899", process.env.SURFPOOL_WS_PORT ?? "8900"];
    return { rpcUrl: `http://127.0.0.1:${http}`, rpcSubscriptionsUrl: `ws://127.0.0.1:${ws}`, label: `surfpool 127.0.0.1:${http}` };
  }
  const key = process.env.HELIUS_API_KEY;
  if (!key) return { rpcUrl: "https://api.devnet.solana.com", rpcSubscriptionsUrl: "wss://api.devnet.solana.com", label: "api.devnet.solana.com" };
  return { rpcUrl: `https://devnet.helius-rpc.com/?api-key=${key}`, rpcSubscriptionsUrl: `wss://devnet.helius-rpc.com/?api-key=${key}`, label: "helius devnet" };
}

export const redactKey = (text: string) => (process.env.HELIUS_API_KEY ? text.replaceAll(process.env.HELIUS_API_KEY, "<HELIUS_API_KEY>") : text);

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
export const roleSecret = (role: string) => Uint8Array.from(readJson<number[]>(ensureRole(role).path));
export const rolePubkey = (role: string) => ensureRole(role).pubkey as string;

type AddressesFile = { cluster: string; programs: Record<string, unknown>; venue: VenueRecord };

/** The clusters an addresses record exists for: devnet (the venue), mainnet-beta (the desk, S21), localnet (a fork). */
export type AddressesCluster = Cluster | "mainnet-beta";

/**
 * The addresses record for a cluster. A localnet fork without its own record starts from a copy of devnet's, because
 * the fork reads devnet's config, Series and Books (D-027); it is written to the gitignored addresses.localnet.json.
 * Mainnet's record is `addresses.mainnet.json` (S21: the desk only); it never starts from devnet's. `path` overrides
 * where a localnet record is read and written (a mainnet fork's record lives outside the repo and is never committed).
 */
export function addressesFor(cluster: AddressesCluster, path?: string): { path: string; file: AddressesFile; save: () => void } {
  const devnetPath = join("scripts/deploy", "addresses.devnet.json");
  const filePath = path ?? join("scripts/deploy", cluster === "mainnet-beta" ? "addresses.mainnet.json" : `addresses.${cluster}.json`);
  let file: AddressesFile;
  try {
    file = readJson<AddressesFile>(filePath);
  } catch {
    if (cluster === "mainnet-beta") throw new Error(`${filePath} is missing: the mainnet record is checked in, never regenerated`);
    file = cluster === "localnet" && path ? { cluster, programs: {}, venue: {} } : { ...structuredClone(readJson<AddressesFile>(devnetPath)), cluster };
  }
  file.venue ??= {};
  return { path: filePath, file, save: () => writeFileSync(filePath, `${JSON.stringify(file, null, 2)}\n`) };
}

/** Lamports as an exact decimal SOL string. */
export function sol(lamports: bigint): string {
  const sign = lamports < 0n ? "-" : "";
  const abs = lamports < 0n ? -lamports : lamports;
  return `${sign}${abs / 1_000_000_000n}.${(abs % 1_000_000_000n).toString().padStart(9, "0")}`;
}

/** "2.5" → 2,500,000,000 lamports, exactly. */
export function solToLamports(text: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,9}))?$/.exec(text.trim());
  if (!m) throw new Error(`not a SOL amount: "${text}"`);
  return BigInt(m[1]!) * 1_000_000_000n + BigInt((m[2] ?? "").padEnd(9, "0"));
}
