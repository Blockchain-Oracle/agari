/**
 * The token Series set (session-lanes.md §2.4): TSLAx/NVDAx/SPYx/QQQx × 300/900/3,600, basis 2, two 256-node Books each,
 * on `LAUNCH_GRID`, with the token versions of `tokenPolicyVersions`. Lane 6b owns this file; `deploy/index.ts`
 * re-exports all of it.
 */
import { findConfigPda, getAdminSetAuthoritiesInstructionAsync, type AdminSetAuthoritiesInstructionDataArgs, type GlobalConfig } from "@agari/clients/agari-events";
import { laneKey, TICKERS, TOKEN_LANE_TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Address } from "@solana/kit";
import type { DeployClient } from "./client";
import type { PriceSources } from "./policies";
import { tokenPolicyVersions } from "./policies-token";
import { send, type StepContext } from "./send";
import { BASIS, DEFAULT_ADDRESS, LAUNCH_GRID, type SeriesSpec } from "./venue-spec";

export const TOKEN_CADENCES = [300, 900, 3_600] as const;
export const TOKEN_BOOKS = { count: 2, capacity: 256 } as const;
/** Switchboard's default devnet queue (spike (a), D-053); pinned on chain by `admin_set_authorities`. */
export const SWITCHBOARD_DEVNET_QUEUE_ADDRESS = "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7" as Address;

/** Every token Series of `symbols` × `cadences`; throws while any feed hash is unpinned. */
export function tokenSeries(sources: PriceSources, symbols: readonly TickerSymbol[] = TOKEN_LANE_TICKERS, cadences: readonly number[] = TOKEN_CADENCES): SeriesSpec[] {
  return symbols.flatMap((symbol) => {
    if (!TICKERS[symbol].xstock) throw new Error(`${symbol} has no xStock token lane`);
    const versions = tokenPolicyVersions(symbol, sources);
    return cadences.map((cadenceSec) => ({
      key: laneKey(symbol, "token", cadenceSec),
      symbol,
      ticker: TICKERS[symbol].seriesId,
      cadenceSec,
      basis: BASIS.token,
      params: LAUNCH_GRID,
      versions,
      books: { ...TOKEN_BOOKS },
    }));
  });
}

/**
 * `admin_set_authorities` replaces every field (D-026), so the Switchboard pin re-sends the current set read from
 * GlobalConfig with only the queue and the minimum changed (session-lanes.md §2.3 step 5).
 */
export function authoritiesWithSwitchboard(config: GlobalConfig, queue: Address, minOracles: number): AdminSetAuthoritiesInstructionDataArgs {
  if (!Number.isInteger(minOracles) || minOracles < 1 || minOracles > 8) throw new Error(`switchboard min oracles must be 1..8, got ${minOracles}`);
  return {
    rollers: config.rollers,
    attestors: config.attestors,
    redstoneSigners: config.redstoneSigners,
    redstoneSignerCount: config.redstoneSignerCount,
    redstoneThreshold: config.redstoneThreshold,
    switchboardQueue: queue,
    switchboardMinOracles: minOracles,
    programAuthorities: config.programAuthorities,
    resultRetentionSec: config.resultRetentionSec,
  };
}

export type SwitchboardPin = { queue: Address | null; minOracles: number; treasury: Address; config: GlobalConfig };

/** The GlobalConfig's current Switchboard pin (null queue = the zero placeholder). */
export async function readSwitchboardPin(client: DeployClient): Promise<SwitchboardPin> {
  const [address] = await findConfigPda();
  const config = (await client.agariEvents.accounts.globalConfig.fetch(address)).data;
  return { queue: config.switchboardQueue === DEFAULT_ADDRESS ? null : config.switchboardQueue, minOracles: config.switchboardMinOracles, treasury: config.treasury, config };
}

/** Ensure-style `admin_set_authorities` with only the Switchboard queue and minimum changed. The payer must be the admin. */
export async function pinSwitchboardQueue(ctx: StepContext, queue: Address, minOracles: number): Promise<string | null> {
  const pin = await readSwitchboardPin(ctx.client);
  if (pin.queue === queue && pin.minOracles === minOracles) {
    ctx.log({ step: "switchboard pin", signature: null, note: `queue ${queue}, min ${minOracles} already set` });
    return null;
  }
  const ix = await getAdminSetAuthoritiesInstructionAsync({ admin: ctx.client.payer, treasury: pin.treasury, ...authoritiesWithSwitchboard(pin.config, queue, minOracles) });
  return send(ctx, "switchboard pin", [ix], `queue ${pin.queue ?? "unset"} → ${queue}, min ${pin.minOracles} → ${minOracles}`);
}
