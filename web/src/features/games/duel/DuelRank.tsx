"use client";

import { formatSeasonCountdown, prizeForRank, seasonRemainingMs, type PrizeTier } from "@masayume/core/games";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { useEffect, useState, type CSSProperties } from "react";
import { useNowMs } from "@/components/data";
import { addressHue } from "@/lib/address-hue";
import { useWalletSession } from "@/lib/wallet-session";
import { GAMES } from "../copy";
import { SeasonBanner } from "../SeasonBanner";
import { useSeason, type SeasonView } from "./useSeason";

/** Flicky polls its leaderboard every ten seconds. */
const POLL_MS = 10_000;

interface Row {
  wallet: string;
  rating: number;
  verifiedMatches: number;
  stakedDuels: number;
  eligible: boolean;
}

type Feed = { configured: boolean; rows: Row[]; me: (Row & { rank: number | null }) | null } | null;

/**
 * `/games/rank` — Flicky's `rank.tsx`, whole: the season banner, the ladder ranked by the settler's own
 * rating, and — when the operator has named a season — its prize overlay: a live countdown and the pool
 * in the header, the per-rank breakdown, the connected wallet's own standing pinned above the board even
 * when it sits below the cut, and every row in the money annotated with its prize and whether the player
 * has cleared the eligibility floor. Ranking itself is the rating alone; eligibility only gates prizes.
 *
 * One line the reference could not print: what the pool escrows on chain, read live. A prize here is not
 * a promise on a page — it is money already in a contract, and the ladder says how much.
 */
