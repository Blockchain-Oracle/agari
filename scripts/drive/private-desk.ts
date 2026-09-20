#!/usr/bin/env -S pnpm exec tsx
// S10d drive: prove the private desk end to end on devnet, through the REAL desk service the web runs.
//   desk                                   the desk's books, and whether custody equals owed + pool + in slots
//   deposit  --amount 10 --allow 10        the owner tops up and lets the desk spend up to the allowance
//   open     --window <w> --side up --amount 2 [--floor 9500]   the owner signs the bet; the desk charges, funds and mints; the claim is verified and saved
//            [--issued <ms>]               repeat an earlier authorisation exactly, to prove the desk resumes and never charges twice
//            [--impossible]                a guard no book can meet, to prove the refund path: charge, fund, refused mint, sweep, credit
//   cashout  --ticket <file>               the way home: settle, sweep, credit, from the claim alone
//   revoke                                 the desk may spend nothing
//   withdraw --amount 5                    pays the owner and nobody else
//   rawcharge --owner <addr> --amount 1 --as <role>   a bare desk_charge_to_pool signed by <role>, past the service's checks: the chain's own answer
// `--as <role>` picks the owner wallet (default drive-owner). The desk key is the `private-desk` role.
// A Window is a market id, or `<ticker>/<cadenceSec>/<basis>` for the Window that lane is trading now.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/private-desk.ts <mode> [...]

