import type { ArcadeGame } from "@agari/core/games/arcade";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import { ARCADE } from "@/features/games/arcade/copy";
import type { RunEnd } from "@/features/games/arcade/run";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button } from "~/components/kit";
import { FONT, SPACE } from "~/theme";
import { ISLAND } from "./palette";

/**
 * web's `ArcadeOverlays.tsx`: Pips's two plates over the field in the field's own ink — the title (name, pitch,
 * best, PLAY) and the game over (banner, score, where it landed, PLAY AGAIN). The board sits below the screen,
 * as on web, because a board a player has to scroll inside a game screen is not a board. Web hides the pitch on
 * the narrowest screens; `compact` does the same here when the field is short.
 */
export function TitleOverlay({ game, best, compact, reduced, onPlay }: {
  game: ArcadeGame;
  best: number | null;
  compact: boolean;
  reduced: boolean;
  onPlay: () => void;
}) {
  const words = ARCADE.games[game];
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(180)}
      style={[styles.overlay, { backgroundColor: ISLAND.veil }]}
      accessibilityRole="none"
      accessibilityLabel={words.title}
    >
      <Text style={[styles.title, compact && styles.titleCompact]}>{words.title.toUpperCase()}</Text>
      {compact ? null : (
        <Text style={styles.pitch} numberOfLines={3}>
          {words.pitch}
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          label={ARCADE.title.play}
          onPress={onPlay}
          size="sm"
          block={false}
          icon={{ ios: "play.fill", android: "play_arrow" }}
          style={styles.cta}
        />
        <Text style={styles.best}>{best === null ? ARCADE.title.noBest.toUpperCase() : ARCADE.title.best(ARCADE.fmt(best)).toUpperCase()}</Text>
      </View>
    </Animated.View>
  );
}

function bannerOf(post: PostState): { banner: string; best: boolean; sub: string | null; refused: boolean } {
  switch (post.kind) {
    case "checking":
      return { banner: ARCADE.over.over, best: false, sub: ARCADE.over.checking, refused: false };
    case "posted":
      if (post.isBest) {
        return { banner: ARCADE.over.newBest, best: true, sub: post.rank === 1 ? ARCADE.over.topOfBoard : ARCADE.over.ranked(post.rank), refused: false };
      }
      return { banner: ARCADE.over.ranked(post.rank), best: false, sub: post.rank <= 10 ? ARCADE.over.onBoard : ARCADE.over.keepClimbing, refused: false };
    case "refused":
      return { banner: ARCADE.over.over, best: false, sub: ARCADE.over.refused(post.why), refused: true };
    case "local":
      return { banner: ARCADE.over.over, best: false, sub: post.why === null ? null : ARCADE.over.local[post.why], refused: false };
  }
}

export function OverOverlay({ end, post, reduced, onAgain }: { end: RunEnd; post: PostState; reduced: boolean; onAgain: () => void }) {
  const { banner, best, sub, refused } = bannerOf(post);
  const meta = `${ARCADE.over.seed(end.seed)} · ${ARCADE.over.length((end.durationMs / 1_000).toFixed(1))}${end.calm ? ` · ${ARCADE.board.calm}` : ""}`;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      style={[styles.overlay, { backgroundColor: ISLAND.veil }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.banner, best && { color: ISLAND.accent }]}>{banner.toUpperCase()}</Text>
      <Text style={styles.score} accessibilityLabel={`Score ${ARCADE.fmt(end.score)}`}>
        {ARCADE.fmt(end.score)}
      </Text>
      {sub ? (
        <Text style={[styles.sub, refused && styles.subRefused]} numberOfLines={2}>
          {refused ? sub : sub.toUpperCase()}
        </Text>
      ) : null}
      <Text style={styles.meta}>{meta}</Text>
      <View style={styles.actions}>
        <Button
          label={ARCADE.over.again}
          onPress={onAgain}
          size="sm"
          block={false}
          icon={{ ios: "arrow.clockwise", android: "replay" }}
          style={styles.cta}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: SPACE.gutter + 8,
    paddingVertical: 12,
  },
  title: { fontFamily: FONT.dataStrong, fontSize: 26, lineHeight: 28, letterSpacing: 1.5, color: ISLAND.ink },
  titleCompact: { fontSize: 22, lineHeight: 24 },
  pitch: { fontFamily: FONT.body, fontSize: 12, lineHeight: 17, color: ISLAND.inkSoft },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  cta: { minWidth: 132 },
  best: { fontFamily: FONT.data, fontSize: 12, letterSpacing: 1.6, color: ISLAND.inkSoft, fontVariant: ["tabular-nums"] },
  banner: { fontFamily: FONT.dataStrong, fontSize: 13, letterSpacing: 2.6, color: ISLAND.inkSoft },
  score: { fontFamily: FONT.dataStrong, fontSize: 38, lineHeight: 40, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  sub: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.7, color: ISLAND.inkMuted },
  subRefused: { color: ISLAND.loss, letterSpacing: 0 },
  meta: { fontFamily: FONT.data, fontSize: 10, color: ISLAND.inkMuted },
});
