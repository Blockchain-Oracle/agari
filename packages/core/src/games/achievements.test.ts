import { describe, expect, it } from "vitest";
import { achievementsEarned, achievementsOf, NO_GAME_FACTS, type AchievementId } from "./achievements";

const earned = (facts: Parameters<typeof achievementsOf>[0]): AchievementId[] => achievementsOf(facts).filter((a) => a.earned).map((a) => a.id);

describe("achievements", () => {
  it("gives a wallet that has never played none of them, and still names what each takes", () => {
    const list = achievementsOf(NO_GAME_FACTS);
    expect(achievementsEarned(list)).toBe(0);
    expect(list).toHaveLength(10);
    expect(list.every((a) => a.how.length > 0 && a.have === 0 && a.need >= 1)).toBe(true);
  });

  it("follows from the record and nothing else: one settled duel, one win, one pot", () => {
    expect(earned({ ...NO_GAME_FACTS, duelsFinished: 1 })).toEqual(["first-duel"]);
    expect(earned({ ...NO_GAME_FACTS, duelsFinished: 1, duelsWon: 1 })).toEqual(["first-duel", "first-win"]);
    // A free duel's win is a win, but not a win with a pot on the table.
    expect(earned({ ...NO_GAME_FACTS, duelsFinished: 1, duelsWon: 1, stakedDuelsWon: 1 })).toContain("staked-win");
  });

  it("counts the ladder and the rating apart: a verified duel is not a rating over 1000", () => {
    expect(earned({ ...NO_GAME_FACTS, verifiedMatches: 1, rating: 976 })).toEqual(["rated"]);
    expect(earned({ ...NO_GAME_FACTS, verifiedMatches: 1, rating: 1_000 })).toEqual(["rated"]);
    expect(earned({ ...NO_GAME_FACTS, verifiedMatches: 1, rating: 1_024 })).toEqual(["rated", "climber"]);
  });

  it("needs both machines for the pair, and shows the progress towards it", () => {
    const one = achievementsOf({ ...NO_GAME_FACTS, arcadeScored: ["line-rider"] });
    expect(one.find((a) => a.id === "arcade-both")).toMatchObject({ have: 1, need: 2, earned: false });
    expect(earned({ ...NO_GAME_FACTS, arcadeScored: ["line-rider", "candle-hop"] })).toEqual(["arcade-debut", "arcade-both"]);
  });

  it("caps progress at what a badge needs, so five duels does not read as ten of five", () => {
    const list = achievementsOf({ ...NO_GAME_FACTS, duelsFinished: 12 });
    expect(list.find((a) => a.id === "five-duels")).toMatchObject({ have: 5, need: 5, earned: true });
    expect(list.find((a) => a.id === "first-duel")).toMatchObject({ have: 1, need: 1 });
  });

  it("is earned by the player who did it: the winner of the devnet duel of 2026-09-20, and their opponent", () => {
    // Creator: one finished duel, won, tier 1 (a pot), verified, 1024.
    expect(earned({ ...NO_GAME_FACTS, duelsFinished: 1, duelsWon: 1, stakedDuelsWon: 1, verifiedMatches: 1, rating: 1_024 })).toEqual(["first-duel", "first-win", "staked-win", "rated", "climber"]);
    // Challenger: the same duel, lost.
    expect(earned({ ...NO_GAME_FACTS, duelsFinished: 1, verifiedMatches: 1, rating: 976 })).toEqual(["first-duel", "rated"]);
  });
});
