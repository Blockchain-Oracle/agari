import { shortHex } from "@agari/core/units";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import { ARCADE } from "@/features/games/arcade/copy";
import type { PostAbility } from "@/features/games/arcade/useArcadeScore";
import type { BoardWire } from "@/features/games/arcade/wire";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Card, Skeleton } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { FONT, TYPE, useTheme } from "~/theme";

/**
 * web's `ArcadeBoard.tsx`: Pips's flat scoreboard — a place, a name, a score, and a tag on your own row. Names
 * are addresses, shortened, because the games' identity is the wallet. The head carries where the last run
 * landed; the foot carries the one line that never falls off: what a score here is. When a posted run moves a
 * row, the rows slide to their new places (off under reduced motion).
 */
// 21st: trophyso/leaderboard-rankings (the current-player row and rank-change motion; the rows stay web's flat list)
export function ArcadeBoard({ board, you, post, ability }: {
  board: BoardWire | null | undefined;
  you: string | null;
  post: PostState;
  ability: PostAbility;
}) {
  const { color } = useTheme();
  const { reducedMotion } = useGames();
  const words = ARCADE.board;
  const banner = post.kind === "posted" ? (post.isBest ? ARCADE.over.newBest : ARCADE.over.ranked(post.rank)) : null;
  const rows = board?.rows ?? [];

  const empty = (text: string) => <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{text}</Text>;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={[TYPE.title, styles.headTitle, { color: color.ink }]} accessibilityRole="header">
          {words.title}
        </Text>
        {banner ? <Text style={[styles.banner, { color: color.accent }]}>{banner.toUpperCase()}</Text> : null}
      </View>

      {board === undefined ? (
        <View style={styles.loading} accessibilityLabel={words.loading}>
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </View>
      ) : board === null ? (
        empty(words.unreachable)
      ) : !board.configured ? (
        empty(words.noStore)
      ) : rows.length === 0 ? (
        empty(words.empty)
      ) : (
        <View accessibilityRole="list">
          {rows.map((row, i) => {
            const isYou = you !== null && row.wallet === you;
            const ink = isYou ? color.accent : color.ink;
            return (
              <Animated.View
                key={row.wallet}
                layout={reducedMotion ? undefined : LinearTransition.duration(260)}
                entering={reducedMotion ? undefined : FadeIn.duration(200)}
                style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline }]}
                accessible
                accessibilityLabel={`Place ${i + 1}, ${shortHex(row.wallet, 6, 4)}${isYou ? ", you" : ""}${row.calm ? ", calm" : ""}, score ${ARCADE.fmt(row.score)}`}
              >
                <Text style={[styles.place, { color: color.inkMuted }]}>{i + 1}</Text>
                <View style={styles.who}>
                  <Text style={[styles.mono, { color: ink }]} numberOfLines={1}>
                    {shortHex(row.wallet, 6, 4)}
                  </Text>
                  {isYou ? <Tag label={words.you} /> : null}
                  {row.calm ? <Tag label={words.calm} /> : null}
                </View>
                <Text style={[styles.mono, styles.score, { color: ink }]}>{ARCADE.fmt(row.score)}</Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      {board?.me ? <Text style={[styles.foot, { color: color.inkSecondary }]}>{words.yours(ARCADE.fmt(board.me.best), board.me.rank)}</Text> : null}
      {ability === "signedOut" ? <Text style={[styles.foot, { color: color.inkSecondary }]}>{words.connect}</Text> : null}
      {ability === "unavailable" && board !== null ? <Text style={[styles.foot, { color: color.inkSecondary }]}>{words.unavailable}</Text> : null}
      <Text style={[styles.foot, { color: color.inkMuted }]}>{ARCADE.honesty}</Text>
    </Card>
  );
}

function Tag({ label }: { label: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.tag, { borderColor: color.hairline }]}>
      <Text style={[styles.tagText, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  headTitle: { fontSize: 15 },
  banner: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 1.6 },
  loading: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36, paddingVertical: 6 },
  place: { fontFamily: FONT.data, fontSize: 13, width: 22, fontVariant: ["tabular-nums"] },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  mono: { fontFamily: FONT.data, fontSize: 13, fontVariant: ["tabular-nums"] },
  score: { fontFamily: FONT.dataStrong },
  tag: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  tagText: { fontFamily: FONT.data, fontSize: 9, letterSpacing: 0.8 },
  foot: { fontFamily: FONT.data, fontSize: 11, lineHeight: 15 },
});
