import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardRanking } from "@/features/leaderboard/protocol";
import { SOCIAL } from "@/features/social/copy";
import { useFollows } from "@/features/social/useFollows";
import { useLeaderboard } from "@/features/leaderboard/useLeaderboard";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, LoadingState } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { RankRow } from "./FieldList";

/** The venue day, as web's Friends board reads it. */
const VENUE_DAY: BoardQuery = { period: "24h", ticker: null };

interface Friend {
  rank: number;
  trader: BoardRanking;
  you: boolean;
}

/**
 * web's `FriendsBoard` (features/social/FriendsBoard.tsx): the cached 24-hour board filtered to the wallets you follow
 * and yourself, each with their global rank. It adds no scan and no request beyond the follow graph.
 */
export function FriendsBoard() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const follows = useFollows(address);
  const reading = useLeaderboard(VENUE_DAY);
  const data = reading?.ok ? reading.value : null;
  const words = SOCIAL.friends;

  const friends = useMemo<Friend[]>(() => {
    if (!data || !follows.data || !address) return [];
    const circle = new Set<Address>([...follows.data.following, address]);
    return data.rankings.flatMap((trader, index) => (circle.has(trader.owner) ? [{ rank: index + 1, trader, you: trader.owner === address }] : []));
  }, [data, follows.data, address]);

  if (!address) return <EmptyState why={words.connect} action={{ label: "Connect", onPress: () => router.push("/connect") }} />;
  if (!data && reading !== null && !reading.ok) return <EmptyState why={LEADERBOARD.failed} />;
  if (!data || !follows.data) return <LoadingState shape="list" label={words.loading} />;
  if (follows.data.following.length === 0) return <EmptyState why={words.none.headline} detail={words.none.body} />;
  if (friends.every((friend) => friend.you)) return <EmptyState why={words.quiet.headline} detail={words.quiet.body} />;

  return (
    <View>
      <View style={[styles.strip, { borderColor: color.hairline }]}>
        <Text style={[styles.stripText, { color: color.accent }]}>{words.strip.left(friends.length)}</Text>
        <Text style={[styles.stripText, { color: color.inkMuted }]}>{words.strip.center}</Text>
      </View>
      {friends.map((friend) => (
        <RankRow
          key={friend.trader.owner}
          rank={friend.rank}
          trader={friend.trader}
          decimals={data.meta.decimals}
          you={friend.you}
          meta={words.cellMeta(friend.trader.tradeCount, friend.trader.winRatePct)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  stripText: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.2 },
});
