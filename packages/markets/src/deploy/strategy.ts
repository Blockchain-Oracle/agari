/**
 * agari-strategy bootstrap (S9), ensure-style: `admin_init_registry` once. The registry has no parameters and no
 * custody: all it keeps is the next strategy id and the mint subscription fees move in, which is the venue's own.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import { AGARI_STRATEGY_PROGRAM_ADDRESS, findRegistryPda, getAdminInitRegistryInstructionAsync } from "@agari/clients/agari-strategy";
import type { Address } from "@solana/kit";
import { send, type SendContext } from "./send";

export async function strategyAddresses(): Promise<{ program: Address; registry: Address }> {
  const [registry] = await findRegistryPda();
  return { program: AGARI_STRATEGY_PROGRAM_ADDRESS, registry };
}

/** `admin_init_registry` signed by the client's payer; skipped when the registry already exists. */
export async function initStrategyRegistry(ctx: SendContext): Promise<{ registry: Address; signature: string | null }> {
  const { registry } = await strategyAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(registry, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init strategy", signature: null, note: `exists ${registry}` });
    return { registry, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitRegistryInstructionAsync({ admin: ctx.client.payer, collateralMint: venue.data.collateralMint });
  const signature = await send(ctx, "init strategy", [ix], `Registry ${registry}, fees in ${venue.data.collateralMint}`);
  return { registry, signature };
}
