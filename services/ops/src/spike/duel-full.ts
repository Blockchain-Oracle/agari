import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex, MarketId } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { phase } from "@masayume/core/lifecycle";
import {
  closeRuntime,
  createMemoryJournal,
  createSubmitterSession,
  ensureMarkets,
  loadCollateral,
  marketsProvider,
  parseMarketsEnv,
  resolveVenueId,
  type SubmitterSession,
} from "@masayume/markets";
import { getArenaCredit, getArenaMatch, getArenaState, quoteArenaPick, sendArenaIntent } from "@masayume/markets/games";
import { erc20Abi } from "viem";
import { dealDeck, deckSupply, newMatchId } from "../actors/matchmaker/deckmaster";
import { deckKey, fromJournal, open } from "../actors/matchmaker/seal";
import { finish } from "./finish";
import { placePickWithRetry } from "./pick";

/**
 * One duel, driven end to end against Shannon: deal, create, join, reveal, pick every card on both
 * sides, wait for the venue's prints, settle each card, award the pot, claim both credits.
 *
 *   CREATOR_KEY=… CHALLENGER_KEY=… pnpm --filter @masayume/ops spike:duel-full
 *
 * This is the one path slice 7 left unproven, because it is the first that spends a player's own money:
 * every earlier spike stops at the commitment. `PHASE` bounds how far it goes —
 *
 *   preflight  reads only; prices the drive and probes the venue. Spends nothing.
 *   picks      through the last pick, which is what locks the match. Spends the stakes.
 *   settle     the whole loop including the wait for the cards to print (the default).
 *
 * The reveal is deliberately read back out of the deck journal rather than kept in memory from the deal.
 * Keeping it would prove less: the journal is what a restarted operator actually has, and a commitment
 * whose preimage cannot be read back is a match that can only refund.
 */

const PHASE = (process.env.PHASE ?? "settle") as "preflight" | "picks" | "settle";
/** What one card costs a player. The arena refunds the unspent part of every stake, so this is a ceiling. */
const STAKE_CENTS = Number(process.env.STAKE_CENTS ?? 1);
/** How far below the quote a fill may land before the pick is refused rather than taken. */
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? 1_000);
const TIER = Number(process.env.TIER ?? 0);
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS ?? 75 * 60_000);
const POLL_MS = Number(process.env.POLL_MS ?? 20_000);
const DEAL_TIMEOUT_MS = Number(process.env.DEAL_TIMEOUT_MS ?? 12 * 60_000);

let failures = 0;
const t0 = Date.now();
const at = () => `${String(Math.floor((Date.now() - t0) / 1000)).padStart(4)}s`;
function log(line: string): void {
  console.log(`${at()}  ${line}`);
}
function check(name: string, pass: boolean, detail = ""): void {
  if (!pass) failures += 1;
  console.log(`${at()}  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Player {
  label: string;
  session: SubmitterSession;
  address: Address;
}

async function openPlayer(label: string, keyEnv: string, env: ReturnType<typeof parseMarketsEnv>): Promise<Player> {
  const key = process.env[keyEnv];
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${keyEnv} is required (a 32-byte hex private key)`);
  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: key as Hex }, journal: createMemoryJournal() });
  return { label, session, address: session.address };
}

async function purse(player: Player, token: Address): Promise<{ sttWei: bigint; cashBase: bigint }> {
  const client = player.session.contracts.publicClient;
  const [sttWei, cashBase] = await Promise.all([
    client.getBalance({ address: player.address }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [player.address] }) as Promise<bigint>,
  ]);
  return { sttWei, cashBase };
}

/**
 * Where does the arena actually stop accepting a card?
 *
 * Two rules disagree and only one is real. Our `phase()` calls a Window unenterable for the last
 * `max(30, min(300, 0.4×interval))` seconds of its life — 300s on both live cadences — while the arena's
 * `_sizeEntry` applies its own pair of gates: the market contract must report `status() == TRADING`, and
 * `expiry` must be at least `minCardLifeSec` ahead. Which binds decides whether a freshly revealed card
 * can be played at all, so it is measured rather than argued: quote every live Window, shortest life
 * first, and read where the answers change.
 */
