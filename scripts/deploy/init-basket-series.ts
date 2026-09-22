#!/usr/bin/env -S pnpm exec tsx
// A basket's live 24/7 Series (S19, D-124): one basket on basis token at one cadence, attested primary with no
// cross-check on the `prestocks-basket-v1:<SYM>` feed, two 256-node Books. Ensure-style: creates only what is missing;
// drift throws. The bases the feed stands on are frozen in `packages/core/src/market/baskets.ts` and copied into the
// Series record here (`basePrices`, `baseAtSec`), so a re-base is visibly a new feed version, never an edit.
//
// ORDER OF OPERATIONS (the D-102 hazard): register NOTHING until the ops that serves production runs the S19.2–S19.3
// code (the PreStocks feed keeping snapshots and the relay pass keying `prestocks-basket-v1:*`). The roller lists a
// Series within 5 min of registration and opens Windows on it; a relay that does not know the feed records no print,
// and every basket Window voids. Registration happens only after the integrator has deployed A2–A3 to production ops.
// Order then: AILABS and PREALL first, then FRONTIER, PREDMKTS, DEFSPACE. Each registration goes in acceptance.md.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/deploy/init-basket-series.ts --basket AILABS [--cadence 3600] [--dry-run]
//      pnpm exec tsx scripts/deploy/init-basket-series.ts --capture-base
// `--dry-run` reads the chain (Series account, rent) and prints the plan; it sends nothing. `--capture-base` makes one
// catalogue read and prints the `BASE_AT_SEC`/`BASES` block to paste into baskets.ts; it touches no chain at all.
// Payer and admin: the deployer (GlobalConfig admin, D-026). Cost ≈ 0.011 SOL Series rent + 2 × 0.2276 SOL Book rent.

import { BASKET_SYMBOLS, BASKETS, isBasketSymbol, PRE_IPO_SYMBOLS, TICKERS } from "@agari/core/market";
import { BASIS, createDeployClient, ensureBooks, ensureSeries, preStocksBasketSeries, seriesAddress, type SeriesSpec, type StepContext } from "@agari/markets/deploy";
import { fetchPreStocks } from "@agari/markets/ops/prints";
import { bookSpace } from "@agari/markets/ops/roller";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SERIES_ACCOUNT_BYTES = 1_368;
const SIGNATURE_FEE = 5_000n;
const MARGIN = 300_000_000n;
const TOKEN_BOOKS = { count: 2, capacity: 256 } as const;
const grouped = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "_");
const points = (e8: bigint) => `${e8 / 100_000_000n}.${(e8 % 100_000_000n).toString().padStart(8, "0")}`;

if (flag("--capture-base")) {
  await captureBase();
  process.exit(0);
}

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const symbol = arg("--basket", "AILABS").toUpperCase();
const cadenceSec = Number(arg("--cadence", "3600"));
if (!isBasketSymbol(symbol)) throw new Error(`${symbol} is not a basket (${BASKET_SYMBOLS.join(" ")})`);
if (![300, 900, 3_600].includes(cadenceSec)) throw new Error(`--cadence must be 300, 900 or 3600, got ${cadenceSec}`);
readJson<unknown>("services/ops/config/price-sources.json"); // present on this checkout, as the other init scripts require

const basket = BASKETS[symbol];
const spec: SeriesSpec = preStocksBasketSeries(basket, cadenceSec, TOKEN_BOOKS); // throws on a null base: nothing registers without one
const bases = Object.fromEntries(basket.members.map((m) => [m.symbol, m.basePriceE8!.toString()]));
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-basket-series ${spec.key} on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(balance)} SOL${dryRun ? " — DRY RUN" : ""}`);

const prior = file.venue.series?.[spec.key];
if (prior?.basePrices && (prior.baseAtSec !== basket.baseAtSec || JSON.stringify(prior.basePrices) !== JSON.stringify(bases))) {
  console.error(`refusing: ${spec.key} was registered on a different base (${prior.baseAtSec}); a re-base is a new feed version and a new Series, never an edit`);
  process.exit(1);
}

const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
const recorded = prior?.books ?? [];
const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
const known = new Set([...recorded, ...free].map(String)).size;
const books = Math.max(0, TOKEN_BOOKS.count - known);
const seriesRent = chain.exists ? 0n : await client.getMinimumBalance(SERIES_ACCOUNT_BYTES);
const bookRent = BigInt(books) * (await client.getMinimumBalance(bookSpace(TOKEN_BOOKS.capacity)));
const total = seriesRent + bookRent + (chain.exists ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
console.log(`  ${spec.key}: ${chain.exists ? "series exists" : "series + 1 version"}, ${books} book(s) to create → ${sol(total)} SOL; ticker ${spec.ticker}, basis ${spec.basis} (token ${BASIS.token}), feed prestocks-basket-v1:${symbol}`);
console.log(`  index base 1,000 pts at ${new Date(basket.baseAtSec! * 1000).toISOString()}: ${basket.members.map((m) => `${m.symbol} ${m.weightBps} bps @ ${points(m.basePriceE8!)}`).join(", ")}`);
if (dryRun) {
  console.log("  dry run: nothing sent. Register only once production ops runs S19.2–S19.3, or every Window voids (see the header).");
  process.exit(0);
}
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
  // The base rides beside the Series so the record says what its feed version stands on.
  ctx.save({ ...file.venue, series: { ...file.venue.series, [spec.key]: { ...file.venue.series![spec.key]!, basePrices: bases, baseAtSec: basket.baseAtSec! } } });
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${sol(balance - after)} SOL (planned ${sol(total)}), balance ${sol(after)} SOL → ${path}`);

/** One catalogue read, printed as the block `baskets.ts` freezes. A name the read did not price (or priced under another mint) leaves a hole, and a block with a hole must not be pasted. */
async function captureBase(): Promise<void> {
  const read = await fetchPreStocks();
  const holes: string[] = [];
  const lines: string[] = [];
  for (const name of PRE_IPO_SYMBOLS) {
    const row = read.tokens.get(name);
    const mint = String(TICKERS[name].preIpo!.mint);
    if (!row) holes.push(`${name}: not in the catalogue`);
    else if (row.mint !== mint) holes.push(`${name}: catalogue mint ${row.mint} is not the registry's ${mint}`);
    else lines.push(`  ${name}: ${grouped(row.tokenPriceE8)}n,`);
  }
  console.log(`// PreStocks catalogue read at ${new Date(read.fetchedAtSec * 1000).toISOString()} (${read.tokens.size} rows${read.ageSec !== null ? `, cache age ${read.ageSec} s` : ""})`);
  console.log(`const BASE_AT_SEC = ${grouped(BigInt(read.fetchedAtSec))};`);
  console.log(`const BASES: Readonly<Record<PreIpoSymbol, bigint>> = {\n${lines.join("\n")}\n};`);
  if (holes.length) {
    console.error(`NOT a usable base: ${holes.join("; ")}. Every basket over a missing name would have no index.`);
    process.exit(1);
  }
  console.log("// Paste both into packages/core/src/market/baskets.ts, update the snapshot in baskets.test.ts, commit, then register.");
}
