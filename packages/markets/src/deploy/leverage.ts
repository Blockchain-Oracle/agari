/**
 * agari-leverage bootstrap (S10c), ensure-style: `admin_init_reserve` once, and the reserve's `["seat"]` PDA
 * registered at `program_authorities[2]` (D-063). Without the registration the engine gives the reserve no PROGRAM
 * seat and every boost refuses with `ReserveNotRegistered`, so the two steps go together.
 *
 * Only the program's upgrade authority may initialise the reserve (D-114), so the payer here is the deployer.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_LEVERAGE_PROGRAM_ADDRESS, findCustodyPda, findReservePda, findSeatPda,
  getAdminInitReserveInstructionAsync, type LeverageParamsArgs,
} from "@agari/clients/agari-leverage";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { registerProgramSeat } from "./program-seat";
import { send, type SendContext } from "./send";
import { programDataAddress } from "./vault";

/** The fixed table (D-063). The reserve's seat lives at 2 and nowhere else. */
export const LEVERAGE_AUTHORITY_INDEX = 2;

/** tUSDC has 6 decimals, so one whole unit is 1e6 base units. */
const UNIT = 1_000_000n;

/**
 * The reference's own launch parameters (`DeployLeverageReserve.s.sol`), unchanged.
 *
 * Up to 3×. The premium is 8% of the front, charged at open and kept whatever happens: it is what the reserve is
 * paid for the gap between a knock-out and the print. A position may be sold by anyone once the book would pay
 * less than 120% of the front. Entry only between 5¢ and 95¢, so nothing is boosted on a Window already decided.
 * At most 200 tUSDC fronted on one position, 500 on one Window, 60% of the reserve's value in all, 64 positions
 * open at once, and no opens inside the last 90 s, where a knock-out could not act before the print.
 */
export const DEVNET_LEVERAGE_PARAMS: LeverageParamsArgs = {
  maxLeverageBps: 30_000,
  premiumBps: 800,
  maintenanceBps: 12_000,
  maxExposureBps: 6_000,
  maxOpenPositions: 64,
  minTimeLeftSec: 90,
  minEntryPriceRaw: 50_000n,
  maxEntryPriceRaw: 950_000n,
  maxFrontedPerPositionBase: 200n * UNIT,
  maxWindowFrontedBase: 500n * UNIT,
};

/** The reserve's addresses for scripts, which never import the clients package. */
export async function leverageAddresses(): Promise<{ program: Address; reserve: Address; custody: Address; seat: Address }> {
  const [reserve] = await findReservePda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  return { program: AGARI_LEVERAGE_PROGRAM_ADDRESS, reserve, custody, seat };
}

/** `admin_init_reserve` signed by the client's payer, which must be the upgrade authority; skipped when it exists. */
export async function initLeverageReserve(
  ctx: SendContext,
  params: LeverageParamsArgs = DEVNET_LEVERAGE_PARAMS,
): Promise<{ reserve: Address; custody: Address; seat: Address; signature: string | null }> {
  const { reserve, custody, seat } = await leverageAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(reserve, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init leverage", signature: null, note: `exists ${reserve}` });
    return { reserve, custody, seat, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitReserveInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    programData: await programDataAddress(AGARI_LEVERAGE_PROGRAM_ADDRESS),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    params,
  });
  const signature = await send(ctx, "init leverage", [ix], `LeverageReserve ${reserve}, custody ${custody}, seat ${seat}`);
  return { reserve, custody, seat, signature };
}

/** Registers the reserve's seat at `LEVERAGE_AUTHORITY_INDEX`; every other authority is re-sent unchanged. */
export async function registerLeverageSeat(ctx: SendContext): Promise<string | null> {
  const { seat } = await leverageAddresses();
  return registerProgramSeat(ctx, LEVERAGE_AUTHORITY_INDEX, seat, "leverage");
}
