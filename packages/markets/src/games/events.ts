import {
  getAgentAuthorizedEventDecoder, getCardSettledEventDecoder, getCreditClaimedEventDecoder, getDeckRevealedEventDecoder, getMatchCreatedEventDecoder,
  getMatchFinalizedEventDecoder, getMatchJoinedEventDecoder, getMatchRefundedEventDecoder, getPickFilledEventDecoder, getPicksLockedEventDecoder,
  AGENT_AUTHORIZED_EVENT_DISCRIMINATOR, CARD_SETTLED_EVENT_DISCRIMINATOR, CREDIT_CLAIMED_EVENT_DISCRIMINATOR, DECK_REVEALED_EVENT_DISCRIMINATOR,
  MATCH_CREATED_EVENT_DISCRIMINATOR, MATCH_FINALIZED_EVENT_DISCRIMINATOR, MATCH_JOINED_EVENT_DISCRIMINATOR, MATCH_REFUNDED_EVENT_DISCRIMINATOR,
  PICK_FILLED_EVENT_DISCRIMINATOR, PICKS_LOCKED_EVENT_DISCRIMINATOR,
} from "@agari/clients/agari-arena";
import { arenaRefundReasonOf, arenaStatusOf, pickOf, type ArenaEvent, type ArenaEventLog } from "@agari/core/games";
import { err, ok, type Reading } from "@agari/core/schemas";
import type { Address, MarketId, Signature } from "@agari/core/types";
import { getBase64Encoder, type ReadonlyUint8Array } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { nowMs } from "../provider/clock";
import { withReading } from "../provider/reading";
import { solana } from "../runtime/solana";
import { arenaProgramId, idHex, kit } from "./deployment";

const DEFAULT_KEY = "11111111111111111111111111111111";
const addr = (value: string) => value as string as Address;
/** The default key is how the program says "nobody": a tie's winner, a lock with no forfeit, a revoked key. */
const addrOrNull = (value: string) => (value === DEFAULT_KEY ? null : addr(value));

type Decode = (bytes: ReadonlyUint8Array) => ArenaEvent;

/** Every event the projector understands, by its eight-byte discriminator. Admin and season events are not a duel's story. */
const TABLE: ReadonlyArray<readonly [ReadonlyUint8Array, Decode]> = [
  [MATCH_CREATED_EVENT_DISCRIMINATOR, (b) => { const e = getMatchCreatedEventDecoder().decode(b); return { kind: "created", matchId: idHex(e.matchId), creator: addr(e.creator), tier: e.tier, potBase: e.potBase, deckHash: idHex(e.deckHash), deckSize: e.deckSize, joinDeadlineSec: Number(e.joinDeadlineSec) }; }],
  [MATCH_JOINED_EVENT_DISCRIMINATOR, (b) => { const e = getMatchJoinedEventDecoder().decode(b); return { kind: "joined", matchId: idHex(e.matchId), challenger: addr(e.challenger), potBase: e.potBase, revealDeadlineSec: Number(e.revealDeadlineSec) }; }],
  [DECK_REVEALED_EVENT_DISCRIMINATOR, (b) => { const e = getDeckRevealedEventDecoder().decode(b); return { kind: "revealed", matchId: idHex(e.matchId), policyVersion: e.policyVersion, cards: e.cards.map((c) => c as string as MarketId), pickDeadlineSec: Number(e.pickDeadlineSec) }; }],
  [PICK_FILLED_EVENT_DISCRIMINATOR, (b) => { const e = getPickFilledEventDecoder().decode(b); return { kind: "picked", matchId: idHex(e.matchId), player: addr(e.player), marketId: e.market as string as MarketId, cardIndex: e.cardIndex, pick: pickOf(e.outcome), quantity: e.quantityRaw, costBase: e.costBase, refundBase: e.refundBase }; }],
  [PICKS_LOCKED_EVENT_DISCRIMINATOR, (b) => { const e = getPicksLockedEventDecoder().decode(b); return { kind: "locked", matchId: idHex(e.matchId), status: arenaStatusOf(Number(e.status)), forfeitedBy: addrOrNull(e.forfeitedBy) }; }],
  [CARD_SETTLED_EVENT_DISCRIMINATOR, (b) => { const e = getCardSettledEventDecoder().decode(b); return { kind: "settled", matchId: idHex(e.matchId), player: addr(e.player), marketId: e.market as string as MarketId, cardIndex: e.cardIndex, payoutBase: e.payoutBase, pnlBase: e.pnlBase }; }],
  [MATCH_FINALIZED_EVENT_DISCRIMINATOR, (b) => { const e = getMatchFinalizedEventDecoder().decode(b); return { kind: "finalized", matchId: idHex(e.matchId), winner: addrOrNull(e.winner), creatorPnlBase: e.creatorPnlBase, challengerPnlBase: e.challengerPnlBase, potAwardedBase: e.potAwardedBase }; }],
  [MATCH_REFUNDED_EVENT_DISCRIMINATOR, (b) => { const e = getMatchRefundedEventDecoder().decode(b); return { kind: "refunded", matchId: idHex(e.matchId), reason: arenaRefundReasonOf(Number(e.reason)), perPlayerBase: e.perPlayerBase }; }],
  [CREDIT_CLAIMED_EVENT_DISCRIMINATOR, (b) => { const e = getCreditClaimedEventDecoder().decode(b); return { kind: "claimed", player: addr(e.player), amountBase: e.amountBase, by: addr(e.by) }; }],
  [AGENT_AUTHORIZED_EVENT_DISCRIMINATOR, (b) => { const e = getAgentAuthorizedEventDecoder().decode(b); return { kind: "agent", matchId: idHex(e.matchId), player: addr(e.player), agent: addrOrNull(e.agent), expiresAtSec: Number(e.expiresAtSec), budgetBase: e.budgetBase }; }],
];

