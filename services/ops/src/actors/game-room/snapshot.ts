import {
  arenaPickKey,
  fullDeckMask,
  settleMatch,
  stakeTier,
  stakeTierIdOf,
  type ArenaMatch,
  type CardReceipt,
  type DeckCard,
  type MatchOutcome,
  type MatchState,
  type RefundReason,
  type RoomErrorCode,
  type Seat,
} from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, MarketId } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { getArenaMatch, type ArenaMatchView } from "@masayume/markets/games";

/**
 * A whole match, rebuilt from the chain — the reconnect path, and the reason the room may hold nothing
 * durable of its own.
 *
 * Every field here comes from `matchOf`, `deckOf`, `pnlOf` and the venue's own Windows. Nothing is
 * remembered from the socket that disconnected, which is what makes "a process restart and a browser
 * reconnect both reconstruct an active match" a property of the design rather than of an uptime target.
 *
 * The two facts the record cannot carry are handled explicitly rather than guessed at:
 *
 * - **The winner** is not a stored field, but it is derivable exactly. `finalize` awards a forfeited
 *   match to the seat whose mask is complete and any other to the greater PnL, and both masks survive
 *   into `FINALIZED` — so the same branch reproduces the contract's own answer.
 * - **A refund's reason** is only in its event. Three of the four are unambiguous from the record; a
 *   creator who withdrew an unjoined match and one whose join window simply ran out are the same state,
 *   and both mean "the creator got their pot back and nobody else was involved". The projector, which
 *   sees `MatchRefunded`, is what will name that one precisely.
 */

const ZERO = "0x0000000000000000000000000000000000000000";

export type SnapshotResult =
  /** `warning` is a disagreement worth logging that did not make the snapshot wrong — see `outcomeOf`. */
  | { ok: true; state: MatchState; view: ArenaMatchView; warning?: string }
  | { ok: false; code: RoomErrorCode; why: string };

function seatWallet(match: ArenaMatch, seat: Seat): Address {
  return seat === 0 ? match.creator : match.challenger;
}

function receiptsOf(view: ArenaMatchView, chainId: number): readonly CardReceipt[] {
  return view.picks.map((pick) => ({
    cardIndex: pick.cardIndex,
    player: seatWallet(view.match, pick.seat),
    pick: pick.pick,
    quantity: pick.quantity,
    costBase: pick.costBase,
    payoutBase: pick.settled ? pick.payoutBase : null,
    pickKey: arenaPickKey(chainId, view.match.matchId, pick.cardIndex, pick.seat),
  }));
}

/** The seats that still owe a card. Empty in every phase but a forfeit. */
function incompleteOf(match: ArenaMatch): readonly Address[] {
  const full = fullDeckMask(match.deckSize);
  const out: Address[] = [];
  if (match.pickedMask0 !== full) out.push(match.creator);
  if (match.pickedMask1 !== full && match.challenger !== ZERO) out.push(match.challenger);
  return out;
}

function refundReasonOf(match: ArenaMatch): RefundReason {
  if (match.joinedAtSec === 0) return "creator-cancelled";
  if (match.revealedAtSec === 0) return "reveal-unavailable";
  return "both-incomplete";
}

/**
 * The deck, as cards a stage can draw. The venue is asked for each Window because the arena stores only
 * its id; a Window it cannot answer for fails the whole snapshot rather than producing a card with an
 * invented asset or expiry, because a deck that cannot be read is a deck that cannot be played.
 */
async function cardsOf(ids: readonly MarketId[]): Promise<readonly DeckCard[] | null> {
  const reads = await Promise.all(ids.map((marketId) => marketsProvider.getMarket(marketId)));
  const cards: DeckCard[] = [];
  for (const [index, reading] of reads.entries()) {
    if (!isOk(reading) || !reading.value) return null;
    const market = reading.value;
    cards.push({ index, marketId: market.marketId, asset: market.asset, intervalSec: market.intervalSec, expirySec: market.expirySec });
  }
  return cards;
}

/**
 * `finalize`'s own branch, reproduced from the masks and the chain's PnL.
 *
 * The winner comes from core's `settleMatch`, which is the same rule the contract runs. The numbers
 * come from `pnlOf`, because the chain's accumulators are the authority — but the two are compared, and
 * a disagreement is reported rather than smoothed over: `settleMatch` summing the decoded receipts to a
 * different total than the arena did would mean a decode is wrong, and that is worth a loud line in the
 * log long before it is worth a wrong number on a screen.
 */
