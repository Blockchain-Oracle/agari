#!/usr/bin/env -S pnpm exec tsx
// S6 init-gap-series, ensure-style (session-lanes.md §1.3): the Monday Gap Series (basis 1, cadence seed 604,800) of the
// launch tickers with their Gap policy versions (open admission until lock_at) and one recyclable 256-node Book each.
// Creates only what is missing; drift throws (D-026).
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/deploy/init-gap-series.ts
//        [--cluster devnet|localnet] [--dry-run] [--symbols TSLA,NVDA] [--drive 901,902]
//   --dry-run prints what is missing, its exact rent and fees from the cluster's own rent, and the payer balance; it
//             sends nothing. --drive adds the drive-only Gap Series (901 attested, 902 TSLA Pyth v1).
// Payer and Series admin: the deployer (GlobalConfig admin, D-026). A real run refuses below the total + 0.5 SOL.

import { LAUNCH_TICKERS, type TickerSymbol } from "@agari/core/market";
import {
  createDeployClient, driveGapAttestedSeries, driveGapPythSeries, ensureBooks, ensureSeries, GAP_BOOK_ACCOUNT_BYTES, gapSeriesSpecs, seriesAddress,
  SERIES_ACCOUNT_BYTES, type PriceSources, type SeriesSpec, type StepContext,
} from "@agari/markets/deploy";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SIGNATURE_FEE = 5_000n;
const MARGIN = 500_000_000n;
/** What one listed Gap Window holds until it closes (events-accounts.md §3): Market, a 96-seat Ledger, the mvault; the settler's result. */
const WINDOW_BYTES = { market: 456, ledger96: 8 + 96 + 96 * 88, mvault: 82, result: 256 };

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const symbols = arg("--symbols", LAUNCH_TICKERS.join(",")).split(",").filter(Boolean) as TickerSymbol[];
for (const s of symbols) if (!LAUNCH_TICKERS.includes(s)) throw new Error(`${s} is not a launch ticker (${LAUNCH_TICKERS.join(" ")})`);
const drives = arg("--drive", "").split(",").filter(Boolean).map(Number);
for (const d of drives) if (d !== 901 && d !== 902) throw new Error(`--drive takes 901 and/or 902, got ${d}`);

const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const specs: SeriesSpec[] = [
  ...gapSeriesSpecs(sources, symbols),
  ...(drives.includes(901) ? [driveGapAttestedSeries(sources)] : []),
  ...(drives.includes(902) ? [driveGapPythSeries(sources)] : []),
];

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-gap-series on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(balance)} SOL${dryRun ? " — DRY RUN" : ""}`);

type Need = { spec: SeriesSpec; address: string; series: boolean; versions: number; books: number; lamports: bigint };
const rent = new Map<number, bigint>();
const rentOf = async (bytes: number) => rent.get(bytes) ?? (rent.set(bytes, await client.getMinimumBalance(bytes)), rent.get(bytes)!);

async function needOf(spec: SeriesSpec): Promise<Need> {
  const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
  const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
  const recorded = file.venue.series?.[spec.key]?.books ?? [];
  const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
  const books = Math.max(0, spec.books!.count - new Set([...recorded, ...free].map(String)).size);
  const versions = chain.exists ? Math.max(0, spec.versions.length - chain.data.versionCount) : spec.versions.length;
  const seriesRent = chain.exists ? 0n : await rentOf(SERIES_ACCOUNT_BYTES);
  const bookRent = BigInt(books) * (await rentOf(GAP_BOOK_ACCOUNT_BYTES));
  // Register + versions in one transaction (1 signature); each Book is create + add (payer and the Book keypair).
  const fees = (chain.exists && versions === 0 ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
  return { spec, address, series: !chain.exists, versions, books, lamports: seriesRent + bookRent + fees };
}

const needs: Need[] = [];
for (const spec of specs) needs.push(await needOf(spec));
for (const n of needs) {
  const what = [n.series ? `series + ${n.versions} version(s)` : n.versions ? `${n.versions} version(s)` : "", n.books ? `${n.books} × 256-node book` : ""].filter(Boolean).join(", ");
  console.log(`  ${n.spec.key.padEnd(14)} ${n.address.padEnd(44)} ${(what ? `missing: ${what}` : "complete").padEnd(40)} ${n.lamports ? `${sol(n.lamports)} SOL` : ""}`);
}
const total = needs.reduce((sum, n) => sum + n.lamports, 0n);
const [seriesCount, bookCount] = [needs.filter((n) => n.series).length, needs.reduce((s, n) => s + n.books, 0)];
const perWindow = (await rentOf(WINDOW_BYTES.market)) + (await rentOf(WINDOW_BYTES.ledger96)) + (await rentOf(WINDOW_BYTES.mvault));
console.log(`total: ${seriesCount} series, ${bookCount} books, ${sol(total)} SOL kept (rent ${[SERIES_ACCOUNT_BYTES, GAP_BOOK_ACCOUNT_BYTES].map((b) => `${b} B = ${sol(rent.get(b) ?? 0n)}`).join(", ")}); balance ${sol(balance)} SOL`);
console.log(`float per listed Window (returned at close): ${sol(perWindow)} SOL roller + ${sol(await rentOf(WINDOW_BYTES.result))} SOL settler result; ${specs.length} weekend Windows = ${sol(perWindow * BigInt(specs.length))} SOL`);

if (dryRun) process.exit(0);
if (balance < total + MARGIN) {
  console.error(`refusing: the payer needs ${sol(total + MARGIN)} SOL (total + 0.5 margin) and holds ${sol(balance)}`);
  process.exit(1);
}
const ctx: StepContext = {
  client,
  record: file.venue,
  save: (next) => {
    Object.assign(file.venue, next);
    save();
  },
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(18)} ${note}${signature ? ` ${cluster === "devnet" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : signature}` : ""}`),
};
try {
  // Complete Series go through ensure too: that is the field-by-field drift check (D-026).
  for (const n of needs) {
    const series = await ensureSeries(ctx, n.spec);
    await ensureBooks(ctx, n.spec, series);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${sol(balance - after)} SOL (planned ${sol(total)}), balance ${sol(after)} SOL → ${path}`);
process.exit(0);
