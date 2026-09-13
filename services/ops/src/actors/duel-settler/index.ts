import type { ArenaIntent } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Bytes32, Hex, MarketId } from "@masayume/core/types";
import { getDeck, isDbConfigured, listLiveMatches, markDeckRevealed } from "@masayume/db";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, marketsProvider, parseMarketsEnv, type SubmitterSession } from "@masayume/markets";
import { getArenaMatch, getArenaState, resolveArenaDeployment, sendArenaIntent } from "@masayume/markets/games";
import { deckKey, fromJournal, open } from "../matchmaker/seal";
import { decideMatch, isDone, type SettlerAction } from "./decide";

type Log = (why: string) => void;

/**
 * The duel settler: one key, cranking what the contract already lets anyone crank.
 *
 * It decides nothing. Every call it makes is permissionless — lock, settle, finalize, refund — so the
 * only thing this key buys is *promptness*: without it a player waits for someone to press the button,
 * and with it they do not. That is why it can be dry-run, restarted or switched off without anyone's
 * money being at risk, and why it is the actor to run last and worry about least.
 *
 * Its worklist is the projection, not a memory: whatever the database says is still live gets read from
 * the arena and decided on its own record. So a restarted settler picks up mid-match, and two settlers
 * running at once merely make each other's calls revert as already-done rather than paying twice.
 */

const DEFAULT_REFRESH_MS = 30_000;

interface SettlerEnv {
  privateKey: Hex | null;
  refreshMs: number;
  dryRun: boolean;
}

export function readSettlerEnv(env: NodeJS.ProcessEnv = process.env): SettlerEnv {
  const key = env.GAME_SETTLER_PRIVATE_KEY;
  const refresh = Number(env.GAME_SETTLER_REFRESH_MS);
  return {
    privateKey: key && /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : null,
    refreshMs: Number.isFinite(refresh) && refresh >= 5_000 ? refresh : DEFAULT_REFRESH_MS,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
  };
}

/**
 * The reveal material for a match, from the database or, failing that, the journal that is written
 * first. Null when it cannot be opened at all — in which case nothing is sent, and the arena's own
 * reveal deadline turns the match into a refund. That is the designed failure: an operator who loses a
 * deck returns both pots rather than deciding a duel nobody could play.
 */
