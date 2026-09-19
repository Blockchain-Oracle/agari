#!/usr/bin/env -S pnpm exec tsx
// The live Pre-IPO lane's Series (plan Step 3, D-100..D-103): one PreStocks name on basis token (24/7) at one cadence,
// attested primary with no cross-check, two 256-node Books so a back-to-back lane always has a Book to open into.
// Ensure-style: creates only what is missing; drift throws. The roller lists it on its next Series scan (5 min), so run
// this only once the soak executes code with the PreStocks relay pass (`RELAY_PRESTOCKS=1`), or every Window voids.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/deploy/init-prestocks-series.ts [--cluster devnet]
//        [--symbol OPENAI] [--cadence 3600] [--dry-run]
// Payer and admin: the deployer (GlobalConfig admin, D-026). Cost ≈ 0.011 SOL Series rent + 2 × 0.2276 SOL Book rent.

import { PRE_IPO_TICKERS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { BASIS, createDeployClient, ensureBooks, ensureSeries, preStocksSeries, seriesAddress, type SeriesSpec, type StepContext } from "@agari/markets/deploy";
import { bookSpace } from "@agari/markets/ops/roller";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SERIES_ACCOUNT_BYTES = 1_368;
const SIGNATURE_FEE = 5_000n;
const MARGIN = 300_000_000n;
const TOKEN_BOOKS = { count: 2, capacity: 256 } as const;
const cluster = clusterArg();
const dryRun = flag("--dry-run");
const symbol = arg("--symbol", "OPENAI").toUpperCase() as TickerSymbol;
const cadenceSec = Number(arg("--cadence", "3600"));
if (!(PRE_IPO_TICKERS as readonly string[]).includes(symbol)) throw new Error(`${symbol} is not a PreStocks name (${PRE_IPO_TICKERS.join(" ")})`);
if (![300, 900, 3_600].includes(cadenceSec)) throw new Error(`--cadence must be 300, 900 or 3600, got ${cadenceSec}`);
readJson<unknown>("services/ops/config/price-sources.json"); // present on this checkout, as the other init scripts require

const spec: SeriesSpec = preStocksSeries(symbol, TICKERS[symbol].seriesId, cadenceSec, BASIS.token, TOKEN_BOOKS);
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-prestocks-series ${spec.key} on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(balance)} SOL${dryRun ? " — DRY RUN" : ""}`);

const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
const recorded = file.venue.series?.[spec.key]?.books ?? [];
const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
const known = new Set([...recorded, ...free].map(String)).size;
const books = Math.max(0, TOKEN_BOOKS.count - known);
const seriesRent = chain.exists ? 0n : await client.getMinimumBalance(SERIES_ACCOUNT_BYTES);
const bookRent = BigInt(books) * (await client.getMinimumBalance(bookSpace(TOKEN_BOOKS.capacity)));
const total = seriesRent + bookRent + (chain.exists ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
console.log(`  ${spec.key}: ${chain.exists ? "series exists" : "series + 1 version"}, ${books} book(s) to create → ${sol(total)} SOL; ticker ${spec.ticker}, basis ${spec.basis}, feed prestocks-v1:${symbol}`);
if (dryRun) process.exit(0);
if (balance < total + MARGIN) {
  console.error(`refusing: the payer needs ${sol(total + MARGIN)} SOL (total + 0.3 margin) and holds ${sol(balance)}`);
  process.exit(1);
}
const ctx: StepContext = {
  client,
  record: file.venue,
  save: (next) => {
    Object.assign(file.venue, next);
    save();
  },
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(16)} ${note}${signature ? ` https://explorer.solana.com/tx/${signature}?cluster=${cluster}` : ""}`),
};
try {
  const series = await ensureSeries(ctx, spec);
  await ensureBooks(ctx, spec, series);
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${sol(balance - after)} SOL (planned ${sol(total)}), balance ${sol(after)} SOL → ${path}`);
