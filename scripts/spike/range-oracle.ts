import { toMarketId } from "@masayume/core/types";
import { closeRuntime, configureMarkets, loadCollateral, marketsProvider, parseMarketsEnv, resolveVenueId, unwrap } from "@masayume/markets";
import { getClient } from "@masayume/markets/runtime";
import type { PublicClient } from "viem";

import {
  BINARY_MODULE,
  ORACLE_HUB,
  PENDING_SELECTOR,
  binaryMarketAbi,
  binaryModuleAbi,
  oracleHubAbi,
  printToUsd,
  questionLink,
  revertDataOf,
  windowQuestion,
} from "./lib/oracle-hub";

/**
 * The OracleHub as RangeReserve's price basis, against Shannon itself (context/43). Read-only: settled
 * questions answer in cents from the hub and agree with the indexer; a Trading Window's question is
 * pending under one selector, its definition rebuilds to the hub's own key at zero scheduling cost;
 * then the run waits for the Window to settle and reads the closing print the moment it lands.
 *
 * Env: RPC_HTTP_URLS / RPC_WS_URLS (default Shannon), FORK_MARKET_ID (decimal, pins the Window; else
 * the soonest hub-backed Trading Window with 90 s left), WAIT=0 skips the settlement wait,
 * SETTLED_SAMPLES (default 3).
 */
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const WAIT = process.env.WAIT !== "0";
const SAMPLES = Number(process.env.SETTLED_SAMPLES ?? "3");
const POLL_MS = 5_000;
const SETTLE_GRACE_SEC = 15 * 60;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const env = parseMarketsEnv({
  rpcHttpUrls: process.env.RPC_HTTP_URLS,
  rpcWsUrls: process.env.RPC_WS_URLS,
  venueId: process.env.VENUE_ID,
});
configureMarkets(env);

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

const hub = { address: ORACLE_HUB, abi: oracleHubAbi } as const;

