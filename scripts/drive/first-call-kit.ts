// Shared pieces of the first-call drive (scripts/drive/first-call.ts): the operator client and markets runtime on one
// endpoint, a chain-following clock, throwaway users, an on-disk journal, and RPC hooks at the order lane's race points.

import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  configureMarkets, createJournal, createSubmitterSession, keypairAddress, parseMarketsEnv, quoteFromBook, readBook, readSeat, readSeries,
  readTokenBalance, solana, type IntentStore, type JournalRecord, type WriteRpc,
} from "@agari/markets";
import { chainNowSec, createDeployClient, fundUser, keypairSigner, type SendContext, type StepLog, type VenueRecord } from "@agari/markets/deploy";
import { createOpsClient } from "@agari/markets/ops";
import { lamportsOf, transferSol } from "@agari/markets/ops/roller";
import type { EventMarket, PhaseListener, Quote, Side } from "@agari/core";
import { ensureRole } from "../deploy/roles.mjs";

/** `solSource` funds throwaway users: the `sol-faucet` role (the devnet default, because `requestAirdrop` is unreliable
 * there) or the cluster airdrop (Surfpool). */
export type DriveOptions = { cluster: "localnet" | "devnet"; rpcUrl: string; wsUrl: string; scratch: string; solSource?: "airdrop" | "sol-faucet" };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const secretOf = (role: string) => Uint8Array.from(readJson<number[]>(ensureRole(role).path));
const jsonSafe = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type User = { label: string; secret: Uint8Array; address: string; signer: Awaited<ReturnType<typeof keypairSigner>>; token: string };
export type Evidence = StepLog & { atSec: number; detail?: unknown };