async function probeEntryGate(stakeBase: bigint, minCardLifeSec: number): Promise<void> {
  const venue = await resolveVenueId(parseMarketsEnv().venueId);
  if (!isOk(venue) || !venue.value.venueId) return log("no live venue, so the entry-gate probe is skipped");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) return log("lanes unreadable, so the entry-gate probe is skipped");
  const nowMs = marketsProvider.nowMs();
  const nowSec = Math.floor(nowMs / 1_000);
  const live = lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .map((market) => ({ market, leftSec: market.expirySec - nowSec, ours: phase(market, nowMs) }))
    .sort((a, b) => a.leftSec - b.leftSec)
    .slice(0, 6);
  log(`entry gate: the arena's own floor is minCardLifeSec ${minCardLifeSec}s; ours is the no-entry buffer`);
  for (const { market, leftSec, ours } of live) {
    const quote = await quoteArenaPick(market.marketId, "up", stakeBase);
    const arena = isOk(quote) && quote.value ? `quotes ${quote.value.quantityRaw} raw` : `refuses (${reason(quote)})`;
    log(`  ${market.asset} ${market.intervalSec}s · ${leftSec}s left · we say ${ours} · the arena ${arena}`);
  }
}

/** The decoded custom error, not just "reverted" — `TooLate` and `MarketNotTrading` are different findings. */
function reason(quote: Awaited<ReturnType<typeof quoteArenaPick>>): string {
  if (isOk(quote)) return "empty quote";
  const lines = quote.error.technical.split("\n").map((l) => l.trim()).filter(Boolean);
  const named = lines.find((l) => /Error:|reverted with/.test(l) && !/^The contract function/.test(l));
  return (named ?? lines[0] ?? "reverted").slice(0, 120);
}

/** Every card a seat owes, in order. Sequential within one player because one account has one nonce. */
async function playThrough(player: Player, matchId: Bytes32, cards: readonly MarketId[], side: "up" | "down", stakeBase: bigint, deadlineSec: number): Promise<number> {
  let played = 0;
  for (const [cardIndex, marketId] of cards.entries()) {
    const attempt = await placePickWithRetry(player.session, matchId, cardIndex, marketId, side, stakeBase, deadlineSec, (line) => log(`${player.label} ${line}`));
    if (attempt.placed) played += 1;
    else check(`${player.label} card ${cardIndex} placed`, false, attempt.why ?? "");
  }
  return played;
}

async function waitForPrints(cards: readonly MarketId[]): Promise<Set<MarketId>> {
  const settled = new Set<MarketId>();
  const until = Date.now() + SETTLE_TIMEOUT_MS;
  while (settled.size < cards.length && Date.now() < until) {
    const nowSec = Math.floor(marketsProvider.nowMs() / 1_000);
    for (const marketId of cards) {
      if (settled.has(marketId)) continue;
      const onchain = await marketsProvider.getOnchain(marketId);
      if (!isOk(onchain)) continue;
      if (onchain.value.isResolved || onchain.value.isVoided) {
        settled.add(marketId);
        log(`card printed: ${marketId} ${onchain.value.isVoided ? "VOIDED" : `resolved outcome ${onchain.value.winningOutcome}`}`);
      } else if (settled.size < cards.length) {
        const left = onchain.value.expirySec - nowSec;
        log(`waiting on ${marketId} · status ${onchain.value.status} · ${left > 0 ? `${left}s to expiry` : `expired ${-left}s ago, awaiting the print`}`);
      }
    }
    if (settled.size < cards.length) await sleep(POLL_MS);
  }
  return settled;
}