async function revealIntent(matchId: Bytes32, log: Log): Promise<ArenaIntent | null> {
  const key = deckKey();
  if (!key) return null;
  const sealed = (await getDeck(matchId))?.sealed ?? fromJournal(matchId);
  if (!sealed) {
    log(`${matchId}: committed but no reveal material is on hand; the reveal deadline will refund it`);
    return null;
  }
  try {
    const material = open(sealed, key);
    return {
      kind: "arena-reveal",
      matchId,
      serverSeed: material.serverSeed as Bytes32,
      clientSeeds: material.clientSeeds as readonly Bytes32[],
      cards: material.cards as readonly MarketId[],
    };
  } catch (error) {
    log(`${matchId}: the sealed deck would not open: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function intentOf(action: SettlerAction): ArenaIntent | null {
  switch (action.kind) {
    case "arena-reveal":
      // Built by `revealIntent`, which has to read and decrypt; this branch never fires.
      return null;
    case "arena-lock":
      return { kind: "arena-lock", matchId: action.matchId };
    case "arena-settle-card":
      return { kind: "arena-settle-card", matchId: action.matchId, cardIndex: action.cardIndex };
    case "arena-finalize":
      return { kind: "arena-finalize", matchId: action.matchId };
    case "arena-refund-unjoined":
      return { kind: "arena-refund-unjoined", matchId: action.matchId };
    case "arena-refund-unrevealed":
      return { kind: "arena-refund-unrevealed", matchId: action.matchId };
  }
}

/** Which of a deck's Windows the venue says are resolved or voided — the arena's own settleability test. */
async function settleableCards(cards: readonly MarketId[], log: Log): Promise<Set<MarketId>> {
  const out = new Set<MarketId>();
  await Promise.all(
    cards.map(async (marketId) => {
      const onchain = await marketsProvider.getOnchain(marketId);
      if (!isOk(onchain)) return log(`${marketId}: unreadable, so not settled as far as this settler knows`);
      if (onchain.value.isResolved || onchain.value.isVoided) out.add(marketId);
    }),
  );
  return out;
}

async function crank(session: SubmitterSession | null, dryRun: boolean, action: SettlerAction, log: Log): Promise<boolean> {
  const label = `${action.kind} ${action.matchId}${"cardIndex" in action ? `#${action.cardIndex}` : ""}`;
  const intent = action.kind === "arena-reveal" ? await revealIntent(action.matchId, log) : intentOf(action);
  if (!intent) return false;
  if (dryRun || !session) {
    log(`DRY ${label}: ${action.why}`);
    return false;
  }
  try {
    const sent = await sendArenaIntent(session.contracts, intent);
    log(`${label}: ${action.why} · ${sent.hash} · gas ${sent.receipt.gasUsed}`);
    if (action.kind === "arena-reveal") await markDeckRevealed(action.matchId);
    return true;
  } catch (error) {
    // A revert here is usually a race that someone else already won, which is the system working.
    log(`${label} refused: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return false;
  }
}

export async function startDuelSettler(log: Log): Promise<void> {
  const env = readSettlerEnv();
  const marketsEnv = parseMarketsEnv();
  ensureMarkets(marketsEnv);
  const deployment = resolveArenaDeployment(marketsEnv);
  if (!deployment) return log("GameArena is not deployed on this network; nothing to settle");
  const arena = deployment;
  if (!isDbConfigured()) {
    // The worklist is the projection, so without one there is nothing to iterate. Said plainly rather
    // than reported every cycle as "no live match", which would read as "nothing to do".
    return log("no DATABASE_URL, so there is no projection to read a worklist from; the settler is idle");
  }

  const collateral = await loadCollateral();
  if (!isOk(collateral)) return log(`collateral unreadable: ${collateral.error.technical}`);

  let session: SubmitterSession | null = null;
  if (env.privateKey) {
    session = await createSubmitterSession({ env: marketsEnv, authority: "game-settler", signer: { privateKey: env.privateKey }, journal: createMemoryJournal() });
    log(`settler key ${session.address}${env.dryRun ? " (DRY RUN: nothing is sent)" : ""}`);
  } else {
    log("no GAME_SETTLER_PRIVATE_KEY; watching and reporting, never sending");
  }

  async function cycle(): Promise<void> {
    const state = await getArenaState();
    if (!isOk(state) || !state.value) return log("the arena is unreadable; idle");
    if (state.value.paused) return log("the arena is paused; idle");

    const live = await listLiveMatches(arena.chainId, arena.gameArena);
    if (live.length === 0) return log("no live match in the projection; idle");

    const nowSec = Math.floor(marketsProvider.nowMs() / 1_000);
    let cranked = 0;
    for (const matchId of live) {
      const reading = await getArenaMatch(matchId as Bytes32);
      if (!isOk(reading) || !reading.value) continue;
      const view = reading.value;
      if (isDone(view.match)) continue;

      const settleable = view.cards.length > 0 ? await settleableCards(view.cards, log) : new Set<MarketId>();
      for (const action of decideMatch({ match: view.match, params: state.value.params, cards: view.cards, settleable, nowSec })) {
        if (await crank(session, env.dryRun, action, log)) cranked += 1;
      }
    }
    log(`${live.length} live match(es) · ${cranked} crank(s)${env.dryRun ? " · DRY RUN" : ""}`);
  }

  const tick = async () => {
    try {
      await cycle();
    } catch (error) {
      log(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await tick();
  const timer = setInterval(() => void tick(), env.refreshMs);
  timer.unref();
}
