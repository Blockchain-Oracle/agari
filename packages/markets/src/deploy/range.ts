/**
 * agari-range bootstrap (S10b), ensure-style: `admin_init_reserve` once, with the house parameters the venue
 * prices on. Re-running is a no-op, so the script is safe to repeat after a partial devnet run.
 *
 * The parameters below are the reserve's whole risk policy, so each one is stated rather than tuned by feel:
 * they are the same numbers `web/src/app/dev/range/fixtures.ts` renders, which is what makes the fixture page an
 * honest preview of the deployed reserve rather than a drawing.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_RANGE_PROGRAM_ADDRESS, findReservePda, findVaultPda,
  getAdminInitReserveInstructionAsync, type RangeParamsArgs,
} from "@agari/clients/agari-range";
import { AGARI_EVENTS_PROGRAM_ADDRESS } from "@agari/clients/agari-events";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { send, type SendContext } from "./send";

/** tUSDC has 6 decimals, so one whole unit is 1e6 base units. */
const UNIT = 1_000_000n;

/**
 * The devnet house policy.
 *
 * `marginBps` 1,200 is the reserve's edge over fair value. `maxExposureBps` 6,000 keeps two fifths of provider
 * equity unpromised at all times, and `maxExpiryLockedBase` stops more than 200 tUSDC riding on any one boundary
 * — the concentration a single print would otherwise decide. `minProbRaw`/`maxProbRaw` refuse the two ends where
 * the margin stops covering the rounding. `staleAfterSec` is generous on devnet, where a Window can go minutes
 * between trades; a busier venue would tighten it.
 */
export const DEVNET_RANGE_PARAMS: RangeParamsArgs = {
  marginBps: 1_200,
  maxExposureBps: 6_000,
  minCenterQE6: 30_000,
  maxCenterQE6: 970_000,
  minProbRaw: 20_000n,
  maxProbRaw: 970_000n,
  minTimeLeftSec: 60,
  maxHorizonSec: 172_800,
  staleAfterSec: 21_600,
  maxPayoutCapBase: 500n * UNIT,
  sigmaE8: 6_200n,
  maxExpiryLockedBase: 200n * UNIT,
};

/** The reserve's addresses for scripts, which never import the clients package. */
export async function rangeAddresses(): Promise<{ program: Address; reserve: Address; vault: Address }> {
  const [reserve] = await findReservePda();
  const [vault] = await findVaultPda();
  return { program: AGARI_RANGE_PROGRAM_ADDRESS, reserve, vault };
}

/** `admin_init_reserve` signed by the client's payer; skipped when the reserve already exists. */
export async function initRangeReserve(
  ctx: SendContext,
  params: RangeParamsArgs = DEVNET_RANGE_PARAMS,
): Promise<{ reserve: Address; vault: Address; signature: string | null }> {
  const { reserve, vault } = await rangeAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(reserve, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init range", signature: null, note: `exists ${reserve}` });
    return { reserve, vault, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitReserveInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    params,
  });
  const signature = await send(ctx, "init range", [ix], `Reserve ${reserve}, vault ${vault}, collateral ${venue.data.collateralMint}`);
  return { reserve, vault, signature };
}
