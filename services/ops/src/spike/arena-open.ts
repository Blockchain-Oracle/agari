import { randomBytes } from "node:crypto";
import { deckCommitmentPreimage, selectDeck, type DeckCandidate } from "@masayume/core/games";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex, MarketId } from "@masayume/core/types";
import { closeRuntime, createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, marketsProvider, parseMarketsEnv, resolveVenueId } from "@masayume/markets";
import { getArenaState, sendArenaIntent } from "@masayume/markets/games";
import { keccak256 } from "viem";
import { finish } from "./finish";

/**
 * Opens one free-tier match on the deployed arena, so the room's reconnect can be proven against a real
 * record rather than a fixture. A harness, not a product path: in the product the creator is a browser
 * and the deck comes from the deckmaster — here one key stands in for both, and the match is left
 * unjoined for the room to read.
 *
 *   PLAYER_KEY=… pnpm --filter @masayume/ops spike:arena-open
 */
/** The opponent this match names at creation. The arena binds it now, so it is required rather than guessed. */
const CHALLENGER = (process.env.CHALLENGER ?? "").toLowerCase() as Address;
const POLICY_VERSION = 1;
/** The match horizon. Two hours by default; raise it to see what a longer duel could be dealt. */
const HORIZON_SEC = Number(process.env.HORIZON_SEC ?? 2 * 60 * 60);

const bytes32 = (): Bytes32 => `0x${randomBytes(32).toString("hex")}`;

async function main(): Promise<void> {
  const key = process.env.PLAYER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("PLAYER_KEY is required");
  if (!/^0x[0-9a-f]{40}$/.test(CHALLENGER)) throw new Error("CHALLENGER (an address) is required");

  const env = parseMarketsEnv();
  ensureMarkets(env);
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error(`collateral unreadable: ${collateral.error.technical}`);

  const state = await getArenaState();
  if (!isOk(state) || !state.value) throw new Error("no arena on this network");
  const { minCardLifeSec } = state.value.params;

  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no live venue");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error(`lanes unreadable: ${lanes.error.technical}`);

  const nowMs = marketsProvider.nowMs();
  const nowSec = Math.floor(nowMs / 1_000);
  const markets = lanes.value.lanes.flatMap((lane) => lane.markets);
  // Core's own policy picks the deck — 15m preferred, 1h as the fallback, never 5m. The book filters are
  // left open here because this harness is not the deckmaster: spread and depth arrive with slice 7c.
  const candidates: DeckCandidate[] = markets.map((m) => ({
    marketId: m.marketId,
    asset: m.asset,
    intervalSec: m.intervalSec,
    expirySec: m.expirySec,
    trading: phase(m, nowMs) === "trading",
    spreadRaw: 0n,
    depthRaw: 1n,
  }));
  console.log(`arena minCardLifeSec ${minCardLifeSec} · horizon ${HORIZON_SEC}s · ${candidates.length} live Windows`);
  for (const c of candidates.sort((a, b) => a.expirySec - b.expirySec)) {
    console.log(`  ${c.asset} ${c.intervalSec}s · ${c.expirySec - nowSec}s left · ${c.trading ? "trading" : "not trading"}`);
  }
  const selection = selectDeck(candidates, {
    supportedAssets: [...new Set(markets.map((m) => m.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 0n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: minCardLifeSec + 60,
  }, nowSec);
  if (!selection.ok) throw new Error(`the deck policy refuses: ${selection.refusal.eligible} of ${selection.refusal.needed} Windows qualify`);
  const cards: MarketId[] = selection.cards.map((c) => c.marketId);

  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: key as Hex }, journal: createMemoryJournal() });
  const matchId = bytes32();
  const serverSeed = bytes32();
  const clientSeeds = [bytes32(), bytes32()];
  const deckHash = keccak256(
    deckCommitmentPreimage({ chainId: session.chainId, arena: state.value.address, matchId, policyVersion: POLICY_VERSION, serverSeed, clientSeeds, cards }) as Hex,
  );

  console.log(JSON.stringify({ creator: session.address, challenger: CHALLENGER, matchId, deckHash, cards }, null, 2));
  const sent = await sendArenaIntent(session.contracts, {
    kind: "arena-create",
    matchId,
    challenger: CHALLENGER,
    tier: 0,
    deckHash,
    deckSize: cards.length,
    policyVersion: POLICY_VERSION,
    potBase: 0n,
  });
  console.log(`created in ${sent.hash} · gas ${sent.receipt.gasUsed} · status ${sent.receipt.status}`);
  console.log(`\nMATCH_ID=${matchId} WALLET=${session.address.toLowerCase()} pnpm --filter @masayume/ops spike:room`);
  // The reveal material is printed rather than persisted: durable decks arrive with the deckmaster.
  console.log(JSON.stringify({ serverSeed, clientSeeds }, null, 2));
  await session.dispose();
  await closeRuntime();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error);
    finish(1);
  });
