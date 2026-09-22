/**
 * agari-desk's `emit_cpi!` events (desk.md §4.7) decoded from a `getTransaction(…, { encoding: "json" })` result, and
 * a desk's history by signature (`getSignaturesForAddress` on the desk PDA). Reconcile (C4) replays `seq`/`head` from
 * the sealed events; the decision page's Proof section (C5) compares a record's fingerprint with the event's.
 */
import {
  AGARI_DESK_PROGRAM_ADDRESS,
  ATTESTORS_SET_EVENT_DISCRIMINATOR,
  BOUGHT_EVENT_DISCRIMINATOR,
  CHECKPOINT_EVENT_DISCRIMINATOR,
  CONFIG_INITIALIZED_EVENT_DISCRIMINATOR,
  DEPOSITED_EVENT_DISCRIMINATOR,
  DESK_OPENED_EVENT_DISCRIMINATOR,
  getAttestorsSetEventDecoder,
  getBoughtEventDecoder,
  getCheckpointEventDecoder,
  getConfigInitializedEventDecoder,
  getDepositedEventDecoder,
  getDeskOpenedEventDecoder,
  getLimitsSetEventDecoder,
  getModeSetEventDecoder,
  getOperatorRevokedEventDecoder,
  getOperatorSetEventDecoder,
  getPausedEventDecoder,
  getReferenceFeedSetEventDecoder,
  getReferenceInitializedEventDecoder,
  getReferencePostedEventDecoder,
  getSoldEventDecoder,
  getTokenAllowedEventDecoder,
  getTokenDisallowedEventDecoder,
  getUnpausedEventDecoder,
  getWithdrawnEventDecoder,
  LIMITS_SET_EVENT_DISCRIMINATOR,
  MODE_SET_EVENT_DISCRIMINATOR,
  OPERATOR_REVOKED_EVENT_DISCRIMINATOR,
  OPERATOR_SET_EVENT_DISCRIMINATOR,
  PAUSED_EVENT_DISCRIMINATOR,
  REFERENCE_FEED_SET_EVENT_DISCRIMINATOR,
  REFERENCE_INITIALIZED_EVENT_DISCRIMINATOR,
  REFERENCE_POSTED_EVENT_DISCRIMINATOR,
  SOLD_EVENT_DISCRIMINATOR,
  TOKEN_ALLOWED_EVENT_DISCRIMINATOR,
  TOKEN_DISALLOWED_EVENT_DISCRIMINATOR,
  UNPAUSED_EVENT_DISCRIMINATOR,
  WITHDRAWN_EVENT_DISCRIMINATOR,
} from "@agari/clients/agari-desk";
import type { Hash32 } from "@agari/core/types";
import { getBase58Encoder, type Address, type ReadonlyUint8Array, type Rpc, type Signature, type SolanaRpcApi } from "@solana/kit";
import type { JsonTransaction } from "../submitter/events";
import { deskEventAuthority } from "./deployment";

type Decoder = { decode(bytes: ReadonlyUint8Array): unknown };
const EVENTS = [
  ["ConfigInitialized", CONFIG_INITIALIZED_EVENT_DISCRIMINATOR, getConfigInitializedEventDecoder],
  ["AttestorsSet", ATTESTORS_SET_EVENT_DISCRIMINATOR, getAttestorsSetEventDecoder],
  ["ReferenceInitialized", REFERENCE_INITIALIZED_EVENT_DISCRIMINATOR, getReferenceInitializedEventDecoder],
  ["ReferenceFeedSet", REFERENCE_FEED_SET_EVENT_DISCRIMINATOR, getReferenceFeedSetEventDecoder],
  ["ReferencePosted", REFERENCE_POSTED_EVENT_DISCRIMINATOR, getReferencePostedEventDecoder],
  ["DeskOpened", DESK_OPENED_EVENT_DISCRIMINATOR, getDeskOpenedEventDecoder],
  ["TokenAllowed", TOKEN_ALLOWED_EVENT_DISCRIMINATOR, getTokenAllowedEventDecoder],
  ["TokenDisallowed", TOKEN_DISALLOWED_EVENT_DISCRIMINATOR, getTokenDisallowedEventDecoder],
  ["Deposited", DEPOSITED_EVENT_DISCRIMINATOR, getDepositedEventDecoder],
  ["Withdrawn", WITHDRAWN_EVENT_DISCRIMINATOR, getWithdrawnEventDecoder],
  ["LimitsSet", LIMITS_SET_EVENT_DISCRIMINATOR, getLimitsSetEventDecoder],
  ["ModeSet", MODE_SET_EVENT_DISCRIMINATOR, getModeSetEventDecoder],
  ["OperatorSet", OPERATOR_SET_EVENT_DISCRIMINATOR, getOperatorSetEventDecoder],
  ["OperatorRevoked", OPERATOR_REVOKED_EVENT_DISCRIMINATOR, getOperatorRevokedEventDecoder],
  ["Paused", PAUSED_EVENT_DISCRIMINATOR, getPausedEventDecoder],
  ["Unpaused", UNPAUSED_EVENT_DISCRIMINATOR, getUnpausedEventDecoder],
  ["Bought", BOUGHT_EVENT_DISCRIMINATOR, getBoughtEventDecoder],
  ["Sold", SOLD_EVENT_DISCRIMINATOR, getSoldEventDecoder],
  ["Checkpoint", CHECKPOINT_EVENT_DISCRIMINATOR, getCheckpointEventDecoder],
] as const satisfies ReadonlyArray<readonly [string, ReadonlyUint8Array, () => Decoder]>;

