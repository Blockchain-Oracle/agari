/**
 * Switchboard Surge oracle quotes (session-lanes.md §2.1, §2.4; prints.md §4.4): `@switchboard-xyz/on-demand` 3.10.6 on
 * web3.js 1, like the Pyth lane. Callers pass and get strings, bytes and bigints; nothing here signs or sends.
 *
 * A token-lane feed is one `switchboardSurgeTask { source: WEIGHTED, symbol }` job. Its feed hash is sha256 of the
 * length-delimited `OracleFeed` protobuf (`FeedHash.computeOracleFeedId`), so the definition below is frozen: any change
 * to a field (name, samples, range) is a new hash, a new policy version and a new Series version.
 *
 * One quote carries up to 8 feeds signed over `signed_slothash ‖ (feed_hash ‖ value i128 LE ‖ min_samples)*` by
 * `numSignatures` oracles. The ed25519 instruction uses the position-independent 0xFFFF instruction index (the program
 * accepts 0xFFFF or `cur − 1`), so it must sit immediately before `public_record_print_switchboard`.
 */
import { CrossbarClient, CrossbarNetwork, FeedHash, OracleJob, type IOracleFeed } from "@switchboard-xyz/common";
import { AnchorUtils, Queue } from "@switchboard-xyz/on-demand";
import { Connection, PublicKey } from "@solana/web3.js";
import { floorDecimalE8 } from "../jupiter";

/** Switchboard's default devnet queue (9 oracles; C:13 §2.1). Pinned on chain as `config.switchboard_queue`. */
export const SWITCHBOARD_DEVNET_QUEUE = "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7";
export const SWITCHBOARD_CROSSBAR_URL = "https://crossbar.switchboard.xyz";
export const SWITCHBOARD_MAX_FEEDS_PER_QUOTE = 8;
/** Value scale of a Switchboard feed result (`i128`, 10⁻¹⁸). */
export const SWITCHBOARD_VALUE_EXPO = -18;

/** The frozen token-lane feed for a Surge symbol (`TSLAX/USD`). Oracle counts are enforced on chain, not in the feed. */
export function surgeFeed(symbol: string): IOracleFeed {
  return {
    name: `agari-surge-${symbol}`,
    jobs: [{ tasks: [{ switchboardSurgeTask: { source: OracleJob.SwitchboardSurgeTask.Source.WEIGHTED, symbol } }] }],
    minJobResponses: 1,
    minOracleSamples: 1,
    maxJobRangePct: 0,
  };
}

/** Lower-case hex without `0x`, as `price-sources.json` `tokenLane.<xStock>.feedHash` pins it. */
export const surgeFeedHashHex = (symbol: string) => FeedHash.computeOracleFeedId(surgeFeed(symbol)).toString("hex");

/**
 * The token-lane feed's value now, unsigned, from the crossbar's simulator: the same job the Window's print signs, so
 * it is the live price to show beside a 24/7 Window (Jupiter's last swap sits 10–60 bps away). Display only; × 10⁸
 * floored. Throws when the crossbar answers an error or no result.
 */
export async function simulateSurgeE8(symbol: string, crossbarUrl = SWITCHBOARD_CROSSBAR_URL): Promise<bigint> {
  const sim = await crossbarFor(crossbarUrl).simulateFeed(surgeFeed(symbol));
  if (sim.error) throw new Error(`crossbar ${symbol}: ${sim.error}`);
  const value = sim.results?.[0];
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`crossbar ${symbol}: no result`);
  return floorDecimalE8(String(value));
}

export interface QuoteFeed {
  feedHashHex: string;
  /** × 10⁻¹⁸. */
  value: bigint;
  minOracleSamples: number;
}

export interface SwitchboardQuote {
  /** The ed25519 precompile instruction data, sent unchanged. */
  data: Uint8Array;
  programId: string;
  /** The slot whose hash the oracles signed. */
  slot: bigint;
  /** In signature order; the program refuses a repeated index. */
  oracleIdxs: number[];
  /** Base58 ed25519 signer keys, in signature order. */
  signers: string[];
  feeds: QuoteFeed[];
}

const ED25519_OFFSETS_BYTES = 14;
const FEED_INFO_BYTES = 49;

const le16 = (d: Uint8Array, at: number) => d[at]! | (d[at + 1]! << 8);

function leBig(d: Uint8Array, at: number, bytes: number, signed: boolean): bigint {
  let v = 0n;
  for (let i = bytes - 1; i >= 0; i--) v = (v << 8n) | BigInt(d[at + i]!);
  const bits = BigInt(bytes * 8);
  return signed && v >> (bits - 1n) === 1n ? v - (1n << bits) : v;
}

const toHex = (d: Uint8Array) => Buffer.from(d).toString("hex");

/**
 * Decodes quote instruction data: `count ‖ pad ‖ offsets×count ‖ sig×count ‖ pubkey×count ‖ message ‖ oracle_idx×count ‖ slot u64 ‖
 * version u8 ‖ "SBOD"`. Throws on anything out of bounds; the program re-checks every field it relies on.
 */
