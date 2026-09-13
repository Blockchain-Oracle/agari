"use client";

import { RANGE_NOT_DEPLOYED, type RangeReserveState } from "@masayume/core/range";
import { isOk, type Reading } from "@masayume/core/schemas";
import { useRangeReserve } from "@masayume/markets/react";
import Link from "next/link";
import SectionHead from "@/components/shell/SectionHead";
import { diagnosisCopy } from "@/lib/copy";
import { gameEntriesInGroup, type GameEntry } from "./catalog";
import { GAMES } from "./copy";
import { GameCard, type CardStatus } from "./GameCard";
import { GameProfileCard } from "./GameProfileCard";
import { useLastGame } from "./last-game";
import { MatchTile } from "./MatchTile";
import { useRoomOccupancy, searchingNow } from "./duel/useRoomOccupancy";
import { useSeason } from "./duel/useSeason";
import { useGames } from "./GamesProvider";
import { PendingPlate } from "./PendingPlate";
import { SeasonBanner } from "./SeasonBanner";

/**
 * `/games` — the selection, and everything the shell knows about the player.
 *
 * The three groups come from core's own grouping, so a mode cannot appear here under a section its
 * economic kind disagrees with. Availability is read, not asserted: Range asks the deployed reserve
 * whether it is live, and every unbuilt mode names the slice it is waiting for. An active match
 * always renders above the selection, because resuming has to beat starting a new one.
 */
export function GamesHub() {
  const reserve = useRangeReserve();
  const { activeMatchId, match, feedback } = useGames();
  const last = useLastGame();
  /**
   * The duel's own occupancy, read here rather than on the duel page.
   *
   * A player standing in the hub is deciding which mode to open, and "is anyone there?" is the fact that
   * decides it. Answering it only after a wallet has signed put the question on the wrong side of the
   * one step a player might not want to take.
   */
  const occupancy = useRoomOccupancy();
  const season = useSeason();
  const presence = (entry: GameEntry): string | null => {
    if (entry.id !== "duel") return null;
    if (!occupancy) return null;
    if (!occupancy.reachable) return GAMES.card.roomDown;
    const searching = searchingNow(occupancy);
    if (searching > 0) return GAMES.card.searching(searching);
    return occupancy.pairing > 0 ? GAMES.card.inMatch(occupancy.pairing) : GAMES.card.nobody;
  };
  const status = (entry: GameEntry): CardStatus =>
    entry.id === "range" || entry.id === "moonshot" ? rangeStatus(reserve) : entry.readiness.kind === "built" ? { kind: "live" } : { kind: "pending", dependency: entry.readiness.dependency };

  return (
    <div className="container gm-page">
      <div className="gm-hero">
        <span className="gm-eyebrow">{GAMES.eyebrow}</span>
        <h1 className="page-title">
          {GAMES.title}
          <span className="accent">.</span>
        </h1>
        <p className="gm-intro">{GAMES.intro}</p>
      </div>

      {/* Flicky's home: the season banner first, tapping through to the ladder and its prizes. */}
      {season && (
        <Link href="/games/rank" className="gm-season-link" onClick={() => feedback("tap")}>
          <SeasonBanner season={season} />
        </Link>
      )}

      {activeMatchId ? (
        <MatchTile match={match} />
      ) : (
        last && (
          // Pips remembers the last game a player opened and offers it first.
          <Link href={last.href} className="gm-plate gm-resume gm-last" onClick={() => feedback("tap")}>
            <p className="gm-plate-title">{GAMES.lastGame.title}</p>
            <p className="gm-plate-body">{GAMES.lastGame.body(last.name)}</p>
            <span className="gm-resume-cta">{GAMES.lastGame.cta}</span>
          </Link>
        )
      )}

      {(["prediction", "duel", "arcade"] as const).map((group) => {
        const head = GAMES.sections[group];
        return (
          <section key={group} className="gm-section" aria-label={head.title}>
            <SectionHead number={head.number} title={head.title} desc={head.desc} />
            <div className="gm-grid">
              {gameEntriesInGroup(group).map((entry) => (
                <GameCard key={entry.id} entry={entry} status={status(entry)} presence={presence(entry)} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="gm-section" aria-label={GAMES.sections.profile.title}>
        <SectionHead {...GAMES.sections.profile} />
        <div className="gm-two">
          <GameProfileCard />
          <PendingPlate title={GAMES.achievements.title} body={GAMES.achievements.pending} dependency={GAMES.achievements.dependency} />
        </div>
      </section>

      <section className="gm-section" aria-label={GAMES.sections.history.title}>
        <SectionHead {...GAMES.sections.history} />
        <div className="gm-two">
          <Link href="/games/history" className="gm-plate gm-link-plate" onClick={() => feedback("tap")}>
            <p className="gm-plate-title">{GAMES.historyPage.title}</p>
            <p className="gm-plate-body">{GAMES.history.body}</p>
            <span className="gm-resume-cta">{GAMES.history.cta}</span>
          </Link>
          <Link href="/games/rank" className="gm-plate gm-link-plate" onClick={() => feedback("tap")}>
            <p className="gm-plate-title">{GAMES.rankPage.title}</p>
            <p className="gm-plate-body">{season ? GAMES.rankPage.introSeason : GAMES.rankPage.intro}</p>
            <span className="gm-resume-cta">{GAMES.rank.cta}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Range and Moonshot sit on one contract, so their cards report the contract, not the repo. */
function rangeStatus(reading: Reading<RangeReserveState | null> | null): CardStatus {
  if (reading === null) return { kind: "loading" };
  if (!isOk(reading)) return { kind: "unavailable", why: diagnosisCopy(reading.error.kind).headline };
  if (reading.value === null) return { kind: "unavailable", why: RANGE_NOT_DEPLOYED };
  if (reading.value.paused) return { kind: "unavailable", why: GAMES.card.paused };
  return { kind: "live" };
}
