import { formatSeasonCountdown, prizeForRank, seasonRemainingMs } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { useSeason, type SeasonView } from "@/features/games/duel/useSeason";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, Hero, LoadingState } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { Avatar, Foot, Key, Refusal } from "./parts";
import { PrizeChip, PrizePanel, SeasonStrip } from "./RankParts";

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
 * web's `DuelRank.tsx` (`/games/rank`): the season banner when there is one, the ladder ranked by the settler's own
 * rating, the connected wallet's standing pinned above it, and — with a season — the prize breakdown and what the
 * pool actually escrows on chain. Ranking is the rating alone; eligibility only gates prizes.
 */
export function DuelRank({ feed }: { feed: Feed }) {
  const { address } = useWalletSession();
  const season = useSeason();
  const nowMs = useNowMs();
  const words = GAMES.rankPage;
  const remaining = season && nowMs > 0 ? seasonRemainingMs(season, nowMs) : null;

  return (
    <>
      {season ? <SeasonStrip season={season} /> : null}
      <Hero kicker={GAMES.eyebrow} title={`${words.title}.`} lead={season ? words.introSeason : words.intro}>
        {season && remaining !== null ? (
          <Foot tone="accent">
            {words.pool(String(season.prizePool.totalUnits), season.prizePool.currency)} · {remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}
          </Foot>
        ) : null}
      </Hero>

      {feed?.me ? <MyRank me={feed.me} season={season ?? null} /> : null}
      {season ? <PrizePanel season={season} /> : null}

      {feed === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !feed.configured ? (
        <Refusal>{words.notConfigured}</Refusal>
      ) : feed.rows.length === 0 ? (
        <EmptyState why={words.empty} />
      ) : (
        <Ladder rows={feed.rows} you={address ?? null} season={season ?? null} />
      )}

      {feed?.configured && feed.rows.length > 0 && !feed.me ? <Foot>{address ? words.finishToEnter : words.connectToSee}</Foot> : null}
    </>
  );
}

// 21st: trophyso/leaderboard-rankings — one bordered list, hairline-divided rows, a crown on the top three.

function Ladder({ rows, you, season }: { rows: readonly LadderRow[]; you: string | null; season: SeasonView | null }) {
  const { color } = useTheme();
  return (
    <View style={[styles.board, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityRole="list" accessibilityLabel={GAMES.rankPage.title}>
      {rows.map((row, i) => (
        <Rung key={row.wallet} place={i + 1} row={row} you={row.wallet === you} season={season} first={i === 0} />
      ))}
    </View>
  );
}

function Rung({ place, row, you, season, first }: { place: number; row: LadderRow; you: boolean; season: SeasonView | null; first: boolean }) {
  const { color } = useTheme();
  const words = GAMES.rankPage;
  const prize = season ? prizeForRank(season.prizeSplit, place) : null;
  const medal = place === 1 ? color.accent : place === 2 ? color.ink : place === 3 ? color.inkSecondary : null;
  return (
    <View
      style={[styles.rung, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline }, you && { backgroundColor: color.accentWash }]}
      accessible
      accessibilityLabel={`${place}. ${shortHex(row.wallet, 6, 4)}${you ? `, ${words.you}` : ""}. Rating ${row.rating}. ${words.matches(row.verifiedMatches)}`}
    >
      <View style={styles.place}>
        {medal ? <SymbolView name={{ ios: "crown.fill", android: "workspace_premium" }} size={12} tintColor={medal} /> : null}
        <Text style={[styles.placeText, { color: medal ?? color.inkMuted }]}>{place}</Text>
      </View>
      <Avatar address={row.wallet} size={28} />
      <View style={styles.main}>
        <Text style={[styles.addr, { color: color.ink }]} numberOfLines={1}>
          {shortHex(row.wallet, 6, 4)}
          {you ? ` · ${words.you}` : ""}
        </Text>
        <View style={styles.tags}>
          <Key>{words.matches(row.verifiedMatches)}</Key>
          {prize !== null && season ? <PrizeChip prize={prize} season={season} row={row} /> : null}
        </View>
      </View>
      <Text style={[styles.rating, { color: color.ink }]}>{row.rating}</Text>
    </View>
  );
}

/** The connected player's own standing, pinned above the board. */
function MyRank({ me, season }: { me: LadderRow & { rank: number | null }; season: SeasonView | null }) {
  const { color } = useTheme();
  const words = GAMES.rankPage;
  const prize = season && me.rank !== null ? prizeForRank(season.prizeSplit, me.rank) : null;
  return (
    <View style={[styles.mine, { borderColor: color.accent, backgroundColor: color.accentWash }]} accessible accessibilityLabel={`${me.rank === null ? words.unranked : `${words.yourRank} ${me.rank}`}. Rating ${me.rating}`}>
      <Text style={[styles.mineRank, { color: color.accent }]}>{me.rank ?? "—"}</Text>
      <View style={styles.main}>
        <Key>{me.rank === null ? words.unranked : words.yourRank}</Key>
        {prize !== null && season ? <PrizeChip prize={prize} season={season} row={me} /> : null}
      </View>
      <View style={styles.mineSide}>
        <Text style={[styles.rating, { color: color.ink }]}>{me.rating}</Text>
        <Key>{words.matches(me.verifiedMatches)}</Key>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  rung: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  place: { width: 30, alignItems: "center", gap: 1 },
  placeText: { fontFamily: FONT.dataStrong, fontSize: 14, fontVariant: ["tabular-nums"] },
  main: { flex: 1, gap: 3 },
  addr: { fontFamily: FONT.data, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  rating: { fontFamily: FONT.dataStrong, fontSize: 18, fontVariant: ["tabular-nums"] },
  mine: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  mineRank: { fontFamily: FONT.dataStrong, fontSize: 26, minWidth: 36, textAlign: "center" },
  mineSide: { alignItems: "flex-end", gap: 2 },
});
