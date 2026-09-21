/**
 * Where agari-vault lives on the configured cluster (tap-trading.md §1.1, D-069). The program id comes from env
 * (`NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID`), but env alone never makes it deployed: `.env.local` carries the id before
 * the program exists, so a deployment counts only once its `VaultConfig` account has been read (stage-07 Handoff).
 */
import { AGARI_VAULT_PROGRAM_ADDRESS, findSeatPda, findVaultConfigPda, getVaultConfigDecoder } from "@agari/clients/agari-vault";
import { CLUSTER_ID, DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import type { Address as CoreAddress } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import type { Address } from "@solana/kit";
import { getAddressDecoder } from "@solana/kit";
import type { MarketsEnv } from "../env";
import { loadAccount, loadAccounts } from "../runtime/account-loader";
import { peekClient, peekVaultProbe, recordVaultProbe } from "../runtime/read-runtime";

/** An absent `VaultConfig` is asked about again after this long, so a fresh deploy is picked up without a reload. */
export const VAULT_ABSENT_RECHECK_MS = 30_000;
/** `UpgradeableLoaderState::ProgramData { slot, … }`: the u64 deploy slot after the 4-byte tag. */
const PROGRAM_DATA_SLOT = { offset: 4, length: 8 } as const;
/** `UpgradeableLoaderState::Program { programdata_address }` after the 4-byte tag. */
const PROGRAM_DATA_ADDRESS_AT = 4;

type VaultEnv = Partial<Pick<MarketsEnv, "vaultProgramId" | "cluster">>;

let inflight: { programId: string; read: Promise<VaultDeployment | null> } | null = null;

/**
 * The program the client is built against, when nothing overrides it — as every other product program resolves it
 * (`rangeProgramId`, `leverageProgramId`, …).
 *
 * It used to return null with no env var, which reads as "no vault on this cluster" and is a different claim
 * entirely. An ops actor started without `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` therefore believed no Trading Balance
 * existed, and the strategy runner refused every subscriber it had — reported as "grant not live", with four live
 * grants on chain. Nothing is asserted by this fallback that the next line does not already require: an id that is
 * not the client's own is refused, so the only id this can be is the one below. Whether the program is *deployed*
 * is still decided by reading its `VaultConfig`, which is the point of the probe.
 */
function programIdOf(env: VaultEnv | undefined): CoreAddress | null {
  return env?.vaultProgramId ?? peekClient()?.vaultProgramId ?? (AGARI_VAULT_PROGRAM_ADDRESS as string as CoreAddress);
}

/**
 * The confirmed deployment for `env`'s program id, synchronously: null until a read in this process has found the
 * `VaultConfig` (and null again while it is known absent). Surfaces that must know for sure await `loadVaultDeployment`.
 */
export function resolveVaultDeployment(env?: VaultEnv): VaultDeployment | null {
  const programId = programIdOf(env);
  const probe = peekVaultProbe();
  return programId && probe?.programId === programId ? probe.deployment : null;
}

async function probe(programId: Address, chainId: number): Promise<VaultDeployment | null> {
  const [[config], [seat]] = await Promise.all([findVaultConfigPda({ programAddress: programId }), findSeatPda({ programAddress: programId })]);
  const [configAccount, programAccount] = await loadAccounts([config, programId]);
  if (!configAccount?.bytes || !programAccount?.bytes) return null;
  const data = getVaultConfigDecoder().decode(configAccount.bytes);
  if (data.seat !== seat) throw new Error(`VaultConfig ${config} names seat ${data.seat}, but the program's seat PDA is ${seat}`);
  const programData = getAddressDecoder().decode(programAccount.bytes.subarray(PROGRAM_DATA_ADDRESS_AT, PROGRAM_DATA_ADDRESS_AT + 32));
  const { bytes: slotBytes } = await loadAccount(programData, PROGRAM_DATA_SLOT);
  const fromBlock = slotBytes ? new DataView(slotBytes.buffer, slotBytes.byteOffset, slotBytes.byteLength).getBigUint64(0, true) : 0n;
  const as = (value: Address) => value as string as CoreAddress;
  return { chainId, eventVault: as(programId), seat: as(seat), config: as(config), collateral: as(data.collateralMint), fromBlock };
}

/**
 * Reads the program's `VaultConfig` (and its deploy slot, once) and records the answer for every reader of this
 * runtime. Null when no program id is configured or the config account does not exist. A configured id that is not
 * the generated client's program is a misconfiguration, never a second vault.
 */
export async function loadVaultDeployment(env?: VaultEnv): Promise<VaultDeployment | null> {
  const programId = programIdOf(env);
  if (!programId) return null;
  if (programId !== (AGARI_VAULT_PROGRAM_ADDRESS as string)) {
    throw new Error(`NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID ${programId} is not the agari-vault client's program ${AGARI_VAULT_PROGRAM_ADDRESS}`);
  }
  const known = peekVaultProbe();
  if (known?.programId === programId && (known.deployment || Date.now() - known.checkedAtMs < VAULT_ABSENT_RECHECK_MS)) return known.deployment;
  if (inflight?.programId !== programId) {
    const cluster = (env?.cluster ?? peekClient()?.cluster ?? DEFAULT_CLUSTER) as Cluster;
    const read = probe(programId as string as Address, CLUSTER_ID[cluster])
      .then((deployment) => {
        recordVaultProbe({ programId, deployment, checkedAtMs: Date.now() });
        return deployment;
      })
      .finally(() => {
        if (inflight?.read === read) inflight = null;
      });
    inflight = { programId, read };
  }
  return inflight.read;
}