/**
 * The half of a duel nobody signs for: the cards print, anyone cranks, and the arena pays what it
 * already recorded. Split out because it is also the resume path — a drive interrupted during the wait
 * is finished by running again with `MATCH_ID`, which is the same thing the settler would have done.
 */
async function closeOut(
  matchId: Bytes32,
  cards: readonly MarketId[],
  creator: Player,
  challenger: Player,
  token: Address,
  cash: (base: bigint) => string,
  pnl: (base: bigint) => string,
): Promise<void> {
  // A deck nobody completed stays PICKING until someone closes it, and `finalize` refuses that status.
  // The crank is permissionless and the settler would make it; a drive that owns the match makes it here.
  const before = await getArenaMatch(matchId);
  if (isOk(before) && before.value?.match.status === "picking") {
    const deadlineSec = before.value.match.pickDeadlineSec;
    const waitMs = Math.max(0, (deadlineSec + 2 - Math.floor(marketsProvider.nowMs() / 1_000)) * 1_000);
    if (waitMs > 0) log(`the match is still picking; the deadline is ${Math.round(waitMs / 1_000)}s away`);
    await sleep(waitMs);
    const locked = await sendArenaIntent(creator.session.contracts, { kind: "arena-lock", matchId });
    log(`locked the pick window · ${locked.hash} · gas ${locked.receipt.gasUsed}`);
  }

  log(`waiting for ${cards.length} card(s) to print`);
  const printed = await waitForPrints(cards);
  check("every card printed inside the wait", printed.size === cards.length, `${printed.size}/${cards.length}`);
  if (printed.size !== cards.length) {
    log(`MATCH_ID=${matchId} is still open; run again with it, or let the settler finish it.`);
    return;
  }

  for (const [cardIndex] of cards.entries()) {
    const sent = await sendArenaIntent(creator.session.contracts, { kind: "arena-settle-card", matchId, cardIndex });
    log(`settled card ${cardIndex} · ${sent.hash} · gas ${sent.receipt.gasUsed}`);
  }
  const final = await sendArenaIntent(creator.session.contracts, { kind: "arena-finalize", matchId });
  log(`finalized · ${final.hash} · gas ${final.receipt.gasUsed}`);

  const done = await getArenaMatch(matchId);
  if (!isOk(done) || !done.value) throw new Error("the match is unreadable after finalize");
  check("the match is finalized", done.value.match.status === "finalized", done.value.match.status);
  log(`pnl creator ${pnl(done.value.creatorPnlBase)} · challenger ${pnl(done.value.challengerPnlBase)}`);

  for (const player of [creator, challenger]) {
    const credit = await getArenaCredit(player.address);
    const owed = isOk(credit) ? credit.value : 0n;
    if (owed === 0n) {
      log(`${player.label} is owed nothing`);
      continue;
    }
    const before = await purse(player, token);
    const claimed = await sendArenaIntent(player.session.contracts, { kind: "arena-claim", player: player.address });
    const after = await purse(player, token);
    log(`${player.label} claimed ${cash(owed)} · ${claimed.hash} · gas ${claimed.receipt.gasUsed}`);
    check(`${player.label}'s claim reached the wallet`, after.cashBase - before.cashBase === owed, cash(after.cashBase - before.cashBase));
  }

  log(`MATCH_ID=${matchId}`);
}

/**
 * Deal, or wait out the venue's dead zone and deal.
 *
 * Somnia's cadences roll on aligned boundaries, so for the last few minutes of every cycle every Window
 * inside a duel's horizon is too close to expiry and no deck exists. That is a wait, not a failure — the
 * queue's own answer is a countdown — so this waits on `deckSupply` the way the queue does, which also
 * makes the countdown itself part of what the drive proves.
 */
