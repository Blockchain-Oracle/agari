/**
 * agari-parlay bootstrap (S10a), ensure-style: `admin_init_reserve` once, with the house parameters the reserve
 * prices on. Re-running is a no-op, so the script is safe to repeat after a partial devnet run.
 *
 * The parameters below are the reserve's whole risk policy, so each one is stated rather than tuned by feel.
 */
import { AGARI_EVENTS_PROGRAM_ADDRESS, findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_PARLAY_PROGRAM_ADDRESS, findReservePda, findVaultPda,
  getAdminInitReserveInstructionAsync, type ParlayParamsArgs,
} from "@agari/clients/agari-parlay";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { send, type SendContext } from "./send";

/** tUSDC has 6 decimals, so one whole unit is 1e6 base units. */
const UNIT = 1_000_000n;

/**
 * The devnet house policy.
 *
 * `marginBps` 1,200 is the reserve's edge over the product of the legs. `correlationBps` 4,000 holds a ticket
 * whose legs settle on one print to at least 40% of its cheapest leg, because one print decides them together
 * and multiplying them as if they were independent sells the ticket far too cheaply. `maxExposureBps` 6,000 keeps
 * two fifths of provider equity unpromised, and `maxExpiryLockedBase` stops more than 100 tUSDC riding on any one
 * boundary.
 *
 * A leg is priced only from orders that have rested `minRestSlots` (about 20 s), over a depth of at least
 * `priceDepthRaw` (1 tUSDC of payout) and never less than the ticket's own payout. The venue's maker rests
 * 5,000 lots a side, which is 5 tUSDC of payout: that, not `maxPayoutCapBase`, is what bounds a ticket today.
 * `maxSpreadTicks` is off until the maker's two-sided quoting has been watched under it; on a one-sided devnet
 * book it would refuse every leg. `maxLegs` 3 is the builder's own cap.
 */
export const DEVNET_PARLAY_PARAMS: ParlayParamsArgs = {
  marginBps: 1_200,
  maxExposureBps: 6_000,
  correlationBps: 4_000,
  maxSpreadTicks: 0,
  maxLegs: 3,
  minRestSlots: 50,
  minTimeLeftSec: 60,
  maxPayoutCapBase: 50n * UNIT,
  maxExpiryLockedBase: 100n * UNIT,
  minCombinedProbRaw: 10_000n,
  priceDepthRaw: 1n * UNIT,
};

/** The reserve's addresses for scripts, which never import the clients package. */
export async function parlayAddresses(): Promise<{ program: Address; reserve: Address; vault: Address }> {
  const [reserve] = await findReservePda();
  const [vault] = await findVaultPda();
  return { program: AGARI_PARLAY_PROGRAM_ADDRESS, reserve, vault };
}

/** `admin_init_reserve` signed by the client's payer; skipped when the reserve already exists. */
export async function initParlayReserve(
  ctx: SendContext,
  params: ParlayParamsArgs = DEVNET_PARLAY_PARAMS,
): Promise<{ reserve: Address; vault: Address; signature: string | null }> {
  const { reserve, vault } = await parlayAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(reserve, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init parlay", signature: null, note: `exists ${reserve}` });
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
  const signature = await send(ctx, "init parlay", [ix], `Reserve ${reserve}, vault ${vault}, collateral ${venue.data.collateralMint}`);
  return { reserve, vault, signature };
}