const startsWith = (bytes: ReadonlyUint8Array, prefix: ReadonlyUint8Array) => prefix.every((b, i) => bytes[i] === b);

/** One `Program data:` line as an arena event, or null when it is somebody else's or one the projector does not read. */
export function decodeArenaEvent(base64: string): ArenaEvent | null {
  let bytes: ReadonlyUint8Array;
  try {
    bytes = getBase64Encoder().encode(base64);
  } catch {
    return null;
  }
  const row = TABLE.find(([discriminator]) => startsWith(bytes, discriminator));
  return row ? row[1](bytes) : null;
}

const DATA = "Program data: ";

/**
 * The arena's events out of one transaction's logs, in log order. Only lines logged while `agari-arena` is the
 * running program count: the engine logs its own `Program data:` lines inside the arena's CPIs, and an event is
 * somebody's word only if that somebody said it.
 */
export function arenaEventsOf(logs: readonly string[], program: string): ArenaEvent[] {
  const out: ArenaEvent[] = [];
  const stack: string[] = [];
  for (const line of logs) {
    const invoke = /^Program (\w+) invoke \[\d+\]$/.exec(line);
    if (invoke?.[1]) stack.push(invoke[1]);
    else if (/^Program \w+ (success|failed)/.test(line)) stack.pop();
    else if (line.startsWith(DATA) && stack[stack.length - 1] === program) {
      const event = decodeArenaEvent(line.slice(DATA.length));
      if (event) out.push(event);
    }
  }
  return out;
}

/** The newest slot the projector may read up to. Confirmed, not finalized: a duel is played in minutes. */
export function arenaHeadBlock(): Promise<Reading<bigint>> {
  return withReading("arena:head", async () => BigInt(await solana().rpc.getSlot({ commitment: "confirmed" }).send()));
}

/**
 * Every arena event in a slot range, in chain order. Solana has no log query by range, so this walks the program's
 * signatures newest first until it passes `fromSlot`, keeps the ones inside the range, and reads each transaction's
 * logs. Failed transactions carry no events: a refused instruction logged nothing that happened.
 *
 * It never answers with a kept value. `withReading` would hand back the last good list when a read fails, and the
 * last good list belongs to another slot range: a projector fed it would replay old events as new ones.
 */
export async function listArenaEvents(fromSlot: bigint, toSlot: bigint): Promise<Reading<readonly ArenaEventLog[]>> {
  try {
    const program = arenaProgramId();
    const inRange: { signature: string; slot: bigint; blockTime: number }[] = [];
    let before: string | undefined;
    for (let page = 0; page < 50; page += 1) {
      const rows = await solana().rpc.getSignaturesForAddress(kit(program), { limit: 1000, commitment: "confirmed", ...(before ? { before: before as never } : {}) }).send();
      for (const row of rows) {
        const slot = BigInt(row.slot);
        if (slot >= fromSlot && slot <= toSlot && row.err === null) inRange.push({ signature: row.signature, slot, blockTime: Number(row.blockTime ?? 0n) });
      }
      const last = rows[rows.length - 1];
      if (!last || rows.length < 1000 || BigInt(last.slot) < fromSlot) break;
      before = last.signature;
    }
    inRange.reverse();

    const out: ArenaEventLog[] = [];
    for (const row of inRange) {
      const tx = await solana().rpc.getTransaction(row.signature as never, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send();
      const events = arenaEventsOf(tx?.meta?.logMessages ?? [], program);
      events.forEach((event, logIndex) => out.push({ event, blockNumber: row.slot, txHash: row.signature as Signature, logIndex, blockTimeSec: row.blockTime }));
    }
    return ok(out, nowMs());
  } catch (error) {
    return err(diagnose(error));
  }
}
