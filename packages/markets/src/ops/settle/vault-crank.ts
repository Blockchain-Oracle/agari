/**
 * The settler's vault crank (vault.md §5.1 step 5, D-068): after `SETTLER_REDEEM_GRACE_SEC`, every owner holding a
 * slot on the settled Window is cranked with `public_crank_settle` (the settler's key pays the fee; the payout lands on
 * the owner), and only then can the Ledger close. Owners come from the index when it can name them; otherwise one
 * `getProgramAccounts` over the vault's accounts (boot and slow refreshes only). Builders only: the actor sends.
 */
import { AGARI_VAULT_PROGRAM_ADDRESS, getVaultAccountDecoder, VAULT_ACCOUNT_DISCRIMINATOR, type VaultAccount } from "@agari/clients/agari-vault";
import { getBase58Decoder, getBase64Encoder, type Address, type Base58EncodedBytes, type Instruction } from "@solana/kit";
import { slotOf, vaultAccountAddress } from "../../vault/accounts";
import { crankIx } from "../../vault/instructions";
import type { OpsClient } from "../client";
import type { MarketView } from "../venue";

/** One owner's unsettled slot on a Window: what the crank redeems and which grants' counters it releases. */
export interface VaultCrank {
  owner: Address;
  yesLots: bigint;
  noLots: bigint;
  yesGrant: bigint;
  noGrant: bigint;
}

const MULTIPLE_ACCOUNTS_MAX = 100;
const bytesOf = (b64: string) => getBase64Encoder().encode(b64);

function crankOf(account: VaultAccount, market: Address): VaultCrank | null {
  const slot = slotOf(account, market);
  return slot ? { owner: account.owner, yesLots: slot.yesLots, noLots: slot.noLots, yesGrant: slot.yesGrant, noGrant: slot.noGrant } : null;
}

async function accountsOf(client: OpsClient, owners: readonly Address[]): Promise<VaultAccount[]> {
  const out: VaultAccount[] = [];
  const addresses = await Promise.all(owners.map((owner) => vaultAccountAddress(owner)));
  for (let i = 0; i < addresses.length; i += MULTIPLE_ACCOUNTS_MAX) {
    const { value } = await client.rpc.getMultipleAccounts(addresses.slice(i, i + MULTIPLE_ACCOUNTS_MAX), { encoding: "base64" }).send();
    for (const account of value) if (account) out.push(getVaultAccountDecoder().decode(bytesOf(account.data[0])));
  }
  return out;
}

async function allAccounts(client: OpsClient): Promise<VaultAccount[]> {
  const rows = await client.rpc
    .getProgramAccounts(AGARI_VAULT_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [{ memcmp: { offset: 0n, bytes: getBase58Decoder().decode(VAULT_ACCOUNT_DISCRIMINATOR) as Base58EncodedBytes, encoding: "base58" } }],
    })
    .send();
  return rows.map((row) => getVaultAccountDecoder().decode(bytesOf(row.account.data[0])));
}

/**
 * Every owner with a slot on `market`, each a crank to send. `owners` narrows the read to the index's candidates (an
 * owner who holds nothing there is skipped); without it the whole program is scanned.
 */
export async function planVaultCranks(client: OpsClient, market: Address, owners?: readonly Address[]): Promise<VaultCrank[]> {
  const accounts = owners ? await accountsOf(client, owners) : await allAccounts(client);
  return accounts.map((account) => crankOf(account, market)).filter((crank): crank is VaultCrank => crank !== null);
}

/** `public_crank_settle` for one planned owner, the settler's key as cranker (fee payer only). */
export function vaultCrankInstruction(client: OpsClient, m: MarketView, collateralMint: Address, crank: VaultCrank): Promise<Instruction> {
  const engine = { series: m.data.series, market: m.address, ledger: m.data.ledger, mvault: m.data.mvault, collateralMint };
  return crankIx(client.payer, crank.owner, engine, { yes: crank.yesGrant, no: crank.noGrant });
}