export type DeskEventName = (typeof EVENTS)[number][0];
type DecodedOf<N extends DeskEventName> = ReturnType<ReturnType<Extract<(typeof EVENTS)[number], readonly [N, ReadonlyUint8Array, () => Decoder]>[2]>["decode"]>;
export type DeskEvent = { [N in DeskEventName]: { name: N; data: DecodedOf<N> } }[DeskEventName];

/** Anchor's `EVENT_IX_TAG` (`0x1d9acb512ea545e4`), little-endian. */
const EVENT_IX_TAG = Uint8Array.from([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);
const TAG = EVENT_IX_TAG.length;
const matches = (data: ReadonlyUint8Array, prefix: ReadonlyUint8Array, at: number) => data.length >= at + prefix.length && prefix.every((byte, i) => data[at + i] === byte);

/** One event payload (after the tag) by its discriminator; null for anything that is not a desk event. */
export function decodeDeskEventPayload(payload: ReadonlyUint8Array): DeskEvent | null {
  for (const [name, discriminator, decoder] of EVENTS) {
    if (matches(payload, discriminator, 0)) return { name, data: decoder().decode(payload) } as DeskEvent;
  }
  return null;
}

export interface LocatedDeskEvent {
  outerIx: number;
  innerIx: number;
  event: DeskEvent;
}

/** Every desk event a successful transaction emitted, in order; none for a failed one. */
export async function decodeDeskEvents(tx: JsonTransaction): Promise<LocatedDeskEvent[]> {
  if (!tx.meta || tx.meta.err !== null) return [];
  const authority = await deskEventAuthority();
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const base58 = getBase58Encoder();
  const out: LocatedDeskEvent[] = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    group.instructions.forEach((ix, innerIx) => {
      if (keys[Number(ix.programIdIndex)] !== AGARI_DESK_PROGRAM_ADDRESS || keys[Number(ix.accounts[0] ?? -1)] !== authority) return;
      const data = base58.encode(ix.data);
      if (!matches(data, EVENT_IX_TAG, 0)) return;
      const event = decodeDeskEventPayload(data.subarray(TAG));
      if (event) out.push({ outerIx: Number(group.index), innerIx, event });
    });
  }
  return out;
}

const hex = (bytes: ReadonlyUint8Array): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** What an action sealed: the `seq`, `head` and `decision_hash` of a `Bought`, `Sold` or `Checkpoint`. */
export interface SealedAction {
  kind: "Bought" | "Sold" | "Checkpoint";
  seq: bigint;
  head: Hash32;
  decisionHash: Hash32;
}

export function sealedActionsOf(events: readonly DeskEvent[]): SealedAction[] {
  const out: SealedAction[] = [];
  for (const e of events) {
    if (e.name === "Bought" || e.name === "Sold" || e.name === "Checkpoint") out.push({ kind: e.name, seq: e.data.seq, head: hex(e.data.head), decisionHash: hex(e.data.decisionHash) });
  }
  return out;
}

export interface DeskHistoryEntry {
  signature: Signature;
  slot: bigint;
  blockTimeSec: number | null;
  failed: boolean;
  events: DeskEvent[];
}

const TX_OPTIONS = { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" } as const;

/** The desk events of one confirmed transaction (empty for a failed or unknown one). */
export async function readDeskEventsOf(rpc: Rpc<SolanaRpcApi>, signature: Signature): Promise<DeskEvent[]> {
  const tx = await rpc.getTransaction(signature, TX_OPTIONS).send();
  if (!tx) return [];
  return (await decodeDeskEvents(tx as unknown as JsonTransaction)).map(({ event }) => event);
}

/**
 * The newest `limit` transactions that touched `desk`, newest first, with their events. Failed ones are listed with
 * no events, so the prove-limits transactions (C6) show up as what they are.
 */
export async function readDeskHistory(rpc: Rpc<SolanaRpcApi>, desk: Address, options: { limit?: number; before?: Signature } = {}): Promise<DeskHistoryEntry[]> {
  const signatures = await rpc.getSignaturesForAddress(desk, { limit: options.limit ?? 50, ...(options.before ? { before: options.before } : {}), commitment: "confirmed" }).send();
  const out: DeskHistoryEntry[] = [];
  for (const s of signatures) {
    const failed = s.err !== null;
    const events = failed ? [] : await readDeskEventsOf(rpc, s.signature);
    out.push({ signature: s.signature, slot: s.slot, blockTimeSec: s.blockTime === null || s.blockTime === undefined ? null : Number(s.blockTime), failed, events });
  }
  return out;
}
