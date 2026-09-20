#!/usr/bin/env -S pnpm exec tsx
// S12b drive: prove a whole duel on devnet, through the same submitter lane the app sends on.
//   arena                                          the arena's books, params and tiers
//   fund   --amount 20                             test tUSDC minted to both players
//   deal   --window a,b,c [--tier 1] [--key] [--stop create|join]   creator opens with the sealed deck's hash, rival joins, the deck is revealed;
//                                                  --key also names the creator's seat key and escrows the deck's ceiling
//   duel   --window a,b,c --creator up,down,up --rival down,down,up [--tier 1] [--key] [--amount 0.5]
//                                                  deal and then every pick of both seats, in one process: the pick
//                                                  window is three minutes, which is no time to boot twelve of them
//   picks  --match <file> --creator up,up,up --rival down,down,down [--amount 0.8]   every pick of both seats
//   pick   --match <file> --card 0 --side up --amount 0.5 [--as creator|rival|key]
//   lock   --match <file>                          closes a pick window whose deadline has passed
//   settle --match <file>                          settles every played card, then finalizes and claims both credits
//   cancel | refund-unjoined | refund-unrevealed --match <file>
//   release --match <file> [--as creator|rival]    what a seat's key never spent, back as its player's credit
// A deck is saved under data/drive/duels/. Its cards are Windows the drive owns (D-115), so `--window` takes market ids.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/duel-arena.ts <mode> [...]

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { ArenaIntent } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, parseMarketsEnv, unwrap, type SubmitterSession } from "@agari/markets";
import { createDeployClient, fundUser, keypairSigner, type StepLog } from "@agari/markets/deploy";
import { deckCommitment, getArenaCredit, getArenaMatch, getArenaState, quoteArenaPick, readArenaAgent, resolveArenaDeployment } from "@agari/markets/games";
import { addressesFor, clusterArg, endpoints, flag, readJson, redactKey, roleSecret } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "arena";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));
const show = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
const hex32 = (): Hash32 => `0x${randomBytes(32).toString("hex")}` as Hash32;

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const { file } = addressesFor(cluster);
const env = parseMarketsEnv({ cluster, rpcHttpUrls: rpcUrl, rpcWsUrls: rpcSubscriptionsUrl, venueId: file.venue.config });
ensureMarkets(env);
const collateral = unwrap(await loadCollateral());
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
console.log(`duel drive "${mode}" on ${cluster} (${label})`);

/** One player, signing through the lane the app signs on. */
async function seat(role: string): Promise<SubmitterSession> {
  return createSubmitterSession({ env, authority: role === "drive-key" ? "game-session" : "user-wallet", signer: { secretKey: roleSecret(role) }, journal: createMemoryJournal() });
}

async function send(session: SubmitterSession, intent: ArenaIntent, what: string): Promise<boolean> {
  const outcome = await session.submitter.submitTx(intent);
  if (outcome.status === "confirmed") {
    console.log(`  ${what.padEnd(22)} ${outcome.txHash}`);
    return true;
  }
  console.log(`  ${what.padEnd(22)} ${outcome.status}: ${outcome.diagnosis.technical.split("\n")[0]}`);
  return false;
}

interface Deal {
  matchId: Hash32;
  creator: Address;
  challenger: Address;
  tier: number;
  policyVersion: number;
  serverSeed: Hash32;
  clientSeeds: Hash32[];
  cards: MarketId[];
  deckHash: Hash32;
  agent?: { key: Address; ttlSec: number };
}

async function books(): Promise<string> {
  const state = await getArenaState();
  if (!isOk(state) || !state.value) return "no arena on this cluster";
  const s = state.value;
  return `escrowed ${s.escrowedBase}, credited ${s.creditedBase}, paused ${s.paused}`;
}

const dealPath = () => arg("--match") ?? "";

