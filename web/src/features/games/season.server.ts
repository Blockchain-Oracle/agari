import { prizePoolTotalUnits, seasonConfigFrom, type SeasonConfig } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import { ensureMarkets, loadCollateral } from "@masayume/markets";
import { getSeasonPool } from "@masayume/markets/games";
import { marketsEnvFromProcess } from "@/features/session/sponsor.server";

/**
 * The season, server only — the reference's `GET /season` with one difference the page can show: the
 * prize is money already sitting in a contract, so the wire carries the escrow's own balance beside the
 * split it is meant to pay. A season exists only when the operator names one in the environment; with
 * no `SEASON_ID` the ladder is the record and no prize is invented alongside it.
 */

export interface SeasonEscrowWire {
  address: Address;
  seasonId: string;
  endsAtSec: number;
  balanceBase: string;
  depositedBase: string;
  distributed: boolean;
  decimals: number;
  symbol: string;
}

export interface SeasonWire {
  season: SeasonConfig & { prizePool: { totalUnits: number; currency: string } };
  /** Null when no pool is deployed on this network — the page then says the prize is not escrowed. */
  escrow: SeasonEscrowWire | null;
}

/** The operator's season, or null when none is configured — core's reader over this process's environment. */
export function seasonConfig(env: NodeJS.ProcessEnv = process.env): SeasonConfig | null {
  return seasonConfigFrom(env);
}

export async function seasonView(): Promise<SeasonWire | null> {
  const config = seasonConfig();
  if (!config) return null;
  ensureMarkets(marketsEnvFromProcess());
  const collateral = await loadCollateral();
  const money = isOk(collateral) ? collateral.value : null;
  const pool = await getSeasonPool();
  const state = isOk(pool) ? pool.value : null;
  return {
    season: { ...config, prizePool: { totalUnits: prizePoolTotalUnits(config.prizeSplit), currency: money?.symbol ?? "" } },
    escrow:
      state && money
        ? {
            address: state.address,
            seasonId: state.seasonId,
            endsAtSec: state.endsAtSec,
            balanceBase: state.balanceBase.toString(),
            depositedBase: state.depositedBase.toString(),
            distributed: state.distributed,
            decimals: money.decimals,
            symbol: money.symbol,
          }
        : null,
  };
}
