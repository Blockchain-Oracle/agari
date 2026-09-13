#!/usr/bin/env node
// Archives RedStone signed data packages for Agari's single-name tickers at every 5-minute NYSE session
// boundary, plus a 10-second grid around each 09:30 open (the S6 open-print spike). The public gateway
// keeps only ≈ 24 h of history, so this must keep running until the S3 price-relay takes over.
//
// Run:  node --env-file-if-exists=.env.local scripts/archive/redstone.mjs [--follow]
// Out:  data/archive/redstone/<session-date>.jsonl  (one line per boundary T, resumable)
// Keys: ALPACA_KEY_ID, ALPACA_SECRET_KEY (calendar only). RedStone needs no key.

import { boundaries, isoSec, jsonlStore, log, nyseSessions, politeGet, runLoop, sleep, todayEt } from "./calendar.mjs";

const GATEWAY = "https://oracle-gateway-2.a.redstone.finance";
const SERVICE = "redstone-primary-prod";
const NAMES = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL"];
const FEEDS = NAMES.flatMap((n) => [n, `${n}---EXTENDED`]);
const STEP_SEC = 300;
const FETCH_DELAY_SEC = 15;
const RETENTION_SEC = 23 * 3600; // stay inside the gateway's ≈ 24 h history
const ACTOR = "redstone-archive";
const follow = process.argv.includes("--follow");

/** 10-second grid 09:29:00–09:31:00 ET for the Monday-open feed-semantics spike (S6 b). */
function openGrid(session) {
  const out = [];
  for (let t = session.openSec - 60; t <= session.openSec + 60; t += 10) out.push(t);
  return out;
}

function pick(all, T) {
  const feeds = {};
  const summary = {};
  for (const id of FEEDS) {
    const packages = (all[id] ?? []).filter((p) => p.timestampMilliseconds === T * 1000);
    feeds[id] = packages;
    summary[id] = {
      signers: new Set(packages.map((p) => p.signerAddress)).size,
      values: packages.map((p) => p.dataPoints?.[0]?.value),
    };
  }
  return { feeds, summary };
}

async function archive(store, T) {
  const { status, text } = await politeGet(`${GATEWAY}/data-packages/historical/${SERVICE}/${T * 1000}`);
  let all;
  try {
    all = JSON.parse(text);
  } catch {
    all = undefined;
  }
  if (status !== 200 || !all || typeof all !== "object" || !all.TSLA) {
    log(ACTOR, "no packages yet for T; will retry", { T: isoSec(T), status, bytes: text.length });
    return false;
  }
  const { feeds, summary } = pick(all, T);
  const complete = NAMES.every((n) => summary[n].signers >= 3);
  store.add({ T, iso: isoSec(T), fetchedAtMs: Date.now(), gateway: GATEWAY, complete, summary, feeds });
  if (!complete) log(ACTOR, "saved with fewer than 3 signers on a primary feed", { T: isoSec(T) });
  return true;
}

async function pass() {
  const nowSec = Math.floor(Date.now() / 1000);
  const earliest = new Date((nowSec - RETENTION_SEC) * 1000).toISOString().slice(0, 10);
  const sessions = await nyseSessions(earliest, todayEt());
  let saved = 0;
  for (const session of sessions) {
    const store = jsonlStore(`data/archive/redstone/${session.date}.jsonl`);
    const times = [...new Set([...openGrid(session), ...boundaries(session, STEP_SEC)])].sort((a, b) => a - b);
    for (const T of times) {
      if (T > nowSec - FETCH_DELAY_SEC || T < nowSec - RETENTION_SEC || store.has(T)) continue;
      if (await archive(store, T)) saved++;
      await sleep(500);
    }
  }
  log(ACTOR, "pass complete", { saved, sessions: sessions.length });
}

await runLoop(ACTOR, pass, {
  follow,
  nextDelayMs: () => Math.max((Math.floor(Date.now() / 10_000) + 1) * 10_000 - Date.now(), 0) + FETCH_DELAY_SEC * 1000,
});
