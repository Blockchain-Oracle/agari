/**
 * agari-maker bootstrap (S8), ensure-style: `admin_init_vault` once, and the vault's `["seat"]` PDA registered at
 * its fixed `program_authorities` index (D-063: 0 agari-vault · 1 agari-maker · 2 agari-leverage · 3 agari-private
 * · 4 agari-arena). Without that registration the engine will not give the vault a PROGRAM seat, and every quote
 * refuses with `VaultNotRegistered` — so the two steps go together.
 */
import { findConfigPda, AGARI_EVENTS_PROGRAM_ADDRESS } from "@agari/clients/agari-events";
import {
  AGARI_MAKER_PROGRAM_ADDRESS, findCustodyPda, findSeatPda, findVaultPda,
  getAdminInitVaultInstructionAsync, type MakerParamsArgs,
} from "@agari/clients/agari-maker";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { registerProgramSeat } from "./program-seat";
import { send, type SendContext } from "./send";

/** The fixed table (D-063). The maker's seat lives at 1 and nowhere else. */
export const MAKER_AUTHORITY_INDEX = 1;

const UNIT = 1_000_000n;

/**
 * The devnet house policy for the maker vault.
 *
 * `maxExposureBps` 5,000 keeps half the pool in custody at all times, so a provider can always withdraw
 * something without waiting for a pull. `minSpreadTicks` 20 is 2¢: below that the vault's edge stops covering
 * the tick rounding on both legs. The price band refuses the two ends where a quote is nearly a certainty and
 * the spread earns nothing. `maxWindowDeployedBase` caps one Window at 50 tUSDC so no single print decides the
 * pool, and `minTimeLeftSec` 120 stops it quoting into a Window that locks before a fill could be worked.
 */
export const DEVNET_MAKER_PARAMS: MakerParamsArgs = {
  maxExposureBps: 5_000,
  minSpreadTicks: 20,
  minPriceTicks: 50,
  maxPriceTicks: 950,
  maxQuantityLots: 5_000n,
  maxWindowDeployedBase: 50n * UNIT,
  maxOpenWindows: 12,
  minTimeLeftSec: 120,
};

export async function makerAddresses(): Promise<{ program: Address; vault: Address; custody: Address; seat: Address }> {
  const [vault] = await findVaultPda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  return { program: AGARI_MAKER_PROGRAM_ADDRESS, vault, custody, seat };
}

/** `admin_init_vault` signed by the client's payer; skipped when the vault already exists. */
export async function initMakerVault(
  ctx: SendContext,
  maker: Address,
  params: MakerParamsArgs = DEVNET_MAKER_PARAMS,
): Promise<{ vault: Address; custody: Address; seat: Address; signature: string | null }> {
  const { vault, custody, seat } = await makerAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(vault, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init maker", signature: null, note: `exists ${vault}` });
    return { vault, custody, seat, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitVaultInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    venueConfig: eventsConfig,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    maker,
    params,
  });
  const signature = await send(ctx, "init maker", [ix], `MakerVault ${vault}, custody ${custody}, seat ${seat}, maker ${maker}`);
  return { vault, custody, seat, signature };
}

/** Registers the maker's seat at `MAKER_AUTHORITY_INDEX`; every other authority is re-sent unchanged. */
export async function registerMakerSeat(ctx: SendContext): Promise<string | null> {
  const { seat } = await makerAddresses();
  return registerProgramSeat(ctx, MAKER_AUTHORITY_INDEX, seat, "maker");
}