/** Every pick of both seats, in one process: the pick window is three minutes, which is no time to boot twelve of them. */
async function playPicks(deal: Deal, creator: SubmitterSession, rival: SubmitterSession): Promise<void> {
  const sides = (name: string) => (arg(name) ?? "").split(",").map((v) => (v.trim() === "down" ? "down" : "up")) as ("up" | "down")[];
  const [mine, theirs] = [sides("--creator"), sides("--rival")];
  const stakeBase = units(arg("--amount"), "0.8");
  const keySession = deal.agent ? await seat("drive-key") : null;
  for (let cardIndex = 0; cardIndex < deal.cards.length; cardIndex += 1) {
    for (const [who, side, session] of [
      ["creator", mine[cardIndex] ?? "up", keySession ?? creator],
      ["rival", theirs[cardIndex] ?? "down", rival],
    ] as const) {
      const card = deal.cards[cardIndex]!;
      const quote = await quoteArenaPick(card, side, stakeBase);
      const floor = isOk(quote) && quote.value ? (quote.value.quantityRaw * 9_500n) / 10_000n : 0n;
      const player = who === "creator" ? deal.creator : deal.challenger;
      const byKey = who === "creator" && keySession !== null;
      const outcome = await session.submitter.submitArenaPick(
        byKey
          ? { kind: "arena-pick-for", player, matchId: deal.matchId, cardIndex, pick: side, stakeBase, minQuantityRaw: floor }
          : { kind: "arena-pick", matchId: deal.matchId, cardIndex, pick: side, stakeBase, minQuantityRaw: floor },
      );
      console.log(`  card ${cardIndex} ${who.padEnd(7)} ${side.padEnd(4)}${byKey ? " (by key)" : "        "} ${outcome.status === "confirmed" ? `filled ${outcome.quantity} for ${outcome.costBase}, ${outcome.refundBase} back · ${outcome.txHash}` : `${outcome.status}: ${outcome.diagnosis.technical.split("\n")[0]}`}`);
    }
  }
  const view = unwrap(await getArenaMatch(deal.matchId));
  console.log(`match: ${show(view && { status: view.match.status, picked0: view.match.pickedMask0, picked1: view.match.pickedMask1, picks: view.picks })}`);
  if (deal.agent) console.log(`key: ${show(unwrap(await readArenaAgent(deal.matchId, deal.creator)))}`);
}


