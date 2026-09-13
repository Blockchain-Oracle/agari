import { prizePoolTotalUnits, seasonConfigFrom, seasonWinners } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { countRankedFinalized, isDbConfigured, listTopRatings } from "@masayume/db";
import { closeRuntime, ensureMarkets, loadCollateral, parseMarketsEnv } from "@masayume/markets";
import { getSeasonPool } from "@masayume/markets/games";
import { finish } from "../spike/finish";

/**
 * The season's payout readout — Flicky's `season:results`: the ladder in rating order, the ineligible
 * skipped rather than paid, the split walked down the eligible list, and the pool's on-chain balance
 * set against the total so the operator sees whether the escrow covers the sheet before distributing.
 * Read-only. Point DATABASE_URL at the ladder the settler writes and SEASON_* at the season.
 *
 *   pnpm --filter @masayume/ops season:results
 */
export async function seasonSheet(): Promise<{ winners: ReturnType<typeof seasonWinners>; totalUnits: number; excluded: { wallet: string; rating: number; stakedDuels: number }[] }> {
  const season = seasonConfigFrom(process.env);
  if (!season) throw new Error("no season: set SEASON_ID, SEASON_ENDS_AT and SEASON_PRIZE_SPLIT");
  if (!isDbConfigured()) throw new Error("no DATABASE_URL: the ladder lives there");
  const ranked = await listTopRatings(1_000);
  const staked = await countRankedFinalized(null);
  const standings = ranked.map((row) => ({ wallet: row.wallet, rating: row.rating, stakedDuels: staked.get(row.wallet) ?? 0 }));
  const winners = seasonWinners(standings, season.prizeSplit, season.minStakedDuels);
  const paidTo = Math.max(...season.prizeSplit.map((t) => t.rankEnd));
  const excluded = standings.slice(0, paidTo).filter((row) => row.stakedDuels < season.minStakedDuels);
  return { winners, totalUnits: winners.reduce((sum, w) => sum + w.amountUnits, 0), excluded };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function main(): Promise<void> {
  const season = seasonConfigFrom(process.env);
  if (!season) throw new Error("no season: set SEASON_ID, SEASON_ENDS_AT and SEASON_PRIZE_SPLIT");
  ensureMarkets(parseMarketsEnv());
  const collateral = await loadCollateral();
  const money = isOk(collateral) ? collateral.value : null;
  const pool = await getSeasonPool();
  const state = isOk(pool) ? pool.value : null;

  const { winners, totalUnits, excluded } = await seasonSheet();
  console.log(`\n${season.name} (${season.id}) — payout readout · ends ${season.endsAt}`);
  console.log(`split total ${prizePoolTotalUnits(season.prizeSplit)} ${money?.symbol ?? ""} · eligibility: ≥${season.minStakedDuels} ranked duels`);
  if (state && money) {
    console.log(`pool ${state.address}: holds ${formatBaseUnits(state.balanceBase, money.decimals, { maxDp: 2, minDp: 0 })} ${money.symbol}${state.distributed ? " · ALREADY DISTRIBUTED" : ""}`);
  } else {
    console.log("pool: none deployed on this network");
  }
  console.log("\n── PAYOUT (eligible players, in rating order) ──");
  console.log("rank  wallet          rating  prize");
  for (const w of winners) console.log(`${String(w.rank).padStart(2)}    ${short(w.wallet).padEnd(14)}  ${String(w.rating).padStart(5)}   ${w.amountUnits} ${money?.symbol ?? ""}`);
  if (winners.length === 0) console.log("  (nobody is eligible yet)");
  console.log(`\ntotal to pay: ${totalUnits} ${money?.symbol ?? ""}`);
  if (excluded.length > 0) {
    console.log("\n── EXCLUDED (in the money by rating, under the eligibility floor) ──");
    for (const row of excluded) console.log(`      ${short(row.wallet).padEnd(14)}  ${String(row.rating).padStart(5)}   ${row.stakedDuels}/${season.minStakedDuels} ranked`);
  }
  await closeRuntime();
}

if (process.argv[1]?.endsWith("season-results.ts")) {
  void main()
    .then(() => finish(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      finish(1);
    });
}
