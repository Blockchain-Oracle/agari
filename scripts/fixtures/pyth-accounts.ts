#!/usr/bin/env -S pnpm exec tsx
// Writes real Pyth `PriceUpdateV2` account fixtures (anchor/tests/vectors/prints/README.md) by the D-021 method: post an
// archived Hermes trial update through the default receiver (rec5EK…) on a Surfpool devnet fork, so Wormhole verifies
// every guardian signature, then read each stored account back.
//   pyth-<sym>-<T>.account.b64   the 134 B account the receiver stored (Full verification), one per feed in the update
// Run (localnet only; never devnet): SURFPOOL_PORT=9061 pnpm exec tsx scripts/fixtures/pyth-accounts.ts <archive.jsonl> <T> [--force]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { postPythUpdates, PYTH_RECEIVER_PROGRAM_ID } from "@agari/markets/prices/legacy";
import { endpoints, flag, readJson, roleSecret } from "../deploy/ops-cluster";

const [archivePath, tArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!archivePath || !tArg) throw new Error("usage: pyth-accounts.ts <archive.jsonl> <T> [--force]");
const tSec = Number(tArg);
const OUT = "anchor/tests/vectors/prints";

type ArchiveLine = { T: number; binary: { data: string[] }; parsed: Array<{ id: string; price: { price: string; conf: string; expo: number; publish_time: number }; metadata?: { prev_publish_time?: number } }> };
const line = readFileSync(archivePath, "utf8").split("\n").find((l) => l.startsWith(`{"T":${tSec},`));
if (!line) throw new Error(`no archived Pyth boundary at T = ${tSec}`);
const archived = JSON.parse(line) as ArchiveLine;

const sources = readJson<{ tickers: Record<string, { pythFeedId?: string }> }>("services/ops/config/price-sources.json");
const symbolOf = new Map(Object.entries(sources.tickers).flatMap(([symbol, t]) => (t.pythFeedId ? [[t.pythFeedId.toLowerCase(), symbol] as const] : [])));

const { rpcUrl, label } = endpoints("localnet");
console.log(`posting the archived update at ${new Date(tSec * 1000).toISOString()} on ${label}`);
const posted = await postPythUpdates({ rpcUrl, payerSecret: roleSecret("price-relay"), updatesBase64: archived.binary.data });

for (const { feedIdHex, address } of posted.priceUpdates) {
  const symbol = symbolOf.get(feedIdHex);
  if (!symbol) throw new Error(`feed ${feedIdHex} is not in price-sources.json`);
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [address, { encoding: "base64", commitment: "confirmed" }] }),
  });
  const { result } = (await res.json()) as { result: { value: { owner: string; data: [string, string] } | null } };
  if (!result.value) throw new Error(`${symbol}: update account ${address} not found`);
  const bytes = Buffer.from(result.value.data[0], "base64");
  if (result.value.owner !== PYTH_RECEIVER_PROGRAM_ID || bytes.length !== 134) throw new Error(`${symbol}: owner ${result.value.owner}, ${bytes.length} B`);
  // PriceUpdateV2: discriminator 8, write authority 32, verification level (Full = 1) 1, then the price message.
  if (bytes[40] !== 1 || bytes.subarray(41, 73).toString("hex") !== feedIdHex) throw new Error(`${symbol}: not a Full update for its feed`);
  const parsed = archived.parsed.find((p) => p.id.toLowerCase() === feedIdHex)!;
  const price = bytes.readBigInt64LE(73);
  const publishTime = Number(bytes.readBigInt64LE(93));
  if (String(price) !== parsed.price.price || publishTime !== parsed.price.publish_time) throw new Error(`${symbol}: stored ${price}@${publishTime} ≠ Hermes ${parsed.price.price}@${parsed.price.publish_time}`);
  const path = `${OUT}/pyth-${symbol.toLowerCase()}-${tSec}.account.b64`;
  if (existsSync(path) && !flag("--force")) {
    console.log(`  ${symbol.padEnd(5)} ${path} exists (kept; --force rewrites)`);
    continue;
  }
  writeFileSync(path, `${bytes.toString("base64")}\n`);
  console.log(`  ${symbol.padEnd(5)} ${price}e${parsed.price.expo} conf ${parsed.price.conf} publish ${publishTime} → ${path}`);
}
console.log(`posted in ${posted.signatures.length} transaction(s): ${posted.signatures.join(", ")}`);
process.exit(0);
