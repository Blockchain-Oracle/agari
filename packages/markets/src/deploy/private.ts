/**
 * agari-private bootstrap (S10d), ensure-style: `admin_init_desk` once, naming the desk key, and the desk's `["seat"]`
 * PDA registered at `program_authorities[3]` (D-063). Without the registration the engine gives the desk no PROGRAM
 * seat and every mint refuses with `DeskNotRegistered`, so the two steps go together.
 *
 * Only the program's upgrade authority may initialise the desk (D-117), so the payer here is the deployer. The desk
 * key is a different key on purpose: it is the one the web's desk service signs with, and it can never withdraw.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_PRIVATE_PROGRAM_ADDRESS, findCustodyPda, findDeskAccountPda, findSeatPda,
  getAdminInitDeskInstructionAsync, type PrivateParamsArgs,
} from "@agari/clients/agari-private";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { registerProgramSeat } from "./program-seat";
import { send, type SendContext } from "./send";
import { programDataAddress } from "./vault";

/** The fixed table (D-063). The desk's seat lives at 3 and nowhere else. */
export const PRIVATE_AUTHORITY_INDEX = 3;

/** tUSDC has 6 decimals, so one whole unit is 1e6 base units. */
const UNIT = 1_000_000n;

/**
 * The reference's own launch parameters (`DeployPrivateDesk.s.sol`), unchanged: a 1 to 25 tUSDC stake band per slot,
 * and no mints inside the last 60 s of a Window, where the three-transaction open cannot land.
 */
export const DEVNET_PRIVATE_PARAMS: PrivateParamsArgs = { minStakeBase: 1n * UNIT, maxStakeBase: 25n * UNIT, minTimeLeftSec: 60 };

/** The desk's addresses for scripts, which never import the clients package. */
export async function privateAddresses(): Promise<{ program: Address; desk: Address; custody: Address; seat: Address }> {
  const [desk] = await findDeskAccountPda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  return { program: AGARI_PRIVATE_PROGRAM_ADDRESS, desk, custody, seat };
}

/** `admin_init_desk` signed by the client's payer, which must be the upgrade authority; skipped when it exists. */
export async function initPrivateDesk(
  ctx: SendContext,
  deskKey: Address,
  params: PrivateParamsArgs = DEVNET_PRIVATE_PARAMS,
): Promise<{ desk: Address; custody: Address; seat: Address; signature: string | null }> {
  const { desk, custody, seat } = await privateAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(desk, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init private", signature: null, note: `exists ${desk}` });
    return { desk, custody, seat, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitDeskInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    programData: await programDataAddress(AGARI_PRIVATE_PROGRAM_ADDRESS),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    desk: deskKey,
    params,
  });
  const signature = await send(ctx, "init private", [ix], `Desk ${desk}, custody ${custody}, seat ${seat}, desk key ${deskKey}`);
  return { desk, custody, seat, signature };
}

/** Registers the desk's seat at `PRIVATE_AUTHORITY_INDEX`; every other authority is re-sent unchanged. */
export async function registerPrivateSeat(ctx: SendContext): Promise<string | null> {
  const { seat } = await privateAddresses();
  return registerProgramSeat(ctx, PRIVATE_AUTHORITY_INDEX, seat, "private desk");
}