export function DuelRank() {
  const { address } = useWalletSession();
  const [feed, setFeed] = useState<Feed>(null);
  const season = useSeason();
  const nowMs = useNowMs();
  const words = GAMES.rankPage;

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/games/rank${address ? `?address=${address}` : ""}`)
        .then((r) => r.json() as Promise<NonNullable<Feed>>)
        .then((body) => {
          if (alive) setFeed(body);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [address]);

  const you = address?.toLowerCase() ?? null;
  const remaining = season && nowMs > 0 ? seasonRemainingMs(season, nowMs) : null;

  return (
    <div className="container gm-page">
      {season && <SeasonBanner season={season} />}
      <header className="du-head">
        <span className="gm-eyebrow">{GAMES.eyebrow}</span>
        <h1 className="du-title">
          {words.title}
          <span className="accent">.</span>
        </h1>
        <p className="du-body">{season ? words.introSeason : words.intro}</p>
        {season && remaining !== null && (
          <p className="du-season-line">
            {words.pool(String(season.prizePool.totalUnits), season.prizePool.currency)} · {remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}
          </p>
        )}
      </header>

      {feed?.me && <MyRank me={feed.me} season={season ?? null} />}
      {season && <PrizePanel season={season} />}

      {feed === null ? (
        <p className="du-body">{words.loading}</p>
      ) : !feed.configured ? (
        <p className="du-refusal">{words.notConfigured}</p>
      ) : feed.rows.length === 0 ? (
        <p className="du-body">{words.empty}</p>
      ) : (
        <ol className="du-ladder">
          {feed.rows.map((row, i) => (
            <Rung key={row.wallet} place={i + 1} row={row} you={row.wallet === you} season={season ?? null} />
          ))}
        </ol>
      )}

      {feed?.configured && feed.rows.length > 0 && !feed.me && <p className="du-foot du-center">{you ? words.finishToEnter : words.connectToSee}</p>}
    </div>
  );
}

/** The connected player's own standing, pinned above the board — Flicky's `MyRankCard`, fed by `me.rank`. */
function MyRank({ me, season }: { me: Row & { rank: number | null }; season: SeasonView | null }) {
  const words = GAMES.rankPage;
  const prize = season && me.rank !== null ? prizeForRank(season.prizeSplit, me.rank) : null;
  return (
    <div className="du-rung du-rung--mine" data-you>
      <span className="du-rung-place">{me.rank ?? "—"}</span>
      <span className="du-rung-main">
        <span className="du-k">{me.rank === null ? words.unranked : words.yourRank}</span>
        {prize !== null && season && <PrizeChip prize={prize} season={season} row={me} />}
      </span>
      <span className="du-rung-side">
        <span className="du-rung-rating">{me.rating}</span>
        <span className="du-k">{words.matches(me.verifiedMatches)}</span>
      </span>
    </div>
  );
}

/** The per-rank breakdown, derived entirely from the split — and what the pool actually holds. */
function PrizePanel({ season }: { season: SeasonView }) {
  const words = GAMES.rankPage;
  const { prizeSplit, prizePool, minStakedDuels, eligibilityNote, escrow } = season;
  const escrowLine = !escrow
    ? words.notEscrowed
    : escrow.distributed
      ? words.distributed
      : (() => {
          const have = formatBaseUnits(escrow.balanceBase, escrow.decimals, { maxDp: 2, minDp: 0 });
          const want = String(prizePool.totalUnits);
          const short = escrow.balanceBase < BigInt(prizePool.totalUnits) * 10n ** BigInt(escrow.decimals);
          return short ? words.escrowShort(have, want, escrow.symbol) : words.escrowed(have, escrow.symbol);
        })();
  return (
    <section className="du-plate du-prizes" aria-label={words.prizes(season.name)}>
      <div className="du-prizes-head">
        <span className="du-k">{words.prizes(season.name)}</span>
        <span className="du-prizes-total">
          {prizePool.totalUnits} {prizePool.currency}
        </span>
      </div>
      <ul className="du-prizes-list">
        {prizeSplit.map((tier: PrizeTier) => (
          <li key={`${tier.rankStart}-${tier.rankEnd}`} className="du-prizes-row">
            <span className="du-prizes-rank" data-medal={tier.rankStart === tier.rankEnd && tier.rankStart <= 3 ? tier.rankStart : undefined}>
              {tier.rankStart === tier.rankEnd ? words.ordinal(tier.rankStart) : `${words.ordinal(tier.rankStart)}–${words.ordinal(tier.rankEnd)}`}
            </span>
            <span className="du-prizes-amount">
              {tier.amountUnits} {prizePool.currency}
              {tier.rankStart !== tier.rankEnd && <span className="du-k"> {words.each}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="du-foot">
        {words.eligible(minStakedDuels)} · {eligibilityNote}
      </p>
      <p className="du-foot du-prizes-escrow">
        {escrowLine}
        {escrow && !escrow.distributed && <span className="du-mono"> · {shortHex(escrow.address, 6, 4)}</span>}
      </p>
    </section>
  );
}

function Rung({ place, row, you, season }: { place: number; row: Row; you: boolean; season: SeasonView | null }) {
  const words = GAMES.rankPage;
  const prize = season ? prizeForRank(season.prizeSplit, place) : null;
  return (
    <li className="du-rung" data-you={you || undefined}>
      <span className="du-rung-place" data-medal={place <= 3 ? place : undefined}>
        {place}
      </span>
      <span className="du-avatar" style={{ "--du-hue": addressHue(row.wallet) } as CSSProperties} aria-hidden />
      <span className="du-rung-main">
        <span className="du-v du-mono">
          {shortHex(row.wallet, 6, 4)}
          {you ? ` · ${words.you}` : ""}
        </span>
        <span className="du-rung-tags">
          <span className="du-k">{words.matches(row.verifiedMatches)}</span>
          {prize !== null && season && <PrizeChip prize={prize} season={season} row={row} />}
        </span>
      </span>
      <span className="du-rung-rating">{row.rating}</span>
    </li>
  );
}

/**
 * Flicky's `PrizeChip`: the prize a row in the money would win — lit when the player is eligible, muted
 * with how far they are from the floor when not, so a locked prize reads as locked.
 */
function PrizeChip({ prize, season, row }: { prize: number; season: SeasonView; row: Row }) {
  const words = GAMES.rankPage;
  return (
    <span className="du-prize-chip" data-eligible={row.eligible || undefined}>
      {words.prize(prize, season.prizePool.currency)}
      {!row.eligible && <span className="du-prize-locked"> · {words.locked(row.stakedDuels, season.minStakedDuels)}</span>}
    </span>
  );
}
