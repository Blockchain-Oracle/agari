/**
 * The Pyth trial proof replay (proof-analytics.md §2.6): an archived signed update re-posted to the devnet receiver as
 * `proof-replay`, read back, checked in integers against the print that settled the Window, and stored so the proof
 * page keeps the decode after the accounts close. No Market is touched.
 */
import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { closePythUpdates, postPythUpdates, PYTH_RECEIVER_PROGRAM_ID, type PythPostResult } from "../prices/legacy";
import { keypairAddress } from "../sessions/keypair";
import { readPostedAccount, type PostedAccount } from "./chain";
import { printDiff } from "./decode";
import { parseArchivedUpdate, preflightRefusal, type ArchivedUpdate, type HermesFeed, type PreflightRefusal } from "./hermes";
import type { ProofStore, StoredPrint, VerifiedProofRow } from "./store";

export const PYTH_SOURCE = 1;
/** A `posting` claim older than this belongs to a run that died; the next caller may post again. */
export const POSTING_STALE_MS = 10 * 60_000;

export interface ReplayDeps {
  store: ProofStore;
  rpcUrl: string;
  payerSecret: Uint8Array;
  nowMs?: () => number;
}

export type ReplayRefusal =
  | { kind: "no-print" }
  | { kind: "not-pyth"; source: number }
  | { kind: "no-feed"; symbol: string | null }
  | { kind: "not-archived"; feed: string; boundarySec: number }
  | { kind: "preflight"; reason: PreflightRefusal };

export type ReplayOutcome =
  | { kind: "verified"; boundarySec: number; rows: VerifiedProofRow[] }
  | { kind: "refused"; refusal: ReplayRefusal }
  | { kind: "in-progress" | "already-verified"; boundarySec: number }
  | { kind: "failed"; boundarySec: number; error: string };

const bareHex = (id: string) => id.replace(/^0x/, "").toLowerCase();

/** The registry ticker whose Pyth feed this is; the trial update carries TSLA, QQQ and VOO. A pre-IPO name has no feed. */
export function symbolOfPythFeed(feedHex: string): TickerSymbol | null {
  const want = bareHex(feedHex);
  const hit = Object.values(TICKERS).find((t) => t.pythFeedId !== null && bareHex(t.pythFeedId) === want);
  return hit?.symbol ?? null;
}

export function pythFeedOf(symbol: string | null): string | null {
  if (!symbol || !(symbol in TICKERS)) return null;
  const id = TICKERS[symbol as TickerSymbol].pythFeedId;
  return id === null ? null : bareHex(id);
}

/** Provider URLs can carry keys: an error that reaches a row or a response keeps only its words. */
export function redactError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\b(?:https?|wss?):\/\/\S+/g, "<rpc>").slice(0, 400);
}

/**
 * Checks one posted account in integers (§2.6 step 5): the receiver owns it, Full, the feed and T match, and the price
 * equals the signed update Hermes parsed. `printE8` adds the exact match to the settled print for the print's own feed.
 */
export function accountRefusal(posted: PostedAccount | null, feed: HermesFeed, boundarySec: number, printE8: bigint | null): string | null {
  if (!posted) return "the price update account was not found after the post";
  const { owner, update } = posted;
  if (owner !== PYTH_RECEIVER_PROGRAM_ID) return `owner ${owner} is not the receiver`;
  if (update.verification.level !== "full") return "verification level is Partial";
  if (update.feedIdHex !== feed.feedIdHex) return `feed ${update.feedIdHex} does not match`;
  if (update.publishTimeSec !== boundarySec) return `publish_time ${update.publishTimeSec} is not T ${boundarySec}`;
  if (update.exponent !== feed.exponent || update.price !== feed.price) return `price ${update.price}e${update.exponent} differs from the signed update`;
  if (printE8 !== null && printDiff(update.price, update.exponent, printE8) !== 0n) return `price ${update.price}e${update.exponent} does not match the print ${printE8}e-8`;
  return null;
}

async function resolvePrint(store: ProofStore, market: string, which: number): Promise<{ print: StoredPrint; feed: string } | ReplayRefusal> {
  const print = await store.print(market, which);
  if (!print) return { kind: "no-print" };
  if (print.source !== PYTH_SOURCE) return { kind: "not-pyth", source: print.source };
  const feed = pythFeedOf(print.symbol);
  return feed ? { print, feed } : { kind: "no-feed", symbol: print.symbol };
}

/** A claimed replay: the print, its archived update and the feeds one post will create. */
export interface PreparedReplay {
  print: StoredPrint;
  feed: string;
  boundarySec: number;
  archived: ArchivedUpdate;
  feeds: Array<{ feed: string; symbol: string }>;
  payer: string;
}