/** Everything both flows share: the operator client, the markets runtime on the same endpoint, a chain clock, users. */
export async function openDrive({ cluster, rpcUrl, wsUrl, scratch, solSource }: DriveOptions) {
  configureMarkets(parseMarketsEnv({ cluster, rpcHttpUrls: rpcUrl, rpcWsUrls: wsUrl }));
  const evidence: Evidence[] = [];
  const log = (entry: StepLog & { detail?: unknown }) => {
    evidence.push({ ...entry, atSec: Math.floor(Date.now() / 1000) });
    console.log(`  ${entry.step.padEnd(22)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(22)} ${entry.signature}` : ""}`);
  };
  const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl: wsUrl, payerSecret: secretOf("deployer") });
  const ctx: SendContext = { client, log };
  const addresses = readJson<{ venue: VenueRecord }>("scripts/deploy/addresses.devnet.json");
  const config = await client.agariEvents.accounts.globalConfig.fetch(addresses.venue.config as never);
  let offsetMs = 0;
  const clock = {
    /** The session's clock follows the chain's (Surfpool's after time travel), as `syncClock` does for the web. */
    async sync() {
      offsetMs = (await chainNowSec(client)) * 1000 + 500 - Date.now();
    },
    nowMs: () => Date.now() + offsetMs,
  };
  await clock.sync();

  const fundSol = solSource ?? (cluster === "devnet" ? "sol-faucet" : "airdrop");
  let faucet: Awaited<ReturnType<typeof createOpsClient>> | null = null;

  async function newUser(label: string, lamports: bigint, tusdcBase: bigint): Promise<User> {
    const { privateKey } = generateKeyPairSync("ed25519");
    const jwk = privateKey.export({ format: "jwk" });
    const secret = Uint8Array.from([...Buffer.from(jwk.d!, "base64url"), ...Buffer.from(jwk.x!, "base64url")]);
    const signer = await keypairSigner(secret);
    if (fundSol === "sol-faucet") {
      // Devnet's public airdrop is unreliable, so lane 4c's `sol-faucet` role pays the user's fees, as preopen-devnet does.
      faucet ??= await createOpsClient({ rpcUrl, rpcSubscriptionsUrl: wsUrl, payerSecret: secretOf("sol-faucet") });
      const have = await lamportsOf(faucet, signer.address);
      if (have < lamports) log({ step: `fund SOL ${label}`, signature: await transferSol(faucet, signer.address, lamports - have), note: `${lamports - have} lamports sol-faucet → ${signer.address}` });
    } else {
      // Surfpool airdrops at once.
      await solana().rpc.requestAirdrop(signer.address, lamports as never).send();
      if (cluster === "devnet") await waitForLamports(signer.address, lamports);
    }
    const token = await fundUser(ctx, { faucet: await keypairSigner(secretOf("faucet-mint-authority")), mint: config.data.collateralMint, owner: signer.address, amount: tusdcBase });
    return { label, secret, address: keypairAddress(secret), signer, token };
  }

  return {
    cluster, rpcUrl, wsUrl, scratch, client, ctx, log, evidence, clock, newUser, secretOf, venue: addresses.venue,
    config: config.address, mint: config.data.collateralMint, clusterTag: config.data.clusterTag,
  };
}
export type Drive = Awaited<ReturnType<typeof openDrive>>;

async function waitForLamports(owner: string, lamports: bigint) {
  for (let i = 0; i < 30; i++) {
    if ((await solana().rpc.getBalance(owner as never).send()).value >= lamports) return;
    await sleep(2_000);
  }
  throw new Error(`${owner} did not receive ${lamports} lamports`);
}

/** A journal on disk, so a killed process's intents survive into the next run (the browser uses localStorage). */
export function fileJournal(path: string, nowMs: () => number) {
  const store: IntentStore = {
    load: () => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as JournalRecord[]) : []),
    save: (records) => writeFileSync(path, JSON.stringify(records, jsonSafe, 2)),
  };
  return createJournal(store, nowMs);
}

export type RpcHooks = { beforeSimulate?: () => Promise<void>; beforeFirstSend?: () => Promise<void>; skipFirstPreflight?: boolean; afterFirstSend?: () => void };

/** The session's RPC with test hooks at the lane's two race points, and a count of every broadcast it makes. */
export function hookedRpc(hooks: RpcHooks = {}) {
  const base = solana().rpc;
  const counts = { simulate: 0, send: 0 };
  const rpc = new Proxy(base, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as (...args: unknown[]) => { send: (c?: unknown) => Promise<unknown> };
      if (prop === "simulateTransaction") {
        return (...args: unknown[]) => ({
          send: async (c?: unknown) => {
            if (counts.simulate++ === 0) await hooks.beforeSimulate?.();
            return value.apply(target, args).send(c);
          },
        });
      }
      if (prop === "sendTransaction") {
        return (wire: unknown, config: Record<string, unknown> = {}) => ({
          send: async (c?: unknown) => {
            const first = counts.send++ === 0;
            if (first) await hooks.beforeFirstSend?.();
            const options = first && hooks.skipFirstPreflight ? { ...config, skipPreflight: true } : config;
            const result = await value.call(target, wire, options).send(c);
            if (first) hooks.afterFirstSend?.();
            return result;
          },
        });
      }
      return value;
    },
  }) as WriteRpc;
  return { rpc, counts };
}

export async function userSession(d: Drive, user: User, journalPath: string, rpc?: WriteRpc) {
  return createSubmitterSession({
    env: parseMarketsEnv({ cluster: d.cluster, rpcHttpUrls: d.rpcUrl, rpcWsUrls: d.wsUrl }),
    authority: "user-wallet",
    signer: { secretKey: user.secret },
    journal: fileJournal(journalPath, d.clock.nowMs),
    nowMs: d.clock.nowMs,
    ...(rpc ? { rpc } : {}),
  });
}

/** The ticket's displayed quote: the same kernel over the same chain Book the lane re-quotes with. */
export async function quoteNow(d: Drive, market: EventMarket, side: Side, stakeBase: bigint): Promise<Quote> {
  const [book, series] = await Promise.all([readBook(market.poolAddress), readSeries(market.seriesAddress)]);
  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const quote = book ? quoteFromBook(book, series, target, side, stakeBase, nowSec) : null;
  if (!quote) {
    const live = book ? book.bids.nodes.filter((n) => n.live).map((n) => `${n.lots}@exp${n.expireTs}`) : [];
    throw new Error(`no ${side} quote for ${stakeBase} on ${market.marketId} (now ${nowSec}, chain ${await chainNowSec(d.client)}, book slot ${book?.slot}, live nodes ${live})`);
  }
  return quote;
}

/** A wallet's seat on a Window's Ledger and its tUSDC balance. */
export async function holdings(ledger: string, mint: string, owner: string) {
  const [seat, token] = await Promise.all([readSeat(ledger as never, owner as never), readTokenBalance(owner as never, mint as never)]);
  return { seat: seat?.seat ?? null, tokenBase: token.amountBase ?? 0n };
}

/** Compute units and wire bytes of a landed transaction, for the evidence. */
export async function costOf(signature: string): Promise<{ computeUnits: number | null; bytes: number | null }> {
  const tx = await solana().rpc.getTransaction(signature as never, { encoding: "base64", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
  if (!tx) return { computeUnits: null, bytes: null };
  return { computeUnits: tx.meta?.computeUnitsConsumed === undefined ? null : Number(tx.meta.computeUnitsConsumed), bytes: Buffer.from(tx.transaction[0], "base64").length };
}

export const phases = (label: string): PhaseListener => (phase, detail) => console.log(`    ${label}: ${phase}${detail?.txHash ? ` ${detail.txHash}` : ""}`);

export function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`CHECK FAILED: ${message}`);
  console.log(`    ✓ ${message}`);
}

export function saveEvidence(d: Drive, extra: Record<string, unknown>) {
  const path = `scripts/drive/last-run.first-call-${d.cluster}.json`;
  writeFileSync(path, `${JSON.stringify({ cluster: d.cluster, ...extra, evidence: d.evidence }, jsonSafe, 2)}\n`);
  console.log(`evidence → ${path}`);
}