function outcomeOf(view: ArenaMatchView, receipts: readonly CardReceipt[]): { outcome: MatchOutcome; warning: string | null } {
  const { match } = view;
  const settled = settleMatch({
    creator: match.creator,
    challenger: match.challenger,
    receipts,
    potPerPlayerBase: match.potBase,
    incomplete: incompleteOf(match),
  });
  const chain: MatchOutcome = {
    winner: settled.outcome.winner,
    pnlBase: { [match.creator]: view.creatorPnlBase, [match.challenger]: view.challengerPnlBase },
  };
  const mine = settled.outcome.pnlBase;
  const agrees = mine[match.creator] === view.creatorPnlBase && mine[match.challenger] === view.challengerPnlBase;
  const warning = agrees
    ? null
    : `${match.matchId}: replayed PnL ${mine[match.creator]}/${mine[match.challenger]} disagrees with the arena's ${view.creatorPnlBase}/${view.challengerPnlBase}`;
  return { outcome: chain, warning };
}

/** The seven phases a chain state can be in — never the queue's own, which the arena knows nothing about. */
type ChainPhase = "committed" | "picking" | "locked" | "settling" | "finalized" | "refunded" | "forfeited";

function phaseFor(match: ArenaMatch): ChainPhase {
  switch (match.status) {
    case "waiting":
    case "activeUnrevealed":
      return "committed";
    case "picking":
      return "picking";
    case "settling":
      return match.settledMask === 0 ? "locked" : "settling";
    case "finalized":
      return "finalized";
    case "refunded":
      return "refunded";
    case "forfeited":
      return "forfeited";
  }
}

/** One match as a `MatchState`, or the reason it cannot be shown. `null` for a match id the arena never wrote. */
export async function buildMatchSnapshot(matchId: Bytes32, chainId: number): Promise<SnapshotResult> {
  const reading = await getArenaMatch(matchId);
  if (!isOk(reading)) return { ok: false, code: "internal", why: `the arena is unreadable: ${reading.error.technical}` };
  if (!reading.value) return { ok: false, code: "unknown-match", why: "no such match on this arena" };

  const view = reading.value;
  const { match } = view;
  const tier = stakeTierIdOf(match.tier);
  const identity = {
    matchId: match.matchId,
    players: { creator: match.creator, challenger: match.challenger === ZERO ? null : match.challenger },
    mode: stakeTier(tier).mode,
    tier,
  };
  const commitment = { hash: match.deckHash, size: match.deckSize, policyVersion: match.policyVersion };
  const receipts = receiptsOf(view, chainId);
  const phase = phaseFor(match);

  if (phase === "committed") return { ok: true, view, state: { ...identity, phase, commitment } };
  if (phase === "refunded") return { ok: true, view, state: { ...identity, phase, reason: refundReasonOf(match) } };
  if (phase === "finalized") {
    const { outcome, warning } = outcomeOf(view, receipts);
    return { ok: true, view, state: { ...identity, phase, outcome, receipts }, ...(warning ? { warning } : {}) };
  }
  if (phase === "forfeited") return { ok: true, view, state: { ...identity, phase, incomplete: incompleteOf(match) } };

  const cards = await cardsOf(view.cards);
  if (!cards) return { ok: false, code: "internal", why: "the venue cannot describe every Window in this deck" };
  if (phase === "picking") return { ok: true, view, state: { ...identity, phase, cards, receipts, deadlineMs: match.pickDeadlineSec * 1_000 } };
  return { ok: true, view, state: { ...identity, phase, cards, receipts } };
}

/** The picks in a deck this seat still owes — what a resumed stage puts back on screen. */
export function outstandingFor(view: ArenaMatchView, wallet: Address): readonly number[] {
  const { match } = view;
  const seat: Seat | null = match.creator === wallet.toLowerCase() ? 0 : match.challenger === wallet.toLowerCase() ? 1 : null;
  if (seat === null) return [];
  const mask = seat === 0 ? match.pickedMask0 : match.pickedMask1;
  return Array.from({ length: match.deckSize }, (_, i) => i).filter((i) => ((mask >> i) & 1) === 0);
}