import { createPrivateKey, sign as edSign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { formatCadence } from "@agari/core/copy";
import { privateOpenMessage, type PrivateTicket } from "@agari/core/private";
import { formatBaseUnits } from "@agari/core/units";
import { ensureMarkets, getCollateral, loadCollateral, marketsProvider, parseMarketsEnv, unwrap } from "@agari/markets";
import { createDeployClient, depositAndAllowPrivate, liveWindowFor, rawChargeAsPayer, readPrivateBudget, readPrivateDesk, revokePrivate, withdrawPrivate, type StepLog } from "@agari/markets/deploy";
import { cashOutPrivateBet, createDeskClient, openPrivateBet, sizePrivateForStake, verifyPrivateClaim } from "@agari/markets/private";
import { addressesFor, clusterArg, endpoints, readJson, redactKey, roleSecret } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "desk";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));
const show = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes: Uint8Array): string {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = `1${out}`; }
  return out;
}
/** ed25519 over UTF-8 text with a role's keypair file, as a wallet's signMessage would. */
function signText(secret: Uint8Array, text: string): string {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret.slice(0, 32))]);
  return base58(edSign(null, Buffer.from(text, "utf8"), createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })));
}

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const ownerSecret = roleSecret(arg("--as") ?? "drive-owner");
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: ownerSecret });
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}${e.signature ? `\n  ${"".padEnd(14)} ${e.signature}` : ""}`);
const ctx = { client, log };
const owner = client.payer.address as string;
console.log(`private drive "${mode}" on ${cluster} (${label}), owner ${owner}`);

const books = (d: Awaited<ReturnType<typeof readPrivateDesk>>) =>
  `custody ${d.custodyBase} = owed ${d.data.owedBase} + pool ${d.data.poolBase} + in slots ${d.data.inSlotsBase} → ${d.balanced ? "BALANCED" : `OFF BY ${d.custodyBase - d.booksBase}`}`;

/** The markets runtime, booted as a server process boots it: the desk service reads the chain through it. */
async function bootDesk() {
  const { file } = addressesFor(cluster);
  ensureMarkets(parseMarketsEnv({ cluster, rpcHttpUrls: rpcUrl, rpcWsUrls: rpcSubscriptionsUrl, venueId: file.venue.config, indexerUrl: process.env.DRIVE_INDEXER_URL ?? "http://localhost:3100/api/index" }));
  unwrap(await loadCollateral());
  return createDeskClient({ secretKey: roleSecret("private-desk"), rpcUrl, rpcSubscriptionsUrl });
}

try {
  if (mode === "desk") {
    const d = await readPrivateDesk(ctx);
    console.log(`desk ${d.desk}, custody ${d.custody}, desk key ${d.data.desk}, paused ${d.data.paused}, params ${show(d.data.params)}`);
    console.log(books(d));
    console.log(`owner budget ${show(await readPrivateBudget(ctx, client.payer.address))}`);
  } else if (mode === "deposit") {
    const r = await depositAndAllowPrivate(ctx, units(arg("--amount"), "10"), units(arg("--allow"), arg("--amount") ?? "10"));
    console.log(`budget ${show(r.budget)}; ${books(await readPrivateDesk(ctx))}; ${r.signature}`);
  } else if (mode === "revoke") {
    const r = await revokePrivate(ctx);
    console.log(`budget ${show(r.budget)}; ${r.signature}`);
  } else if (mode === "withdraw") {
    const r = await withdrawPrivate(ctx, units(arg("--amount"), "1"));
    console.log(`received ${r.receivedBase}; budget ${show(r.budget)}; ${books(await readPrivateDesk(ctx))}; ${r.signature}`);
  } else if (mode === "rawcharge") {
    const target = arg("--owner");
    if (!target) throw new Error("--owner is required");
    try {
      console.log(`LANDED: ${await rawChargeAsPayer(ctx, target as never, units(arg("--amount"), "1"))}`);
    } catch (error) {
      const text = redactKey(error instanceof Error ? error.message : String(error));
      console.log(`REFUSED BY THE CHAIN: ${/Error Code: \w+\. Error Number: \d+\. Error Message: [^\n]*/.exec(text)?.[0] ?? text.split("\n")[0]}`);
    }
    console.log(`target budget ${show(await readPrivateBudget(ctx, target as never))}; ${books(await readPrivateDesk(ctx))}`);
  } else if (mode === "open") {
    const where = arg("--window");
    const side = arg("--side") === "down" ? "down" : "up";
    if (!where) throw new Error("--window is required: a market id, or <ticker>/<cadenceSec>/<basis>");
    const lane = where.split("/");
    const marketId = (lane.length === 3 ? (await liveWindowFor(ctx, Number(lane[0]), Number(lane[1]), Number(lane[2]))).marketId : where) as never;
    const desk = await bootDesk();
    const contract = await desk.contract();
    if (!contract) throw new Error("no desk account on this cluster");
    // A listed Window is read as the route reads it. A drive-only Window (Series 903, D-115) is not in the catalogue by
    // design, so its facts come from the chain and the drive names the asset and cadence it opened it with.
    const listed = unwrap(await marketsProvider.getMarket(marketId));
    const onchain = unwrap(await marketsProvider.getOnchain(marketId));
    const market = listed ?? { marketId: onchain.marketId, asset: arg("--asset") ?? "TSLA", intervalSec: Number(arg("--cadence") ?? "900"), expirySec: onchain.expirySec };
    const stakeBase = units(arg("--amount"), "2");
    const quote = await sizePrivateForStake(marketId, side, stakeBase);
    console.log(`quote: ${show(quote.ok ? quote.value : quote.error)}`);
    const collateral = getCollateral();
    // `--issued` repeats an earlier authorisation exactly: ed25519 is deterministic, so the same text is the same signature,
    // the same three keys, and the desk resumes that bet instead of opening another.
    const issuedAtMs = Number(arg("--issued") ?? Date.now());
    // The exact text a wallet would show and sign, rebuilt here from the chain's own Window as the route rebuilds it.
    const message = privateOpenMessage({
      owner, contract, chainId: desk.chainId, marketId: market.marketId, asset: market.asset, cadenceText: formatCadence(market.intervalSec), expirySec: market.expirySec, side,
      stakeText: formatBaseUnits(stakeBase, collateral.decimals, { maxDp: collateral.decimals, minDp: 0, group: false }), symbol: collateral.symbol, issuedAtMs,
    });
    const authSignature = signText(ownerSecret, message) as never;
    console.log(`authorisation issued ${issuedAtMs}`);
    const minQuantityRaw = quote.ok ? (quote.value.quantityRaw * BigInt(arg("--floor") ?? "9500")) / 10_000n : 0n;
    const before = await readPrivateDesk(ctx);
    const result = await openPrivateBet(desk, { owner: owner as never, marketId: market.marketId, side, stakeBase, minQuantityRaw: flag("--impossible") ? 10n ** 15n : minQuantityRaw, authSignature, issuedAtMs, asset: market.asset, intervalSec: market.intervalSec, expirySec: market.expirySec });
    console.log(`result: ${show(result)}`);
    if (result.status === "opened") {
      const t = result.ticket;
      const verified = await verifyPrivateClaim(t.claim, t.signature, before.data.desk as never, contract, desk.chainId);
      const tampered = await verifyPrivateClaim({ ...t.claim, stakeBase: (BigInt(t.claim.stakeBase) + 1n).toString() }, t.signature, before.data.desk as never, contract, desk.chainId);
      console.log(`claim verifies against the pinned desk key: ${verified}; with the stake edited by one unit: ${tampered}`);
      mkdirSync("data/drive/private-tickets", { recursive: true });
      const path = `data/drive/private-tickets/${t.claim.slotId.slice(2, 14)}.json`;
      writeFileSync(path, JSON.stringify(t, null, 2));
      console.log(`ticket saved to ${path}`);
    }
    console.log(`budget ${show(await readPrivateBudget(ctx, client.payer.address))}; ${books(await readPrivateDesk(ctx))}`);
  } else if (mode === "cashout") {
    const ticket = readJson<PrivateTicket>(arg("--ticket") ?? "");
    const desk = await bootDesk();
    const result = await cashOutPrivateBet(desk, ticket.claim, ticket.signature);
    console.log(`result: ${show(result)}`);
    console.log(`budget ${show(await readPrivateBudget(ctx, client.payer.address))}; ${books(await readPrivateDesk(ctx))}`);
  } else {
    throw new Error(`unknown mode "${mode}"`);
  }
  process.exit(0);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}
