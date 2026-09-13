#!/usr/bin/env node
// Archives signed Pyth updates for TSLA/QQQ/VOO at every 1-minute NYSE session boundary while the
// Pyth trial key works (it ends ≈ 2026-09-27). The saved base64 blobs stay verifiable on-chain after
// the trial (plan PD-1 proof replay, S2 fixtures).
//
// Run:  node --env-file-if-exists=.env.local scripts/archive/pyth-trial.mjs [--from 2026-09-11] [--until 2026-09-27] [--follow]
// Out:  data/archive/pyth/<session-date>.jsonl  (one line per boundary T, resumable)
// Keys: PYTH_API_KEY, ALPACA_KEY_ID, ALPACA_SECRET_KEY. Nothing secret is printed or saved.

import { boundaries, isoSec, jsonlStore, log, nyseSessions, politeGet, sleep, todayEt } from "./calendar.mjs";

const FEEDS = {
  TSLA: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  QQQ: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d",
  VOO: "236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179",
};
const HERMES = "https://hermes.pyth.network";
const STEP_SEC = 60;
const SETTLE_DELAY_SEC = 5; // ask for T only once publish_time ≥ T can exist
const SPACING_MS = 300;
const ACTOR = "pyth-archive";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const from = arg("from", "2026-09-11");
const until = arg("until", "2026-09-27");
const follow = process.argv.includes("--follow");

const key = process.env.PYTH_API_KEY;
if (!key) throw new Error("set PYTH_API_KEY (.env.local)");
const auth = { Authorization: `Bearer ${key}` };
const idQuery = Object.values(FEEDS).map((id) => `ids[]=${id}`).join("&");

/** One boundary: fetch, check the exact-T uniqueness rule per feed, save. Returns "auth" to stop. */
async function archive(store, T) {
  const url = `${HERMES}/v2/updates/price/${T}?${idQuery}&encoding=base64&parsed=true`;
  const { status, text } = await politeGet(url, auth);
  if (status === 401 || status === 403) return "auth";
  if (status !== 200) {
    log(ACTOR, "fetch failed; will retry next pass", { T: isoSec(T), status, body: text.slice(0, 120) });
    return "retry";
  }
  const body = JSON.parse(text);
  const checks = Object.fromEntries(
    (body.parsed ?? []).map((p) => {
      const symbol = Object.keys(FEEDS).find((s) => FEEDS[s] === p.id) ?? p.id;
      const prev = p.metadata?.prev_publish_time;
      const pub = p.price?.publish_time;
      return [symbol, { pub, prev, exactT: typeof prev === "number" && prev < T && T <= pub && pub <= T + 5 }];
    }),
  );
  store.add({ T, iso: isoSec(T), fetchedAtMs: Date.now(), checks, binary: body.binary, parsed: body.parsed });
  return "ok";
}

async function pass() {
  const endDate = todayEt() < until ? todayEt() : until;
  const sessions = await nyseSessions(from, endDate);
  const nowSec = Math.floor(Date.now() / 1000);
  let saved = 0;
  for (const session of sessions) {
    const store = jsonlStore(`data/archive/pyth/${session.date}.jsonl`);
    for (const T of boundaries(session, STEP_SEC)) {
      if (T > nowSec - SETTLE_DELAY_SEC || store.has(T)) continue;
      const outcome = await archive(store, T);
      if (outcome === "auth") return "auth";
      if (outcome === "ok") saved++;
      await sleep(SPACING_MS);
    }
  }
  log(ACTOR, "pass complete", { saved, sessions: sessions.length });
  return "ok";
}

let authFailures = 0;
for (;;) {
  const outcome = await pass();
  authFailures = outcome === "auth" ? authFailures + 1 : 0;
  if (authFailures >= 3) {
    log(ACTOR, "key rejected three passes in a row; the trial has probably ended, stopping");
    break;
  }
  if (!follow || todayEt() > until) break;
  const nextMinute = (Math.floor(Date.now() / 60_000) + 1) * 60_000;
  await sleep(nextMinute - Date.now() + SETTLE_DELAY_SEC * 1000);
}
