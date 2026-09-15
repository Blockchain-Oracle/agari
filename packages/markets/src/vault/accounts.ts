/**
 * agari-vault account reads (vault.md §2, tap-trading.md §1.1): an owner's `VaultAccount` (balances, live grant ids,
 * 16 inline position slots), a `Grant` by id, and the mapping onto core's vault types. Every read goes through the
 * batching loader; an owner's account read is shared for a second, so a snapshot, a holdings poll and the balance sheet
 * mounting together cost one request.
 */
import {
  AGARI_VAULT_PROGRAM_ADDRESS,
  findAccountPda,
  findCustodyPda,
  findGrantPda,
  getGrantDecoder,
  getVaultAccountDecoder,
  type Grant,
  type PositionSlot,
  type VaultAccount,
} from "@agari/clients/agari-vault";
import type { Address as CoreAddress } from "@agari/core/types";
import { grantKindOf, type VaultGrant } from "@agari/core/vault";
import { getProgramDerivedAddress, type Address } from "@solana/kit";
import { loadAccount } from "../runtime/account-loader";

type AnyAddress = Address | CoreAddress;
const kit = (value: AnyAddress) => value as Address;
const core = (value: Address) => value as string as CoreAddress;

/** How long one owner's account read is shared between callers. */
export const VAULT_ACCOUNT_SHARE_MS = 1_000;
/** `Market` default key: a free slot. */
const FREE_SLOT = "11111111111111111111111111111111";
/** Grant ids are 1-based and global; 0 means "attended" on a slot and "none" in `active_grants`. */
export const NO_GRANT = 0n;

const pdas = new Map<string, Promise<Address>>();
function cachedPda(key: string, derive: () => Promise<readonly [Address, number]>): Promise<Address> {
  let found = pdas.get(key);
  if (!found) {
    found = derive().then(([pda]) => pda);
    pdas.set(key, found);
  }
  return found;
}

export const vaultAccountAddress = (owner: AnyAddress) => cachedPda(`acct:${owner}`, () => findAccountPda({ owner: kit(owner) }));
export const custodyAddress = (owner: AnyAddress) => cachedPda(`custody:${owner}`, () => findCustodyPda({ owner: kit(owner) }));
export const grantAddress = (grantId: bigint) => cachedPda(`grant:${grantId}`, () => findGrantPda({ grantId }));
/** The vault's own `#[event_cpi]` authority (`["__event_authority"]`). */
export const vaultEventAuthority = () =>
  cachedPda("event-authority", () => getProgramDerivedAddress({ programAddress: AGARI_VAULT_PROGRAM_ADDRESS, seeds: ["__event_authority"] }));

const shared = new Map<string, { atMs: number; read: Promise<VaultAccount | null> }>();

/** The owner's `VaultAccount`, or null when they never opened one. Shared in flight for `VAULT_ACCOUNT_SHARE_MS`. */
export function readVaultAccount(owner: AnyAddress): Promise<VaultAccount | null> {
  const hit = shared.get(owner);
  if (hit && Date.now() - hit.atMs < VAULT_ACCOUNT_SHARE_MS) return hit.read;
  const read = vaultAccountAddress(owner)
    .then((address) => loadAccount(address))
    .then(({ bytes }) => (bytes ? getVaultAccountDecoder().decode(bytes) : null));
  shared.set(owner, { atMs: Date.now(), read });
  read.catch(() => shared.delete(owner));
  return read;
}

/** A write changed the owner's account: the next read goes to the chain. */
export function forgetVaultAccount(owner: AnyAddress): void {
  shared.delete(owner);
}

/** One grant by id; null when no grant has that id. */
export async function readGrantAccount(grantId: bigint): Promise<Grant | null> {
  const { bytes } = await loadAccount(await grantAddress(grantId));
  return bytes ? getGrantDecoder().decode(bytes) : null;
}

/**
 * A `Grant` in core terms. Caps are base units except the price cap, which the program keeps in own-side ticks:
 * `maxPriceRaw = max_price_ticks × tick_base` (0 = no cap).
 */
export function toVaultGrant(grant: Grant, tickBase: bigint): VaultGrant {
  return {
    grantId: grant.grantId,
    owner: core(grant.owner),
    actor: core(grant.actor),
    kind: grantKindOf(grant.kind),
    revoked: grant.revoked !== 0,
    expiresAtSec: Number(grant.expiresAtSec),
    spentDay: Number(grant.spentDay),
    spentTodayBase: grant.spentToday,
    openPositions: grant.openPositions,
    caps: {
      maxStakePerTradeBase: grant.maxStakePerTrade,
      maxDailySpendBase: grant.maxDailySpend,
      maxOpenPositions: grant.maxOpenPositions,
      maxPriceRaw: BigInt(grant.maxPriceTicks) * tickBase,
    },
    budgetBase: grant.budget,
  };
}

/** The owner's slot on one Window, or null when they hold nothing there through the vault. */
export function slotOf(account: VaultAccount | null, market: AnyAddress): PositionSlot | null {
  if (!account || market === FREE_SLOT) return null;
  return account.positions.find((slot) => slot.market === (market as string)) ?? null;
}

/** Lots and attribution of one side of a slot (outcome 0 = Up/YES, 1 = Down/NO). */
export function sideOf(slot: PositionSlot | null, outcome: 0 | 1): { lots: bigint; grantId: bigint } {
  if (!slot) return { lots: 0n, grantId: NO_GRANT };
  return outcome === 0 ? { lots: slot.yesLots, grantId: slot.yesGrant } : { lots: slot.noLots, grantId: slot.noGrant };
}

/** Venue-wide `tick_base = 10^decimals / 1000` (events-instructions.md §1.4 check 3). */
export function tickBaseOf(decimals: number): bigint {
  return 10n ** BigInt(decimals) / 1000n;
}
