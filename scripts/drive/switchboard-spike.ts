#!/usr/bin/env -S pnpm exec tsx
// S6 spike (a) (session-lanes.md §2.1, D-053): how many distinct oracles sign one Switchboard Surge quote over the four
// token-lane feeds on devnet, how fresh the signed slot is, and whether each value matches Jupiter's `usdPrice` basis.
// Read-only: quotes come from Crossbar and the gateway, slots from RPC; nothing is signed or sent.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/switchboard-spike.ts [--max 5] [--rounds 1] [--save <hex path>]

import { writeFileSync } from "node:fs";
import { fetchSurgeQuote, SWITCHBOARD_DEVNET_QUEUE, surgeFeedHashHex, type SwitchboardQuote } from "@agari/markets/prices/legacy";
import { arg, endpoints, readJson, redactKey } from "../deploy/ops-cluster";

process.on("uncaughtException", (e) => {
  console.error(redactKey(e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exit(1);
});

type TokenLane = { tickers: Record<string, { mint: string; surgeSymbol: string; feedHash: string | null }> };
const lane = readJson<{ tokenLane: TokenLane }>("services/ops/config/price-sources.json").tokenLane.tickers;
const xstocks = Object.keys(lane);
const symbols = xstocks.map((x) => lane[x]!.surgeSymbol);
const maxN = Number(arg("--max", "5"));
const rounds = Number(arg("--rounds", "1"));
const save = arg("--save", "");
const { rpcUrl, label } = endpoints("devnet");

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = (await res.json()) as { result?: T; error?: unknown };
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result as T;
}

/** `usdPrice` per UI token as an exact 10⁻¹⁸ integer, parsed from the JSON source text (no floats). */
async function jupiterE18(): Promise<Map<string, bigint>> {
  const mints = xstocks.map((x) => lane[x]!.mint);
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`);
  const text = await res.text();
  const out = new Map<string, bigint>();
  for (const [i, mint] of mints.entries()) {
    const m = new RegExp(`"${mint}"\\s*:\\s*\\{[^}]*"usdPrice"\\s*:\\s*([0-9.eE+-]+)`).exec(text);
    if (!m) continue;
    const [whole, frac = ""] = m[1]!.split(".");
    if (/e/i.test(m[1]!)) continue;
    out.set(xstocks[i]!, BigInt(whole!) * 10n ** 18n + BigInt(frac.slice(0, 18).padEnd(18, "0")));
  }
  return out;
}

const e18 = (v: bigint) => `${v / 10n ** 18n}.${(v % 10n ** 18n).toString().padStart(18, "0").slice(0, 6)}`;
const bps = (a: bigint, b: bigint) => Number(((a > b ? a - b : b - a) * 100_000n) / b) / 10;

console.log(`spike (a) · queue ${SWITCHBOARD_DEVNET_QUEUE} · rpc ${label} · ${new Date().toISOString()}`);
for (const [i, x] of xstocks.entries()) {
  const computed = surgeFeedHashHex(symbols[i]!);
  const pinned = lane[x]!.feedHash;
  console.log(`  ${x.padEnd(6)} ${symbols[i]!.padEnd(10)} feedHash ${computed}${pinned && pinned !== computed ? `  (PINNED ${pinned} differs)` : ""}`);
}

let best: SwitchboardQuote | null = null;
for (let round = 1; round <= rounds; round++) {
  let maxOk = 0;
  for (let n = 1; n <= maxN; n++) {
    const started = Date.now();
    try {
      const q = await fetchSurgeQuote({ rpcUrl, symbols, numSignatures: n });
      const ms = Date.now() - started;
      const slotNow = BigInt(await rpc<number>("getSlot", [{ commitment: "confirmed" }]));
      const distinct = new Set(q.oracleIdxs).size;
      maxOk = n;
      if (!best || distinct >= new Set(best.oracleIdxs).size) best = q;
      console.log(`round ${round} n=${n}: ok ${ms} ms · ${q.feeds.length} feeds · idx [${q.oracleIdxs.join(",")}] distinct ${distinct} · slot ${q.slot} (confirmed ${slotNow}, age ${slotNow - q.slot}) · ix data ${q.data.length} B`);
      const jup = await jupiterE18();
      for (const f of q.feeds) {
        const at = symbols.findIndex((s) => surgeFeedHashHex(s) === f.feedHashHex);
        const x = xstocks[at] ?? `?${f.feedHashHex.slice(0, 8)}`;
        const ref = jup.get(x);
        console.log(`    ${x.padEnd(6)} ${e18(f.value)} (min samples ${f.minOracleSamples})${ref ? ` · jupiter ${e18(ref)} · Δ ${bps(f.value, ref)} bps` : " · jupiter n/a"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`round ${round} n=${n}: FAILED after ${Date.now() - started} ms: ${redactKey(message).slice(0, 240)}`);
    }
  }
  console.log(`round ${round}: maximum n answered = ${maxOk}`);
}

if (save && best) {
  writeFileSync(save, `${Buffer.from(best.data).toString("hex")}\n`);
  console.log(`saved quote (slot ${best.slot}, idx [${best.oracleIdxs.join(",")}]) → ${save}`);
}
process.exit(0);
