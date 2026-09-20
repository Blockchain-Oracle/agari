import { achievementsOf, NO_GAME_FACTS, type Achievement, type PlayerGameFacts } from "@agari/core/games";
import { ARCADE_GAMES, type ArcadeGame } from "@agari/core/games/arcade";
import type { Address } from "@agari/core/types";
import { bestArcadeOf, gamesStoreConfigured, listLuckyDrawsFor, listMatchesFor, readRatings } from "@agari/db";
import { ENGINE_VERSION } from "./arcade/score.server";

export interface AchievementsWire {
  /** False where this deployment keeps no games store: the page says so rather than showing an empty shelf. */
  configured: boolean;
  achievements: readonly Achievement[];
  earned: number;
}

/**
 * What a wallet has done, gathered from the records that already exist: duels the projector wrote from the arena's
 * own events, the ladder the settler verified, arcade scores the room's token vouched for, and Lucky Draws the venue
 * settled. No counter of its own, so a badge cannot drift from the record it claims.
 */
export async function gameFactsOf(wallet: Address): Promise<PlayerGameFacts> {
  const [matches, ratings, lucky, arcade] = await Promise.all([
    listMatchesFor(wallet, 200),
    readRatings([wallet]),
    listLuckyDrawsFor(wallet, 200),
    Promise.all(ARCADE_GAMES.map(async (game): Promise<ArcadeGame | null> => ((await bestArcadeOf(wallet, game, ENGINE_VERSION[game])) === null ? null : game))),
  ]);
  // A refund is not a game played: nobody read a Window right, and no badge should say they did.
  const played = matches.filter((m) => m.status === "finalized" || m.status === "forfeited");
  const won = played.filter((m) => m.winner === wallet);
  const rating = ratings.get(wallet) ?? null;
  const settled = lucky.filter((d) => d.result === "won" || d.result === "lost" || d.result === "cashed-out");
  return {
    duelsFinished: played.length,
    duelsWon: won.length,
    stakedDuelsWon: won.filter((m) => BigInt(m.potPerPlayerBase || "0") > 0n).length,
    rating: rating && rating.verifiedMatches > 0 ? rating.rating : null,
    verifiedMatches: rating?.verifiedMatches ?? 0,
    arcadeScored: arcade.filter((game): game is ArcadeGame => game !== null),
    luckyDrawsSettled: settled.length,
    luckyDrawsWon: settled.filter((d) => d.result === "won" || d.result === "cashed-out").length,
  };
}

/** The shelf for one wallet, or the locked shelf when there is no wallet: a locked badge still names what it takes. */
export async function achievementsFor(wallet: Address | null): Promise<AchievementsWire> {
  if (!gamesStoreConfigured()) return { configured: false, achievements: achievementsOf(NO_GAME_FACTS), earned: 0 };
  const facts = wallet ? await gameFactsOf(wallet) : NO_GAME_FACTS;
  const achievements = achievementsOf(facts);
  return { configured: true, achievements, earned: achievements.filter((a) => a.earned).length };
}
