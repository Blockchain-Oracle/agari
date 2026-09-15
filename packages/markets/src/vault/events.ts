/**
 * agari-vault's `emit_cpi!` events (vault.md §7), decoded from a `getTransaction(…, { encoding: "json" })` result: an
 * inner instruction that invokes the vault program with the vault's event authority as its first account, whose data
 * is `EVENT_IX_TAG ‖ discriminator ‖ Borsh`. The write lanes book from `Executed`/`Settled`; the indexer reads all.
 */
import {
  ACCOUNT_OPENED_EVENT_DISCRIMINATOR,
  AGARI_VAULT_PROGRAM_ADDRESS,
  DEPOSITED_EVENT_DISCRIMINATOR,
  EXECUTED_EVENT_DISCRIMINATOR,
  getAccountOpenedEventDecoder,
  getDepositedEventDecoder,
  getExecutedEventDecoder,
  getGrantCreatedEventDecoder,
  getGrantFundedEventDecoder,
  getGrantRevokedEventDecoder,
  getPrivateMovedEventDecoder,
  getPrivateWithdrawnEventDecoder,
  getSettledEventDecoder,
  getVaultInitializedEventDecoder,
  getWithdrawnEventDecoder,
  GRANT_CREATED_EVENT_DISCRIMINATOR,
  GRANT_FUNDED_EVENT_DISCRIMINATOR,
  GRANT_REVOKED_EVENT_DISCRIMINATOR,
  PRIVATE_MOVED_EVENT_DISCRIMINATOR,
  PRIVATE_WITHDRAWN_EVENT_DISCRIMINATOR,
  SETTLED_EVENT_DISCRIMINATOR,
  VAULT_INITIALIZED_EVENT_DISCRIMINATOR,
  WITHDRAWN_EVENT_DISCRIMINATOR,
  type AccountOpenedEvent,
  type DepositedEvent,
  type ExecutedEvent,
  type GrantCreatedEvent,
  type GrantFundedEvent,
  type GrantRevokedEvent,
  type PrivateMovedEvent,
  type PrivateWithdrawnEvent,
  type SettledEvent,
  type VaultInitializedEvent,
  type WithdrawnEvent,
} from "@agari/clients/agari-vault";
import { getBase58Encoder, type ReadonlyUint8Array } from "@solana/kit";
import type { JsonTransaction } from "../submitter/events";
import { vaultEventAuthority } from "./accounts";

export type VaultEvent =
  | { name: "VaultInitialized"; data: VaultInitializedEvent }
  | { name: "AccountOpened"; data: AccountOpenedEvent }
  | { name: "Deposited"; data: DepositedEvent }
  | { name: "Withdrawn"; data: WithdrawnEvent }
  | { name: "PrivateMoved"; data: PrivateMovedEvent }
  | { name: "PrivateWithdrawn"; data: PrivateWithdrawnEvent }
  | { name: "GrantCreated"; data: GrantCreatedEvent }
  | { name: "GrantFunded"; data: GrantFundedEvent }
  | { name: "GrantRevoked"; data: GrantRevokedEvent }
  | { name: "Executed"; data: ExecutedEvent }
  | { name: "Settled"; data: SettledEvent };

export type VaultEventName = VaultEvent["name"];

type Decoder = { decode(bytes: ReadonlyUint8Array): unknown };
const EVENTS: ReadonlyArray<readonly [VaultEventName, ReadonlyUint8Array, () => Decoder]> = [
  ["VaultInitialized", VAULT_INITIALIZED_EVENT_DISCRIMINATOR, getVaultInitializedEventDecoder],
  ["AccountOpened", ACCOUNT_OPENED_EVENT_DISCRIMINATOR, getAccountOpenedEventDecoder],
  ["Deposited", DEPOSITED_EVENT_DISCRIMINATOR, getDepositedEventDecoder],
  ["Withdrawn", WITHDRAWN_EVENT_DISCRIMINATOR, getWithdrawnEventDecoder],
  ["PrivateMoved", PRIVATE_MOVED_EVENT_DISCRIMINATOR, getPrivateMovedEventDecoder],
  ["PrivateWithdrawn", PRIVATE_WITHDRAWN_EVENT_DISCRIMINATOR, getPrivateWithdrawnEventDecoder],
  ["GrantCreated", GRANT_CREATED_EVENT_DISCRIMINATOR, getGrantCreatedEventDecoder],
  ["GrantFunded", GRANT_FUNDED_EVENT_DISCRIMINATOR, getGrantFundedEventDecoder],
  ["GrantRevoked", GRANT_REVOKED_EVENT_DISCRIMINATOR, getGrantRevokedEventDecoder],
  ["Executed", EXECUTED_EVENT_DISCRIMINATOR, getExecutedEventDecoder],
  ["Settled", SETTLED_EVENT_DISCRIMINATOR, getSettledEventDecoder],
];

/** Anchor's `EVENT_IX_TAG` (`0x1d9acb512ea545e4`), little-endian. */
const EVENT_IX_TAG = Uint8Array.from([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);
const TAG = EVENT_IX_TAG.length;

const matches = (data: ReadonlyUint8Array, prefix: ReadonlyUint8Array, at: number) =>
  data.length >= at + prefix.length && prefix.every((byte, i) => data[at + i] === byte);

/** One event payload (after the tag) by its discriminator; null for anything that isn't a vault event. */
export function decodeVaultEventPayload(payload: ReadonlyUint8Array): VaultEvent | null {
  for (const [name, discriminator, decoder] of EVENTS) {
    if (matches(payload, discriminator, 0)) return { name, data: decoder().decode(payload) } as VaultEvent;
  }
  return null;
}

export interface LocatedVaultEvent {
  /** The top-level instruction whose execution emitted it, and its position among that instruction's inner ones. */
  outerIx: number;
  innerIx: number;
  event: VaultEvent;
}

/** Every vault event a successful transaction emitted, in order, with its position; none for a failed one. */
export async function decodeVaultEventsLocated(tx: JsonTransaction): Promise<LocatedVaultEvent[]> {
  if (!tx.meta || tx.meta.err !== null) return [];
  const authority = await vaultEventAuthority();
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const base58 = getBase58Encoder();
  const out: LocatedVaultEvent[] = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    group.instructions.forEach((ix, innerIx) => {
      if (keys[Number(ix.programIdIndex)] !== AGARI_VAULT_PROGRAM_ADDRESS || keys[Number(ix.accounts[0] ?? -1)] !== authority) return;
      const data = base58.encode(ix.data);
      if (!matches(data, EVENT_IX_TAG, 0)) return;
      const event = decodeVaultEventPayload(data.subarray(TAG));
      if (event) out.push({ outerIx: Number(group.index), innerIx, event });
    });
  }
  return out;
}

export async function decodeVaultEvents(tx: JsonTransaction): Promise<VaultEvent[]> {
  return (await decodeVaultEventsLocated(tx)).map(({ event }) => event);
}
