import { formatSeasonCountdown, prizeForRank, seasonRemainingMs } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { useSeason, type SeasonView } from "@/features/games/duel/useSeason";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { SeasonBanner } from "../hub/SeasonBanner";
import { StageHead } from "../stage";
import { Avatar, Body, Key, Refusal, useDuelTokens } from "./parts";
import { Place, PrizeChip, PrizePanel, rungStyles } from "./RankParts";

export interface LadderRow {
  wallet: string;
  rating: number;
  verifiedMatches: number;
  stakedDuels: number;
  eligible: boolean;
}

type Feed = { configured: boolean; rows: LadderRow[]; me: (LadderRow & { rank: number | null }) | null } | null;

const POLL_MS = 10_000;

/** The ladder's feed, polled as web does, with a reload for pull-to-refresh. */
export function useLadder(): { feed: Feed; reload: () => Promise<void> } {
  const { address } = useWalletSession();
  const [feed, setFeed] = useState<Feed>(null);
  const reload = useCallback(
    () =>
      fetch(`/api/games/rank${address ? `?address=${address}` : ""}`)
        .then((r) => r.json() as Promise<NonNullable<Feed>>)
        .then(setFeed)
        .catch(() => undefined),
    [address],
  );
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return { feed, reload };
}

/**
 * web's `DuelRank.tsx` (`/games/rank`, Flicky's `rank.tsx`): the season banner, the `.du-head` with its intro and —
 * in a season — the pool and countdown in the pixel face, the connected wallet's own standing pinned above the board,
 * the prize panel with what the pool escrows on chain, then the ladder of `.du-rung`s with medals on the top three.
 * Ranking is the rating alone; eligibility only gates prizes.
 */
export function DuelRank({ feed }: { feed: Feed }) {
  const { color } = useDuelTokens();
  const { address } = useWalletSession();
  const season = useSeason();
  const nowMs = useNowMs();
  const words = GAMES.rankPage;
  const remaining = season && nowMs > 0 ? seasonRemainingMs(season, nowMs) : null;
  const you = address ?? null;

  return (
    <>
      {season ? <SeasonBanner season={season} /> : null}
      <View style={styles.head}>
        <StageHead eyebrow={GAMES.eyebrow} title={words.title} />
        <View style={styles.headBody}>
          <Body>{season ? words.introSeason : words.intro}</Body>
          {season && remaining !== null ? (
            <Text style={[styles.seasonLine, { color: color.accent }]}>
              {`${words.pool(String(season.prizePool.totalUnits), season.prizePool.currency)} · ${remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}`.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>

      {feed?.me ? <MyRank me={feed.me} season={season ?? null} /> : null}
      {season ? <PrizePanel season={season} /> : null}

      {feed === null ? (
        <Body>{words.loading}</Body>
      ) : !feed.configured ? (
        <Refusal>{words.notConfigured}</Refusal>
      ) : feed.rows.length === 0 ? (
        <Body>{words.empty}</Body>
      ) : (
        <View style={styles.ladder} accessibilityRole="list" accessibilityLabel={words.title}>
          {feed.rows.map((row, i) => (
            <Rung key={row.wallet} place={i + 1} row={row} you={row.wallet === you} season={season ?? null} />
          ))}
        </View>
      )}

      {feed?.configured && feed.rows.length > 0 && !feed.me ? (
        <Text style={[styles.center, { color: color.inkSecondary }]}>{you ? words.finishToEnter : words.connectToSee}</Text>
      ) : null}
    </>
  );
}

/** `.du-rung`: the place (a medallion for the top three), the hue avatar, the address over its tags, the rating. */
function Rung({ place, row, you, season }: { place: number; row: LadderRow; you: boolean; season: SeasonView | null }) {
  const { color } = useDuelTokens();
  const words = GAMES.rankPage;
  const prize = season ? prizeForRank(season.prizeSplit, place) : null;
  return (
    <View
      style={[rungStyles.rung, { borderColor: you ? color.accent : color.hairline, backgroundColor: color.surface1 }]}
      accessible
      accessibilityLabel={`${place}. ${shortHex(row.wallet, 6, 4)}${you ? `, ${words.you}` : ""}. Rating ${row.rating}. ${words.matches(row.verifiedMatches)}`}
    >
      <Place place={place} medal />
      <Avatar address={row.wallet} />
      <View style={rungStyles.main}>
        <Text style={[rungStyles.addr, { color: color.ink }]} numberOfLines={1}>
          {shortHex(row.wallet, 6, 4)}
          {you ? ` · ${words.you}` : ""}
        </Text>
        <View style={rungStyles.tags}>
          <Key>{words.matches(row.verifiedMatches)}</Key>
          {prize !== null && season ? <PrizeChip prize={prize} season={season} row={row} /> : null}
        </View>
      </View>
      <Text style={[rungStyles.rating, { color: color.ink }]}>{row.rating}</Text>
    </View>
  );
}

/** The connected player's own standing (Flicky's `MyRankCard`), pinned above the board in the accent edge. */
function MyRank({ me, season }: { me: LadderRow & { rank: number | null }; season: SeasonView | null }) {
  const { color } = useDuelTokens();
  const words = GAMES.rankPage;
  const prize = season && me.rank !== null ? prizeForRank(season.prizeSplit, me.rank) : null;
  return (
    <View
      style={[rungStyles.rung, styles.mine, { borderColor: color.accent, backgroundColor: color.surface1 }]}
      accessible
      accessibilityLabel={`${me.rank === null ? words.unranked : `${words.yourRank} ${me.rank}`}. Rating ${me.rating}`}
    >
      <Place place={me.rank} />
      <View style={rungStyles.main}>
        <Key>{me.rank === null ? words.unranked : words.yourRank}</Key>
        {prize !== null && season ? <PrizeChip prize={prize} season={season} row={me} /> : null}
      </View>
      <View style={rungStyles.side}>
        <Text style={[rungStyles.rating, { color: color.ink }]}>{me.rating}</Text>
        <Key>{words.matches(me.verifiedMatches)}</Key>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 20 },
  headBody: { marginTop: -20 },
  seasonLine: { marginTop: 6, fontFamily: PIXEL_FONT, fontSize: 16, lineHeight: 25.6, letterSpacing: 2.24, fontVariant: ["tabular-nums"] },
  ladder: { gap: 8 },
  mine: { marginBottom: 12 },
  center: { marginTop: 12, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
