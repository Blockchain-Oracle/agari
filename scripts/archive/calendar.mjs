// Shared helpers for the S0 price archivers: NYSE sessions from Alpaca, ET wall time to UTC,
// JSONL files that can be resumed, and a polite fetch with retries.
// Needs ALPACA_KEY_ID / ALPACA_SECRET_KEY (server-side only; never printed).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const ET = "America/New_York";

/** Minutes east of UTC for New York at `ms` (e.g. -240 in summer). */
function etOffsetMinutes(ms) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: ET, timeZoneName: "shortOffset" })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 0;
  const hours = Number(m[1]);
  return hours * 60 + Math.sign(hours) * Number(m[2] ?? 0);
}

/** "2026-09-14" + "09:30" in New York → unix seconds. */
export function etWallToUtcSec(date, hhmm) {
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, hh, mm);
  const offset = etOffsetMinutes(wallAsUtc - 4 * 3_600_000);
  return Math.floor((wallAsUtc - offset * 60_000) / 1000);
}

export const isoSec = (sec) => new Date(sec * 1000).toISOString();

export function log(actor, why, extra = {}) {
  console.log(JSON.stringify({ tsMs: Date.now(), actor, why, ...extra }));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** NYSE sessions between two dates (inclusive) with UTC open/close seconds. */
export async function nyseSessions(from, to) {
  const { ALPACA_KEY_ID, ALPACA_SECRET_KEY } = process.env;
  if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) throw new Error("set ALPACA_KEY_ID and ALPACA_SECRET_KEY (.env.local)");
  const url = `https://paper-api.alpaca.markets/v2/calendar?start=${from}&end=${to}`;
  const res = await fetch(url, {
    headers: { "APCA-API-KEY-ID": ALPACA_KEY_ID, "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Alpaca calendar HTTP ${res.status}`);
  const days = await res.json();
  return days.map((d) => ({
    date: d.date,
    openSec: etWallToUtcSec(d.date, d.open),
    closeSec: etWallToUtcSec(d.date, d.close),
  }));
}

/** Boundaries every `stepSec` from open to close inclusive. */
export function boundaries(session, stepSec) {
  const out = [];
  for (let t = session.openSec; t <= session.closeSec; t += stepSec) out.push(t);
  return out;
}

export const todayEt = () => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(new Date());

/** Append-only JSONL keyed by boundary `T` (seconds), so reruns skip what is already saved. */
export function jsonlStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const done = new Set();
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        done.add(JSON.parse(line).T);
      } catch {
        // a torn last line from a crash is ignored and refetched
      }
    }
  }
  return {
    has: (T) => done.has(T),
    add(record) {
      appendFileSync(path, `${JSON.stringify(record)}\n`);
      done.add(record.T);
    },
    size: () => done.size,
  };
}

/**
 * GET with a timeout, backing off on 429/5xx and network errors. Returns
 * `{ status, text }`; auth failures are returned so callers can stop.
 */
export async function politeGet(url, headers = {}, { tries = 4, timeoutMs = 20_000 } = {}) {
  let last = { status: 0, text: "" };
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      last = { status: res.status, text: await res.text() };
      if (res.status !== 429 && res.status < 500) return last;
    } catch (err) {
      last = { status: 0, text: String(err?.message ?? err) };
    }
    await sleep(2_000 * 2 ** i);
  }
  return last;
}