try {
  const deployment = await resolveArenaDeployment(env);
  if (!deployment) throw new Error("no arena on this cluster");

  if (mode === "arena") {
    const state = unwrap(await getArenaState());
    console.log(`arena ${deployment.gameArena}, chain id ${deployment.chainId}, from slot ${deployment.fromBlock}`);
    console.log(show(state));
  } else if (mode === "fund") {
    const faucet = await keypairSigner(roleSecret("faucet-mint-authority"));
    const amount = units(arg("--amount"), "20");
    const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}`);
    for (const role of ["drive-owner", "drive-rival"]) {
      const owner = (await keypairSigner(roleSecret(role))).address;
      await fundUser({ client, log }, { faucet, mint: collateral.address as never, owner, amount });
    }
  } else if (mode === "deal" || mode === "duel") {
    const cards = (arg("--window") ?? "").split(",").filter(Boolean) as MarketId[];
    if (cards.length < 3) throw new Error("--window takes three or more market ids, comma-separated");
    const [creator, rival] = [await seat("drive-owner"), await seat("drive-rival")];
    const state = unwrap(await getArenaState());
    if (!state) throw new Error("no arena");
    const tier = Number(arg("--tier") ?? "1");
    const priced = state.tiers[tier];
    if (!priced?.enabled) throw new Error(`tier ${tier} is not enabled`);

    // The deck is sealed before either player sees it: a server seed the drive keeps, both players' client seeds, and
    // the cards, hashed exactly as `public_reveal_deck` will hash them.
    const deal: Deal = {
      matchId: hex32(), creator: creator.address as string as Address, challenger: rival.address as string as Address, tier, policyVersion: 1,
      serverSeed: hex32(), clientSeeds: [hex32(), hex32()], cards, deckHash: "0x" as Hash32,
    };
    deal.deckHash = deckCommitment({ chainId: deployment.chainId, arena: deployment.gameArena, matchId: deal.matchId, policyVersion: deal.policyVersion, serverSeed: deal.serverSeed, clientSeeds: deal.clientSeeds, cards });
    const keyed = flag("--key");
    if (keyed) deal.agent = { key: (await keypairSigner(roleSecret("drive-key"))).address as string as Address, ttlSec: 3_600 };
    console.log(`match ${deal.matchId}\n  creator ${deal.creator}\n  rival   ${deal.challenger}\n  deck    ${deal.deckHash} over ${cards.length} cards, tier ${tier} (pot ${priced.potBase}, cap ${priced.perCardCapBase})`);

    // `--stop create` or `--stop join` leaves the match where the ways out are: cancel, the join timeout, the reveal timeout.
    const stop = arg("--stop") ?? "";
    const grant = deal.agent ? { agent: deal.agent.key, ttlSec: deal.agent.ttlSec, budgetBase: priced.perCardCapBase * BigInt(cards.length), gasWei: 0n } : undefined;
    await send(creator, { kind: "arena-create", matchId: deal.matchId, challenger: deal.challenger, tier, deckHash: deal.deckHash, deckSize: cards.length, policyVersion: deal.policyVersion, potBase: priced.potBase, ...(grant ? { agent: grant } : {}) }, keyed ? "create + key" : "create");
    mkdirSync("data/drive/duels", { recursive: true });
    const out = `data/drive/duels/${deal.matchId.slice(2, 14)}.json`;
    writeFileSync(out, JSON.stringify(deal, null, 2));
    console.log(`deal saved to ${out}`);
    if (stop !== "create") await send(rival, { kind: "arena-join", matchId: deal.matchId, potBase: priced.potBase }, "join");
    // Permissionless: the drive reveals with the deployer, which is neither player.
    const cranker = await seat("deployer");
    if (stop === "create" || stop === "join") {
      const stopped = unwrap(await getArenaMatch(deal.matchId));
      console.log(`stopped at ${stop}: ${show(stopped && { status: stopped.match.status, createdAtSec: stopped.match.createdAtSec, joinedAtSec: stopped.match.joinedAtSec })}`);
      console.log(`arena: ${await books()}`);
      process.exit(0);
    }
    // A deck that is not the one committed to is refused by the chain, whoever presents it.
    const wrong = await cranker.submitter.submitTx({ kind: "arena-reveal", matchId: deal.matchId, serverSeed: hex32(), clientSeeds: deal.clientSeeds, cards });
    console.log(`  ${"wrong deck".padEnd(22)} ${wrong.status}: ${wrong.status === "confirmed" ? "ACCEPTED — the commitment did not bind" : wrong.diagnosis.technical.split("\n")[0]}`);
    await send(cranker, { kind: "arena-reveal", matchId: deal.matchId, serverSeed: deal.serverSeed, clientSeeds: deal.clientSeeds, cards }, "reveal");

    let view = unwrap(await getArenaMatch(deal.matchId));
    console.log(`match: ${show(view && { status: view.match.status, deckSize: view.match.deckSize, pickDeadlineSec: view.match.pickDeadlineSec, cards: view.cards })}`);

    if (mode === "duel") await playPicks(deal, creator, rival);
    console.log(`arena: ${await books()}`);
  } else if (mode === "picks") {
    const deal = readJson<Deal>(dealPath());
    await playPicks(deal, await seat("drive-owner"), await seat("drive-rival"));
    console.log(`arena: ${await books()}`);
  } else if (mode === "pick") {
    const deal = readJson<Deal>(dealPath());
    const who = arg("--as") ?? "creator";
    const role = who === "rival" ? "drive-rival" : who === "key" ? "drive-key" : "drive-owner";
    const session = await seat(role);
    const cardIndex = Number(arg("--card") ?? "0");
    const side = arg("--side") === "down" ? "down" : "up";
    const stakeBase = units(arg("--amount"), "0.5");
    const card = deal.cards[cardIndex];
    if (!card) throw new Error(`no card ${cardIndex}`);
    const quote = await quoteArenaPick(card, side, stakeBase);
    console.log(`quote: ${show(isOk(quote) ? quote.value : quote.error)}`);
    const player = who === "key" ? deal.creator : (session.address as string as Address);
    const floor = isOk(quote) && quote.value ? (quote.value.quantityRaw * 9_500n) / 10_000n : 0n;
    const outcome = await session.submitter.submitArenaPick(
      who === "key"
        ? { kind: "arena-pick-for", player, matchId: deal.matchId, cardIndex, pick: side, stakeBase, minQuantityRaw: floor }
        : { kind: "arena-pick", matchId: deal.matchId, cardIndex, pick: side, stakeBase, minQuantityRaw: floor },
    );
    console.log(`pick by ${who} (${session.address}) for ${player}: ${show(outcome)}`);
    const view = unwrap(await getArenaMatch(deal.matchId));
    console.log(`match: ${show(view && { status: view.match.status, picked0: view.match.pickedMask0, picked1: view.match.pickedMask1, picks: view.picks })}`);
  } else if (mode === "settle" || mode === "lock" || mode === "cancel" || mode === "refund-unjoined" || mode === "refund-unrevealed" || mode === "release") {
    const deal = readJson<Deal>(dealPath());
    // Every one of these is permissionless but `cancel`, which is the creator's own.
    const session = await seat(mode === "cancel" ? "drive-owner" : mode === "release" && arg("--as") === "rival" ? "drive-rival" : "deployer");
    if (mode === "release") {
      const player = arg("--as") === "rival" ? deal.challenger : deal.creator;
      console.log(`key before: ${show(unwrap(await readArenaAgent(deal.matchId, player)))}`);
      await send(session, { kind: "arena-release-agent", matchId: deal.matchId, player }, "release key");
      console.log(`key after: ${show(unwrap(await readArenaAgent(deal.matchId, player)))}`);
    } else if (mode === "settle") {
      const view = unwrap(await getArenaMatch(deal.matchId));
      if (!view) throw new Error("no such match");
      const played = [...new Set(view.picks.map((p) => p.cardIndex))].sort();
      for (const cardIndex of played) await send(session, { kind: "arena-settle-card", matchId: deal.matchId, cardIndex }, `settle card ${cardIndex}`);
      await send(session, { kind: "arena-finalize", matchId: deal.matchId }, "finalize");
      for (const player of [deal.creator, deal.challenger]) {
        console.log(`  credit ${player.slice(0, 6)}… ${unwrap(await getArenaCredit(player))}`);
        await send(session, { kind: "arena-claim", player }, `claim ${player.slice(0, 6)}…`);
      }
    } else {
      const kind = mode === "lock" ? "arena-lock" : mode === "cancel" ? "arena-cancel" : mode === "refund-unjoined" ? "arena-refund-unjoined" : "arena-refund-unrevealed";
      await send(session, { kind, matchId: deal.matchId } as ArenaIntent, mode);
    }
    const view = unwrap(await getArenaMatch(deal.matchId));
    console.log(`match: ${show(view && { status: view.match.status, settledMask: view.match.settledMask, creatorPnl: view.creatorPnlBase, challengerPnl: view.challengerPnlBase, picks: view.picks })}`);
    for (const player of [deal.creator, deal.challenger]) console.log(`  credit ${player.slice(0, 6)}… ${unwrap(await getArenaCredit(player))}`);
    console.log(`arena: ${await books()}`);
  } else {
    throw new Error(`unknown mode "${mode}"`);
  }
  process.exit(0);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
