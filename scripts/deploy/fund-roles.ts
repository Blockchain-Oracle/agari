#!/usr/bin/env -S pnpm exec tsx
// S3 fund-roles, ensure-style (venue-ops.md §1, §5.8): tops each venue role up to its SOL float from the deployer, and
// mints tUSDC to the maker up to its float with the faucet authority. Sends only differences; never takes SOL back.
// Run: pnpm deploy:fund-roles [--cluster devnet|localnet] [--dry-run] [--targets roller=4,settler=2.5] [--maker-tusdc 2000]
// A real run refuses when the deployer would drop below 0.5 SOL.

import { createOpsClient, keypairSigner } from "@agari/markets/ops";
import { collateralBalanceOf, COLLATERAL_DECIMALS, lamportsOf, mintCollateral, readVenueConfig, transferSol } from "@agari/markets/ops/roller";
import { arg, clusterArg, endpoints, flag, redactKey, rolePubkey, roleSecret, sol, solToLamports } from "./ops-cluster";

/** Spec §1 floats: roller pays Market/Ledger rent, settler pays MarketResult rent, relay posts Pyth, maker pays fees. */
const DEFAULT_TARGETS: Record<string, string> = { roller: "4", settler: "2.5", "price-relay": "0.3", maker: "0.2", "price-attestor": "0.3", sponsor: "0.5" };
const MARGIN = 500_000_000n;

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const targets = { ...DEFAULT_TARGETS };
for (const pair of arg("--targets", "").split(",").filter(Boolean)) {
  const [role, amount] = pair.split("=");
  if (!role || !amount || !(role in DEFAULT_TARGETS)) throw new Error(`--targets expects role=SOL for ${Object.keys(DEFAULT_TARGETS).join(", ")}`);
  targets[role] = amount;
}
const makerTusdc = BigInt(arg("--maker-tusdc", process.env.MM_TUSDC_FLOAT ?? "2000")) * 10n ** BigInt(COLLATERAL_DECIMALS);

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createOpsClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const config = await readVenueConfig(client);
const before = await lamportsOf(client, client.payer.address);
console.log(`fund-roles on ${cluster} (${label}) from ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

const topUps: Array<{ role: string; address: string; lamports: bigint }> = [];
for (const [role, amount] of Object.entries(targets)) {
  const address = rolePubkey(role);
  const have = await lamportsOf(client, address as never);
  const want = solToLamports(amount);
  const lamports = have < want ? want - have : 0n;
  topUps.push({ role, address, lamports });
  console.log(`  ${role.padEnd(12)} ${address}  holds ${sol(have)}  float ${sol(want)}  ${lamports ? `→ +${sol(lamports)} SOL` : "ok"}`);
}
const maker = rolePubkey("maker");
const tusdc = await collateralBalanceOf(client, maker as never, config.collateralMint);
const mint = tusdc.amount < makerTusdc ? makerTusdc - tusdc.amount : 0n;
console.log(`  maker tUSDC  ${tusdc.ata}  holds ${tusdc.amount}  float ${makerTusdc}  ${mint ? `→ mint ${mint} base units` : "ok"}`);

const total = topUps.reduce((sum, t) => sum + t.lamports, 0n);
console.log(`total: ${sol(total)} SOL to roles (+ ATA rent and fees), deployer ${sol(before)} SOL`);
if (dryRun) process.exit(0);
if (before < total + MARGIN) {
  console.error(`refusing: the deployer needs ${sol(total + MARGIN)} SOL and holds ${sol(before)}; lower --targets or fund the deployer`);
  process.exit(1);
}
const link = (signature: string) => (cluster === "devnet" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : signature);
try {
  for (const t of topUps) {
    if (t.lamports === 0n) continue;
    console.log(`  sent ${sol(t.lamports)} SOL → ${t.role}  ${link(await transferSol(client, t.address as never, t.lamports))}`);
  }
  if (mint > 0n) {
    const faucet = await keypairSigner(roleSecret("faucet-mint-authority"));
    console.log(`  minted ${mint} tUSDC base units → maker  ${link(await mintCollateral(client, { faucet, mint: config.collateralMint, owner: maker as never, amount: mint }))}`);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
console.log(`done: deployer ${sol(await lamportsOf(client, client.payer.address))} SOL`);