async function dealWithSupply(input: Parameters<typeof dealDeck>[0]): Promise<Awaited<ReturnType<typeof dealDeck>>> {
  const until = Date.now() + DEAL_TIMEOUT_MS;
  for (;;) {
    const dealt = await dealDeck(input, (why) => log(`[deckmaster] ${why}`));
    if (dealt.ok || !dealt.retry || Date.now() >= until) return dealt;
    const inSec = await deckSupply(input.params);
    check("the countdown knows when the next deck lands", inSec !== null, inSec === null ? "null — the queue would have nothing to show" : `${inSec}s`);
    log(`no deck yet: ${dealt.why}`);
    await sleep(Math.min(Math.max((inSec ?? 30) + 5, 15), 120) * 1_000);
  }
}

async function main(): Promise<void> {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error(`collateral unreadable: ${collateral.error.technical}`);
  const { address: token, decimals, symbol } = collateral.value;
  // Six decimal places, not the surface default of two: a duel is played in cents, and a 0.009 fill
  // rounded to "0.00" makes the whole settle report say nothing.
  const cash = (base: bigint) => `${formatBaseUnits(base, decimals, { maxDp: decimals, minDp: 2 })} ${symbol}`;
  const pnl = (base: bigint) => `${formatBaseUnits(base, decimals, { maxDp: decimals, minDp: 2, signed: true })} ${symbol}`;

  const state = await getArenaState();
  if (!isOk(state) || !state.value) throw new Error("no arena on this network");
  const arena = state.value;
  const tier = arena.tiers[TIER];
  if (!tier?.enabled) throw new Error(`tier ${TIER} is not enabled`);
  const stakeBase = BigInt(STAKE_CENTS) * 10n ** BigInt(decimals) / 100n;

  log(`arena ${arena.address} · ${arena.paused ? "PAUSED" : "live"}`);
  log(`params join ${arena.params.joinWindowSec}s · reveal ${arena.params.revealWindowSec}s · pick ${arena.params.pickWindowSec}s · deck ${arena.params.minDeckSize}–${arena.params.maxDeckSize} · cardLife ${arena.params.minCardLifeSec}s`);
  log(`tier ${TIER}: pot ${cash(tier.potBase)} per player · cap ${cash(tier.perCardCapBase)} per card · stake ${cash(stakeBase)} per card`);
  if (arena.paused) throw new Error("the arena is paused; nothing can be driven");

  const creator = await openPlayer("creator", "CREATOR_KEY", env);
  const challenger = await openPlayer("challenger", "CHALLENGER_KEY", env);
  if (creator.address.toLowerCase() === challenger.address.toLowerCase()) throw new Error("the arena refuses a self-join; use two keys");

  for (const player of [creator, challenger]) {
    const held = await purse(player, token);
    log(`${player.label} ${player.address} · ${formatBaseUnits(held.sttWei, 18)} STT · ${cash(held.cashBase)}`);
    check(`${player.label} holds gas`, held.sttWei > 0n);
    check(`${player.label} holds collateral`, held.cashBase >= tier.potBase + stakeBase);
  }

  // A drive interrupted during the print wait resumes here rather than opening a second match.
  const resuming = process.env.MATCH_ID ?? "";
  if (/^0x[0-9a-fA-F]{64}$/.test(resuming)) {
    const view = await getArenaMatch(resuming as Bytes32);
    if (!isOk(view) || !view.value) throw new Error(`MATCH_ID ${resuming} is unreadable`);
    log(`resuming ${resuming} · status ${view.value.match.status} · ${view.value.cards.length} card(s)`);
    await closeOut(resuming as Bytes32, view.value.cards, creator, challenger, token, cash, pnl);
    return;
  }

  await probeEntryGate(stakeBase, arena.params.minCardLifeSec);

  if (!deckKey()) throw new Error("GAME_DECK_KEY is required: without it a deck's reveal could not be kept");

  if (PHASE === "preflight") {
    log(`preflight only — a full deck would cost each player ${cash(tier.potBase)} of pot plus ${cash(stakeBase)} a card`);
    return;
  }

  // ---------------------------------------------------------------- deal, create, join, reveal
  const matchId = newMatchId();
  const clientSeeds: Bytes32[] = [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`];
  const dealt = await dealWithSupply({ matchId, chainId: creator.session.chainId, arena: arena.address, clientSeeds, params: arena.params });
  if (!dealt.ok) throw new Error(`the deckmaster refuses: ${dealt.why}`);
  const deck = dealt.deck;
  const nowSec = Math.floor(marketsProvider.nowMs() / 1_000);
  log(`deck ${deck.cards.length} cards (${deck.lane}) policy v${deck.policyVersion} · ${deck.deckHash}`);
  for (const card of deck.cards) log(`  card ${card.index}: ${card.asset} ${card.intervalSec}s · ${card.expirySec - nowSec}s of life`);
  log(`the drive will spend at most ${cash((tier.potBase + stakeBase * BigInt(deck.cards.length)))} per player`);

  const created = await sendArenaIntent(creator.session.contracts, {
    kind: "arena-create",
    matchId,
    challenger: challenger.address,
    tier: TIER,
    deckHash: deck.deckHash,
    deckSize: deck.cards.length,
    policyVersion: deck.policyVersion,
    potBase: tier.potBase,
  });
  log(`created · ${created.hash} · gas ${created.receipt.gasUsed}`);

  const joined = await sendArenaIntent(challenger.session.contracts, { kind: "arena-join", matchId, potBase: tier.potBase });
  log(`joined · ${joined.hash} · gas ${joined.receipt.gasUsed}`);

  const sealed = fromJournal(matchId);
  check("the deck's reveal material is on disk", sealed !== null);
  if (!sealed) throw new Error("nothing to reveal with; the match will refund at its deadline");
  const material = open(sealed, deckKey() as Buffer);
  const revealed = await sendArenaIntent(creator.session.contracts, {
    kind: "arena-reveal",
    matchId,
    serverSeed: material.serverSeed as Bytes32,
    clientSeeds: material.clientSeeds as readonly Bytes32[],
    cards: material.cards as readonly MarketId[],
  });
  log(`revealed from the journal · ${revealed.hash} · gas ${revealed.receipt.gasUsed}`);

  const opened = await getArenaMatch(matchId);
  if (!isOk(opened) || !opened.value) throw new Error("the match is unreadable after the reveal");
  const cards = opened.value.cards;
  const deadline = opened.value.match.pickDeadlineSec;
  check("the deck the chain holds is the deck that was dealt", cards.length === deck.cards.length);
  log(`picking until ${deadline} — ${deadline - Math.floor(marketsProvider.nowMs() / 1_000)}s from now`);

  // ---------------------------------------------------------------- the picks
  // Both seats at once: two accounts are two nonces, so the only thing serialising them would be us.
  const [byCreator, byChallenger] = await Promise.all([
    playThrough(creator, matchId, cards, "up", stakeBase, deadline),
    playThrough(challenger, matchId, cards, "down", stakeBase, deadline),
  ]);
  check("the creator played every card", byCreator === cards.length, `${byCreator}/${cards.length}`);
  check("the challenger played every card", byChallenger === cards.length, `${byChallenger}/${cards.length}`);

  const locked = await getArenaMatch(matchId);
  if (!isOk(locked) || !locked.value) throw new Error("the match is unreadable after the picks");
  check("the last pick locked the match itself", locked.value.match.status === "settling", locked.value.match.status);
  for (const pick of locked.value.picks) {
    log(`  card ${pick.cardIndex} seat ${pick.seat} ${pick.pick} · ${pick.quantity} raw for ${cash(pick.costBase)}`);
  }

  if (PHASE === "picks") {
    log(`stopping at the lock. MATCH_ID=${matchId} — run again with PHASE=settle, or let the settler finish it.`);
    return;
  }

  await closeOut(matchId, cards, creator, challenger, token, cash, pnl);
}

void main()
  .then(() => {
    console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
    finish(failures === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(error);
    finish(1);
  })
  .finally(() => void closeRuntime());
