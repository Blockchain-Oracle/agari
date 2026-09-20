/**
 * agari-vault bootstrap steps (vault.md §3.1, §5.1; D-063), ensure-style: `admin_init_vault` once, and the vault's
 * `["seat"]` PDA registered at its fixed `program_authorities` index. `admin_set_authorities` replaces every field, so
 * the registration re-sends the whole current set with only that index changed. The stage owner's
 * `scripts/deploy/{init-vault,set-authorities}.ts` and the Surfpool fork drive call these; server-only.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import { AGARI_VAULT_PROGRAM_ADDRESS, findSeatPda, findVaultConfigPda, getAdminInitVaultInstructionAsync } from "@agari/clients/agari-vault";
import { getAddressEncoder, getProgramDerivedAddress, type Address } from "@solana/kit";
import { registerProgramSeat } from "./program-seat";
import { send, type SendContext } from "./send";

const BPF_LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111" as Address;
/** The fixed table (D-063): 0 agari-vault · 1 agari-maker · 2 agari-leverage · 3 agari-private · 4 agari-arena. */
export const VAULT_AUTHORITY_INDEX = 0;

/** The vault's addresses for scripts (which never import the clients package): program id, ["seat"] and ["vault-config"] PDAs. */
export async function vaultAddresses(): Promise<{ program: Address; seat: Address; config: Address }> {
  const [seat] = await findSeatPda();
  const [config] = await findVaultConfigPda();
  return { program: AGARI_VAULT_PROGRAM_ADDRESS, seat, config };
}

export async function programDataAddress(program: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: BPF_LOADER_UPGRADEABLE, seeds: [getAddressEncoder().encode(program)] });
  return pda;
}

/** `admin_init_vault` signed by the client's payer, which must be the vault's upgrade authority; skipped when it exists. */
export async function initVault(ctx: SendContext): Promise<{ config: Address; signature: string | null }> {
  const [config] = await findVaultConfigPda();
  const existing = await ctx.client.rpc.getAccountInfo(config, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init vault", signature: null, note: `exists ${config}` });
    return { config, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitVaultInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    programData: await programDataAddress(AGARI_VAULT_PROGRAM_ADDRESS),
  });
  const signature = await send(ctx, "init vault", [ix], `VaultConfig ${config}, collateral ${venue.data.collateralMint}`);
  return { config, signature };
}

/** Registers the vault's seat at `VAULT_AUTHORITY_INDEX`, signed by the config admin; every other field is re-sent unchanged. */
export async function registerVaultSeat(ctx: SendContext): Promise<string | null> {
  const [seat] = await findSeatPda();
  return registerProgramSeat(ctx, VAULT_AUTHORITY_INDEX, seat, "vault");
}