async function indexerAnswers(limit: number) {
  const query = `{ OracleAnswer(limit: ${limit}, order_by: {resolvedAt: desc}) { id numericValue voided resolvedAt oracleQuestionId } }`;
  const response = await fetch(env.indexerUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
  const body = (await response.json()) as { data?: { OracleAnswer: { id: string; numericValue: string | null; voided: boolean; resolvedAt: string }[] }; errors?: unknown };
  if (!body.data) throw new Error(`indexer: ${json(body.errors)}`);
  return body.data.OracleAnswer;
}

async function pullPrint(questionId: bigint): Promise<{ value: bigint; voided: boolean } | { pending: string }> {
  try {
    const [value, voided] = await viem().readContract({ ...hub, functionName: "pullNumericAnswer", args: [questionId] });
    return { value, voided };
  } catch (error) {
    const data = revertDataOf(error);
    if (data && data.toLowerCase().startsWith(PENDING_SELECTOR)) return { pending: data };
    throw error;
  }
}

async function pickWindow() {
  const pinned = process.env.FORK_MARKET_ID;
  const venue = unwrap(await resolveVenueId(env.venueId));
  if (!venue.venueId) throw new Error("no venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.venueId));
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const markets = lanes.lanes.flatMap((lane) => lane.markets);
  if (pinned) {
    const id = toMarketId(`0x${BigInt(pinned).toString(16).padStart(64, "0")}`);
    const row = markets.find((m) => m.marketId === id);
    if (!row) throw new Error(`FORK_MARKET_ID ${pinned} is not on a live lane`);
    return row;
  }
  const soonest = markets
    .filter((m) => m.status === "Trading" && m.expirySec - nowSec >= 90 && m.oracleQuestionId !== null && BigInt(m.oracleQuestionId) < 1n << 64n)
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!soonest) throw new Error("no hub-backed Trading Window with 90 s left");
  return soonest;
}

try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const client = viem();

  const [maxBinds, resolveReserve] = await Promise.all([
    client.readContract({ ...hub, functionName: "MAX_BINDS_PER_QUESTION" }),
    client.readContract({ ...hub, functionName: "resolveReserve" }),
  ]);
  console.log("hub", json({ address: ORACLE_HUB, maxBindsPerQuestion: maxBinds, resolveReserveWei: resolveReserve }));

  // 1. Settled questions: the hub's answer, in cents, against what the indexer recorded for the same question.
  const samples = await indexerAnswers(SAMPLES);
  for (const sample of samples) {
    const read = await pullPrint(BigInt(sample.id));
    if ("pending" in read) throw new Error(`question ${sample.id} is settled on the indexer but pending on the hub`);
    const agrees = sample.numericValue !== null && BigInt(sample.numericValue) === read.value && sample.voided === read.voided;
    console.log("settled", json({ question: sample.id, hubCents: read.value, hubUsd: printToUsd(read.value), voided: read.voided, indexer: sample.numericValue, resolvedAt: sample.resolvedAt, agrees }));
    if (!agrees) throw new Error(`hub and indexer disagree on question ${sample.id}`);
  }

  // 2. A Trading Window: the module's row names the question, the hub is its adapter, the answer is pending.
  const row = await pickWindow();
  const idBytes = row.marketId as `0x${string}`;
  const onchain = await client.readContract({ address: BINARY_MODULE, abi: binaryModuleAbi, functionName: "markets", args: [idBytes] });
  const [questionId, , , , , , oracleAdapter, , marketAddress, , , , , expiry] = onchain;
  console.log("window", json({ marketId: BigInt(idBytes), asset: row.asset, intervalSec: row.intervalSec, expirySec: row.expirySec, status: row.status, indexerQuestion: row.oracleQuestionId, moduleQuestion: questionId, oracleAdapter, marketAddress }));
  if (oracleAdapter.toLowerCase() !== ORACLE_HUB.toLowerCase()) throw new Error("this Window's adapter is not the OracleHub - a reserve must refuse it");
  if (row.oracleQuestionId !== null && BigInt(row.oracleQuestionId) !== questionId) throw new Error("indexer and module disagree on the question id");
  if (Number(expiry) !== row.expirySec) throw new Error("indexer and module disagree on the expiry");

  const before = await pullPrint(questionId);
  console.log("before settlement", json(before));
  if (!("pending" in before)) throw new Error("a Trading Window's question already answers - the basis is not what was assumed");

  // 3. The Window's own definition, rebuilt: the hub's key maps to the same question and prices a re-schedule at zero.
  const def = windowQuestion(row.asset, row.expirySec);
  const [key, cost] = await Promise.all([
    client.readContract({ ...hub, functionName: "questionKeyOf", args: [def] }),
    client.readContract({ ...hub, functionName: "getSchedulingCost", args: [def] }),
  ]);
  const byKey = await client.readContract({ ...hub, functionName: "questionIdByKey", args: [key] });
  const binds = await client.readContract({ ...hub, functionName: "bindCount", args: [questionId] });
  console.log("definition", json({ key, questionByKey: byKey, matchesWindow: byKey === questionId, schedulingCostWei: cost, bindCount: binds, link: questionLink(questionId) }));
  if (byKey !== questionId) throw new Error("the rebuilt definition does not map to the Window's question - the venue's template moved");
  if (cost !== 0n) throw new Error(`the hub prices the Window's own definition at ${cost} wei, not zero`);

  // 4. Wait for the Window to settle, then read the print the moment the hub has it.
  if (WAIT) {
    const deadline = row.expirySec + SETTLE_GRACE_SEC;
    const market = { address: marketAddress, abi: binaryMarketAbi } as const;
    let settled = false;
    while (Math.floor(Date.now() / 1000) < deadline) {
      const [resolved, voided] = await Promise.all([
        client.readContract({ ...market, functionName: "isResolved" }),
        client.readContract({ ...market, functionName: "isVoided" }),
      ]);
      const left = row.expirySec - Math.floor(Date.now() / 1000);
      if (resolved || voided) {
        settled = true;
        console.log("window settled", json({ resolved, voided, secondsAfterExpiry: -left }));
        break;
      }
      if (left % 60 < POLL_MS / 1000) console.log(`waiting: ${left} s to expiry`);
      await sleep(POLL_MS);
    }
    if (!settled) throw new Error("the Window did not settle inside the grace period");
    let after = await pullPrint(questionId);
    for (let tries = 0; "pending" in after && tries < 24; tries++) {
      await sleep(POLL_MS);
      after = await pullPrint(questionId);
    }
    if ("pending" in after) throw new Error("the Window settled but the hub still reports the question pending");
    console.log("after settlement", json({ hubCents: after.value, hubUsd: printToUsd(after.value), voided: after.voided }));

    let closing: string | null = null;
    for (let tries = 0; closing === null && tries < 12; tries++) {
      const resolution = await getClient().getMarketResolution(row.marketId);
      closing = resolution.closingAnswer?.numericValue ?? null;
      if (closing === null) await sleep(POLL_MS);
    }
    console.log("indexer closing answer", json({ numericValue: closing, agrees: closing !== null && BigInt(closing) === after.value }));
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeRuntime();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
}