/**
 * Everything short of sending (§2.6 steps 1–2): the print, its archived bytes, the integer preflight, then the claim.
 * Nothing is sent unless it returns `claimed`; a route awaits this and posts after answering.
 */
export async function prepareReplay(deps: ReplayDeps, input: { market: string; which: number }): Promise<{ kind: "claimed"; prepared: PreparedReplay } | Exclude<ReplayOutcome, { kind: "verified" | "failed" }>> {
  const now = deps.nowMs ?? Date.now;
  const resolved = await resolvePrint(deps.store, input.market, input.which);
  if ("kind" in resolved) return { kind: "refused", refusal: resolved };
  const { print, feed } = resolved;
  const boundarySec = print.sourceTsSec;
  const payload = await deps.store.archivedPyth(feed, boundarySec);
  if (!payload) return { kind: "refused", refusal: { kind: "not-archived", feed, boundarySec } };
  const archived = parseArchivedUpdate(payload);
  const refusal = preflightRefusal(archived, feed, boundarySec, BigInt(print.price));
  if (refusal) return { kind: "refused", refusal: { kind: "preflight", reason: refusal } };

  const payer = keypairAddress(deps.payerSecret);
  const feeds = archived.feeds.map((f) => ({ feed: f.feedIdHex, symbol: symbolOfPythFeed(f.feedIdHex) ?? f.feedIdHex.slice(0, 8) }));
  const claim = await deps.store.claim({ boundarySec, feeds, payer, nowMs: now(), staleMs: POSTING_STALE_MS });
  if (!claim.claimed) return { kind: claim.state === "verified" ? "already-verified" : "in-progress", boundarySec };
  return { kind: "claimed", prepared: { print, feed, boundarySec, archived, feeds, payer } };
}

/** Steps 3–6 for a claimed replay: post, read back, verify in integers, store; a failure is stored and its accounts closed. */
export async function postPreparedReplay(deps: ReplayDeps, prepared: PreparedReplay): Promise<Extract<ReplayOutcome, { kind: "verified" | "failed" }>> {
  const now = deps.nowMs ?? Date.now;
  const { print, feed, boundarySec, archived, feeds, payer } = prepared;
  let posted: PythPostResult | null = null;
  try {
    posted = await postPythUpdates({ rpcUrl: deps.rpcUrl, payerSecret: deps.payerSecret, updatesBase64: [archived.updatesBase64[0]!] });
    const rows: VerifiedProofRow[] = [];
    for (const account of posted.priceUpdates) {
      const hermes = archived.feeds.find((f) => f.feedIdHex === account.feedIdHex);
      if (!hermes) throw new Error(`the receiver posted feed ${account.feedIdHex}, which the archived answer does not parse`);
      const read = await readPostedAccount(deps.rpcUrl, account.address);
      const why = accountRefusal(read, hermes, boundarySec, account.feedIdHex === feed ? BigInt(print.price) : null);
      if (why || !read) throw new Error(`${account.address}: ${why}`);
      const u = read.update;
      rows.push({
        feed: account.feedIdHex,
        boundarySec,
        receiver: read.owner,
        priceUpdate: account.address,
        verification: u.verification.level,
        price: u.price.toString(),
        conf: u.conf.toString(),
        expo: u.exponent,
        publishTimeSec: u.publishTimeSec,
        prevPublishTimeSec: u.prevPublishTimeSec,
        postedSlot: u.postedSlot.toString(),
        postSignatures: posted.signatures,
        payer,
        postedAtMs: now(),
      });
    }
    if (!rows.some((r) => r.feed === feed)) throw new Error(`the post did not create the ${print.symbol} price update`);
    await deps.store.verified(rows);
    return { kind: "verified", boundarySec, rows };
  } catch (error) {
    const message = redactError(error);
    // A post that landed but did not prove the print gives its rent back now; a post that died midway leaves accounts
    // no row names, which `closeProofAccounts` sweeps by write authority.
    const addresses = posted?.priceUpdates.map((u) => u.address) ?? [];
    await closePythUpdates({ rpcUrl: deps.rpcUrl, payerSecret: deps.payerSecret, addresses }).catch(() => undefined);
    await deps.store.failed(feeds.map((f) => f.feed), boundarySec, message);
    return { kind: "failed", boundarySec, error: message };
  }
}

/** Re-verifies one recorded Pyth print on chain. Idempotent per boundary: a live claim or a verified proof returns as is. */
export async function replayPythProof(deps: ReplayDeps, input: { market: string; which: number }): Promise<ReplayOutcome> {
  const step = await prepareReplay(deps, input);
  return step.kind === "claimed" ? postPreparedReplay(deps, step.prepared) : step;
}
