#!/usr/bin/env -S pnpm exec tsx
// S3 init-series, ensure-style (venue-ops.md §5.7): the 9 launch tickers × Regular 5m/15m/60m with their D-003 policy
// versions and 2 recyclable Books each (512 nodes for 5m/15m, 256 for 60m). Creates only what is missing; drift throws.
// Run: pnpm deploy:init-series [--cluster devnet|localnet] [--dry-run] [--cadences 300,900,3600] [--symbols TSLA,NVDA]
//   --dry-run prints what is missing, its exact rent and the payer balance, and sends nothing.
// Payer and Series admin: the deployer (GlobalConfig admin, D-026). A real run refuses below the total + 0.5 SOL.

import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { createDeployClient, ensureBooks, ensureSeries, LAUNCH_GRID, policyVersions, seriesAddress, type PriceSources, type SeriesSpec, type StepContext } from "@agari/markets/deploy";
import { BASIS, bookSpace } from "@agari/markets/ops/roller";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SERIES_ACCOUNT_BYTES = 1_368;
const SIGNATURE_FEE = 5_000n;
const MARGIN = 500_000_000n;
const cluster = clusterArg();
const dryRun = flag("--dry-run");
const cadences = arg("--cadences", "300,900,3600").split(",").map(Number);
const launch = TICKER_SYMBOLS.filter((s) => TICKERS[s].launch);
const symbols = arg("--symbols", launch.join(",")).split(",") as TickerSymbol[];
for (const s of symbols) if (!launch.includes(s)) throw new Error(`${s} is not a launch ticker (${launch.join(" ")})`);
for (const c of cadences) if (![300, 900, 3600].includes(c)) throw new Error(`cadence ${c} is not a Regular cadence`);

const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const specs: SeriesSpec[] = symbols.flatMap((symbol) =>
  cadences.map((cadenceSec) => ({
    key: `${symbol}-${cadenceSec / 60}m`, symbol, ticker: TICKERS[symbol].seriesId, cadenceSec, basis: BASIS.regular, params: LAUNCH_GRID,
    versions: policyVersions(symbol, sources), books: { count: 2, capacity: cadenceSec <= 900 ? 512 : 256 },
  })),
);

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-series on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(balance)} SOL${dryRun ? " — DRY RUN" : ""}`);

type Need = { spec: SeriesSpec; series: boolean; versions: number; books: number; lamports: bigint };
const rent = new Map<number, bigint>();
const rentOf = async (bytes: number) => rent.get(bytes) ?? (rent.set(bytes, await client.getMinimumBalance(bytes)), rent.get(bytes)!);

async function needOf(spec: SeriesSpec): Promise<Need> {
  const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
  const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
  const recorded = file.venue.series?.[spec.key]?.books ?? [];
  const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
  const known = new Set([...recorded, ...free].map(String)).size;
  const books = Math.max(0, spec.books!.count - known);
  const versions = chain.exists ? Math.max(0, spec.versions.length - chain.data.versionCount) : spec.versions.length;
  const seriesRent = chain.exists ? 0n : await rentOf(SERIES_ACCOUNT_BYTES);
  const bookRent = BigInt(books) * (await rentOf(bookSpace(spec.books!.capacity)));
  const fees = (chain.exists && versions === 0 ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
  return { spec, series: !chain.exists, versions, books, lamports: seriesRent + bookRent + fees };
}

const needs: Need[] = [];
for (const spec of specs) needs.push(await needOf(spec));
for (const n of needs) {
  const what = [n.series ? `series + ${n.versions} version(s)` : n.versions ? `${n.versions} version(s)` : "", n.books ? `${n.books} × ${n.spec.books!.capacity}-node book` : ""].filter(Boolean).join(", ");
  console.log(`  ${n.spec.key.padEnd(10)} ${what ? `missing: ${what}`.padEnd(52) : "complete".padEnd(52)} ${n.lamports ? `${sol(n.lamports)} SOL` : ""}`);
}
const total = needs.reduce((sum, n) => sum + n.lamports, 0n);
const [seriesCount, bookCount] = [needs.filter((n) => n.series).length, needs.reduce((s, n) => s + n.books, 0)];
console.log(`total: ${seriesCount} series, ${bookCount} books, ${sol(total)} SOL (rent ${[...rent].map(([b, l]) => `${b} B = ${sol(l)}`).join(", ")}); balance ${sol(balance)} SOL`);

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
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(16)} ${note}${signature ? ` ${cluster === "devnet" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : signature}` : ""}`),
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
