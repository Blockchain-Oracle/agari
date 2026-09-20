#!/usr/bin/env -S pnpm exec tsx
// L-56 drive: prove the Memory Market's gate against a running web server and the live chain.
//   seal as the strategy's creator → the catalogue lists a title and a length, never the body → the subscriber reads it →
//   a wallet with no subscription is refused 402 with the fee → the creator reads it → a wrong signer is refused 401 →
//   somebody who is not the creator cannot seal (403).
// Run: pnpm exec tsx scripts/drive/memory-market.ts --strategy 2 --creator strategy-creator-6mYp6H --subscriber strategy-subscriber-6h6qH3 [--base http://localhost:3100]
// Keys are role files under ~/.config/agari/devnet. Nothing here touches the chain: both flows sign a text, not a transaction.

import { createPrivateKey, sign as edSign } from "node:crypto";
import { readMemoryMessage, sealMemoryMessage } from "@agari/core/strategies";
import { readJson } from "../deploy/ops-cluster";
import { ensureRole } from "../deploy/roles.mjs";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg("--base", "http://localhost:3100")!;
const strategyId = arg("--strategy", "2")!;

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes: Uint8Array): string {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = `1${out}`; }
  return out;
}

/** A role's address and an ed25519 signer over UTF-8 text, from its Solana keypair file (32-byte seed + 32-byte public key). */
function signerOf(role: string) {
  const bytes = Uint8Array.from(readJson<number[]>(ensureRole(role).path));
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(bytes.slice(0, 32))]);
  const key = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  return { address: base58(bytes.slice(32)), sign: (text: string) => base58(edSign(null, Buffer.from(text, "utf8"), key)) };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

const creator = signerOf(arg("--creator", "strategy-creator-6mYp6H")!);
const subscriber = signerOf(arg("--subscriber", "strategy-subscriber-6h6qH3")!);
const stranger = signerOf("drive-owner");
const title = "What First move has learned";
const body = ["1. The first 90 seconds after a print are noise; the rule waits them out.", "2. A 1 bp threshold trades often and small. The cap per trade is the whole risk control.", "3. On a one-sided book it sits out: a fill there is a donation."].join("\n");

let failures = 0;
const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${detail}`);
};
const read = (who: ReturnType<typeof signerOf>, signWith = who) => {
  const issuedAtMs = Date.now();
  return post("/api/strategies/memory/read", { strategyId, reader: who.address, issuedAtMs, signature: signWith.sign(readMemoryMessage(strategyId, who.address, issuedAtMs)) });
};

console.log(`memory market drive on ${base}, strategy #${strategyId}; creator ${creator.address}, subscriber ${subscriber.address}, stranger ${stranger.address}`);

let issuedAtMs = Date.now();
const forged = await post("/api/strategies/memory", { strategyId, creator: stranger.address, issuedAtMs, title, body, signature: stranger.sign(sealMemoryMessage(strategyId, stranger.address, issuedAtMs, title, body)) });
check("a wallet that is not the creator cannot seal", forged.status === 403, `${forged.status} ${JSON.stringify(forged.json)}`);

issuedAtMs = Date.now();
const sealed = await post("/api/strategies/memory", { strategyId, creator: creator.address, issuedAtMs, title, body, signature: creator.sign(sealMemoryMessage(strategyId, creator.address, issuedAtMs, title, body)) });
check("the creator seals", sealed.status === 200, `${sealed.status} ${JSON.stringify(sealed.json)}`);

const catalogue = (await (await fetch(`${base}/api/strategies`)).json()) as { value?: { strategies: Array<{ strategyId: string; memory: unknown }> }; strategies?: Array<{ strategyId: string; memory: unknown }> };
const card = (catalogue.value?.strategies ?? catalogue.strategies ?? []).find((s) => s.strategyId === strategyId);
const listed = JSON.stringify(card?.memory ?? null);
check("the catalogue lists a title and a length, never the body", Boolean(card?.memory) && !JSON.stringify(catalogue).includes("a fill there is a donation"), listed);

const bySubscriber = await read(subscriber);
check("the subscriber reads it", bySubscriber.status === 200 && bySubscriber.json?.body === body, `${bySubscriber.status}, ${String(bySubscriber.json?.body ?? "").length} chars, title "${String(bySubscriber.json?.title)}"`);

const byStranger = await read(stranger);
check("a wallet with no subscription is refused, with the fee", byStranger.status === 402 && !("body" in (byStranger.json ?? {})), `${byStranger.status} ${JSON.stringify(byStranger.json)}`);

const byCreator = await read(creator);
check("the creator reads their own", byCreator.status === 200, `${byCreator.status}`);

const impersonated = await read(subscriber, stranger);
check("the subscriber's address with another wallet's signature is refused", impersonated.status === 401, `${impersonated.status} ${JSON.stringify(impersonated.json)}`);

console.log(failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
