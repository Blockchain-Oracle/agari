/**
 * Whether a Window can trade through the vault (vault.md §3.4 R, D-063): the vault's seat PDA must be registered in
 * `GlobalConfig.program_authorities` at some index `i`, and the Window's Ledger must hold it at seat `i` with the
 * PROGRAM flag. A Window listed before registration keeps whoever claimed seat `i`, and the program refuses it (7207);
 * checking here refuses before any signature.
 */
import { getGlobalConfigDecoder } from "@agari/clients/agari-events";
import { diagnosis, type Address as CoreAddress, type Diagnosis } from "@agari/core/types";
import type { Address } from "@solana/kit";
import { loadAccount } from "../runtime/account-loader";
import { configAddress } from "../runtime/accounts";
import { decodeLedgerHeader, findSeat, SEAT_FLAG } from "../runtime/decode";
import { WINDOW_PREDATES_VAULT } from "./errors";

/** Registration changes only by an admin run of `set-authorities`; a few seconds' staleness can't admit a bad write. */
const AUTHORITIES_TTL_MS = 15_000;
let authorities: { atMs: number; keys: readonly string[] } | null = null;

async function programAuthorities(): Promise<readonly string[]> {
  if (authorities && Date.now() - authorities.atMs < AUTHORITIES_TTL_MS) return authorities.keys;
  const { bytes } = await loadAccount(await configAddress());
  if (!bytes) throw new Error("the venue's GlobalConfig is not readable");
  const keys = getGlobalConfigDecoder().decode(bytes).programAuthorities;
  authorities = { atMs: Date.now(), keys };
  return keys;
}

/** The seat index the vault trades from on this Window, or the refusal the program would give. */
export async function vaultSeatOn(seat: CoreAddress, ledger: CoreAddress): Promise<{ ok: true; index: number } | { ok: false; diagnosis: Diagnosis }> {
  const keys = await programAuthorities();
  const index = keys.indexOf(seat as string);
  if (index < 0) return { ok: false, diagnosis: diagnosis("not-deployed", `agari-vault's seat ${seat} is not a registered program authority on this venue`, { errorName: "VaultNotRegistered" }) };
  const { bytes } = await loadAccount(ledger as string as Address);
  if (!bytes) return { ok: false, diagnosis: diagnosis("market-not-trading", `the Window's Ledger ${ledger} is closed`) };
  const found = findSeat(bytes, seat as string as Address);
  if (!found || found.index !== index || (found.flags & SEAT_FLAG.program) === 0 || index >= decodeLedgerHeader(bytes).capacity) {
    return { ok: false, diagnosis: diagnosis("market-not-trading", `${WINDOW_PREDATES_VAULT}: seat ${index} of Ledger ${ledger} is not the vault's`, { errorName: "WindowPredatesVault" }) };
  }
  return { ok: true, index };
}