export function decodeSwitchboardQuote(data: Uint8Array, programId = "Ed25519SigVerify111111111111111111111111111"): SwitchboardQuote {
  const count = data[0] ?? 0;
  if (count === 0 || data.length < 2 + count * ED25519_OFFSETS_BYTES) throw new Error("quote: bad signature count");
  const signers: string[] = [];
  const base = 2;
  const msgOffset = le16(data, base + 8);
  const msgSize = le16(data, base + 10);
  for (let i = 0; i < count; i++) {
    const keyOffset = le16(data, base + i * ED25519_OFFSETS_BYTES + 4);
    signers.push(new PublicKey(data.subarray(keyOffset, keyOffset + 32)).toBase58());
  }
  const tail = msgOffset + msgSize;
  if (msgSize < 32 || (msgSize - 32) % FEED_INFO_BYTES !== 0 || data.length < tail + count + 9) throw new Error("quote: bad message bounds");
  const feeds: QuoteFeed[] = [];
  for (let at = msgOffset + 32; at < tail; at += FEED_INFO_BYTES) {
    feeds.push({ feedHashHex: toHex(data.subarray(at, at + 32)), value: leBig(data, at + 32, 16, true), minOracleSamples: data[at + 48]! });
  }
  const oracleIdxs = Array.from(data.subarray(tail, tail + count));
  return { data, programId, slot: leBig(data, tail + count, 8, false), oracleIdxs, signers, feeds };
}

/**
 * Keeps the first `keep` signatures (the SDK sorts them by oracle index) and re-encodes the instruction data the SDK
 * way, index fields 0xFFFF. Every signature covers the same message, so a subset still verifies; it only shortens the
 * transaction (each signature is 111 B: offsets, signature, key, index).
 */
export function trimSwitchboardQuote(quote: SwitchboardQuote, keep: number): SwitchboardQuote {
  const d = quote.data;
  const count = d[0]!;
  if (keep >= count) return quote;
  if (keep < 1) throw new Error("quote: keep at least one signature");
  const msgOffset = le16(d, 2 + 8);
  const msgSize = le16(d, 2 + 10);
  const tail = msgOffset + msgSize;
  const sigsAt = 2 + keep * ED25519_OFFSETS_BYTES;
  const keysAt = sigsAt + 64 * keep;
  const messageAt = keysAt + 32 * keep;
  const out = new Uint8Array(messageAt + msgSize + keep + 13);
  out[0] = keep;
  const put16 = (at: number, v: number) => ((out[at] = v & 0xff), (out[at + 1] = v >> 8));
  for (let i = 0; i < keep; i++) {
    const r = 2 + i * ED25519_OFFSETS_BYTES;
    [sigsAt + 64 * i, 0xffff, keysAt + 32 * i, 0xffff, messageAt, msgSize, 0xffff].forEach((v, k) => put16(r + 2 * k, v));
    const sigOffset = le16(d, r);
    const keyOffset = le16(d, r + 4);
    out.set(d.subarray(sigOffset, sigOffset + 64), sigsAt + 64 * i);
    out.set(d.subarray(keyOffset, keyOffset + 32), keysAt + 32 * i);
  }
  out.set(d.subarray(msgOffset, tail), messageAt);
  out.set(d.subarray(tail, tail + keep), messageAt + msgSize);
  out.set(d.subarray(tail + count), messageAt + msgSize + keep);
  return decodeSwitchboardQuote(out, quote.programId);
}

export type SurgeQuoteConfig = {
  /** Only used once per process to load the Switchboard program for the queue. May carry a provider key: never log it. */
  rpcUrl: string;
  symbols: readonly string[];
  numSignatures: number;
  queue?: string;
  crossbarUrl?: string;
  network?: "devnet" | "mainnet";
};

const queues = new Map<string, Promise<Queue>>();

function queueFor(rpcUrl: string, queue: string, network: "devnet" | "mainnet"): Promise<Queue> {
  const key = `${network}:${queue}`;
  let q = queues.get(key);
  if (!q) {
    q = AnchorUtils.loadProgramFromConnection(new Connection(rpcUrl, "confirmed")).then((program) => {
      const loaded = new Queue(program, new PublicKey(queue));
      loaded.setNetwork(network === "mainnet" ? CrossbarNetwork.SolanaMainnet : CrossbarNetwork.SolanaDevnet);
      return loaded;
    });
    q.catch(() => queues.delete(key));
    queues.set(key, q);
  }
  return q;
}

const crossbars = new Map<string, CrossbarClient>();
function crossbarFor(url: string): CrossbarClient {
  let c = crossbars.get(url);
  if (!c) crossbars.set(url, (c = new CrossbarClient(url)));
  return c;
}

/** One live quote over every symbol (≤ 8), `numSignatures` oracles. The gateway answers HTTP 500 above what it can sign. */
export async function fetchSurgeQuote(config: SurgeQuoteConfig): Promise<SwitchboardQuote> {
  if (config.symbols.length === 0 || config.symbols.length > SWITCHBOARD_MAX_FEEDS_PER_QUOTE) throw new Error(`quote: 1..8 feeds, got ${config.symbols.length}`);
  const queue = await queueFor(config.rpcUrl, config.queue ?? SWITCHBOARD_DEVNET_QUEUE, config.network ?? "devnet");
  const ix = await queue.fetchQuoteIx(crossbarFor(config.crossbarUrl ?? SWITCHBOARD_CROSSBAR_URL), config.symbols.map(surgeFeed), {
    numSignatures: config.numSignatures,
    variableOverrides: {},
  });
  return decodeSwitchboardQuote(new Uint8Array(ix.data), ix.programId.toBase58());
}
