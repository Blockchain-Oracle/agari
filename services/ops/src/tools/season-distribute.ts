import { mkdirSync, writeFileSync } from "node:fs";
import { seasonConfigFrom, toBaseUnits } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { closeRuntime, ensureMarkets, getClient, loadCollateral, parseMarketsEnv } from "@masayume/markets";
import { distributeSeasonPrizes, getSeasonPool } from "@masayume/markets/games";
import type { PublicClient } from "viem";
import { finish } from "../spike/finish";
import { seasonSheet } from "./season-results";

/**
 * The season's payout — Flicky's `season:distribute`: the SAME winner list `season:results` prints,
 * sent to the pool's admin-only, single-shot `distribute`. Each winner receives their prize directly, the
 * transaction is every winner's receipt, and a local receipt JSON is written beside the deployments.
 *
 * SAFE BY DEFAULT: prints the plan and exits. Pass `--execute` to submit; real funds move only then.
 * `SEASON_ADMIN_PRIVATE_KEY` is the pool's admin (the deployer that created it).
 *
 *   pnpm --filter @masayume/ops season:distribute            # dry run
 *   pnpm --filter @masayume/ops season:distribute --execute  # pay out
 */
const EXECUTE = process.argv.includes("--execute");

async function main(): Promise<void> {
  const season = seasonConfigFrom(process.env);
  if (!season) throw new Error("no season: set SEASON_ID, SEASON_ENDS_AT and SEASON_PRIZE_SPLIT");
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error(`collateral unreadable: ${collateral.error.technical}`);
  const money = collateral.value;
  const pool = await getSeasonPool();
  if (!isOk(pool) || !pool.value) throw new Error("no season prize pool is deployed on this network");
  const state = pool.value;

  const { winners, totalUnits } = await seasonSheet();
  const totalBase = toBaseUnits(totalUnits, money.decimals);
  console.log(`\n${season.name} (${season.id}) — prize distribution · pool ${state.address}`);
  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} · ${winners.length} winner(s) · ${totalUnits} ${money.symbol} total · pool holds ${formatBaseUnits(state.balanceBase, money.decimals, { maxDp: 2, minDp: 0 })} ${money.symbol}\n`);
  for (const w of winners) console.log(`${String(w.rank).padStart(2)}  ${w.wallet}  ${w.rating}  ${w.amountUnits} ${money.symbol}`);

  if (winners.length === 0) return console.log("\nno eligible winners — nothing to distribute.");
  if (state.distributed) throw new Error("this pool has already distributed");
  if (state.balanceBase < totalBase) throw new Error(`the pool holds less than the sheet: deposit ${formatBaseUnits(totalBase - state.balanceBase, money.decimals)} ${money.symbol} first`);
  if (!EXECUTE) return console.log("\nDRY RUN — re-run with --execute to submit the payout.");

  const key = process.env.SEASON_ADMIN_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("SEASON_ADMIN_PRIVATE_KEY (the pool's admin) is required to --execute");
  const hash = await distributeSeasonPrizes({
    privateKey: key as Hex,
    rpcUrl: env.rpcHttpUrls[0] as string,
    winners: winners.map((w) => w.wallet as Address),
    amountsBase: winners.map((w) => toBaseUnits(w.amountUnits, money.decimals)),
    publicClient: getClient().getViemClient() as PublicClient,
  });

  const receipt = {
    season: { id: season.id, name: season.name, endsAt: season.endsAt },
    chainId: env.chainId,
    pool: state.address,
    txHash: hash,
    distributedAt: new Date().toISOString(),
    currency: money.symbol,
    totalUnits,
    winners: winners.map((w) => ({ rank: w.rank, wallet: w.wallet, rating: w.rating, amountUnits: w.amountUnits })),
  };
  const dir = new URL("../../../../contracts/deployments/seasons/", import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}${season.id}-${hash.slice(0, 10)}.json`;
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`\ndistributed ${totalUnits} ${money.symbol} to ${winners.length} winner(s) · ${hash}\nreceipt: ${path}`);
  await closeRuntime();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    finish(1);
  });
