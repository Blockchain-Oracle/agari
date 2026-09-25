import type { ArcadeGame } from "@agari/core/games/arcade";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import { ARCADE } from "@/features/games/arcade/copy";
import type { RunEnd } from "@/features/games/arcade/run";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Cta } from "~/features/games/frame";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { ISLAND, useArcadeTokens } from "./palette";

/**
 * web's `ArcadeOverlays.tsx`: Pips's two plates over the field, in the field's own ink — the title (name, pitch,
 * PLAY and the best) and the game over (banner, score, where it landed, seed and length, PLAY AGAIN). They arrive
 * as `gm-enter`. Web drops the pitch below 360 px (`compact`).
 */
function Plate({ reduced, live, label, children }: { reduced: boolean; live?: boolean; label?: string; children: ReactNode }) {
  const a = useArcadeTokens();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(280).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}
      style={[styles.overlay, { backgroundColor: a.overlay }]}
      accessibilityLabel={label}
      accessibilityLiveRegion={live ? "polite" : undefined}
    >
      {children}
    </Animated.View>
  );
}

export function TitleOverlay({ game, best, compact, reduced, onPlay }: { game: ArcadeGame; best: number | null; compact: boolean; reduced: boolean; onPlay: () => void }) {
  const a = useArcadeTokens();
  const words = ARCADE.games[game];
  return (
    <Plate reduced={reduced} label={words.title}>
      <Text style={styles.title}>{words.title.toUpperCase()}</Text>
      {compact ? null : <Text style={[styles.pitch, { color: a.ink70 }]}>{words.pitch}</Text>}
      <View style={styles.actions}>
        <Cta label={ARCADE.title.play} onPress={onPlay} style={styles.cta} />
        <Text style={[styles.best, { color: a.ink60 }]}>{(best === null ? ARCADE.title.noBest : ARCADE.title.best(ARCADE.fmt(best))).toUpperCase()}</Text>
      </View>
    </Plate>
  );
}

function bannerOf(post: PostState): { banner: string; best: boolean; sub: string | null; refused: boolean } {
  switch (post.kind) {
    case "checking":
      return { banner: ARCADE.over.over, best: false, sub: ARCADE.over.checking, refused: false };
    case "posted":
      if (post.isBest) return { banner: ARCADE.over.newBest, best: true, sub: post.rank === 1 ? ARCADE.over.topOfBoard : ARCADE.over.ranked(post.rank), refused: false };
      return { banner: ARCADE.over.ranked(post.rank), best: false, sub: post.rank <= 10 ? ARCADE.over.onBoard : ARCADE.over.keepClimbing, refused: false };
    case "refused":
      return { banner: ARCADE.over.over, best: false, sub: ARCADE.over.refused(post.why), refused: true };
    case "local":
      return { banner: ARCADE.over.over, best: false, sub: post.why === null ? null : ARCADE.over.local[post.why], refused: false };
  }
}

export function OverOverlay({ end, post, reduced, onAgain }: { end: RunEnd; post: PostState; reduced: boolean; onAgain: () => void }) {
  const a = useArcadeTokens();
  const { banner, best, sub, refused } = bannerOf(post);
  const meta = `${ARCADE.over.seed(end.seed)} · ${ARCADE.over.length((end.durationMs / 1_000).toFixed(1))}${end.calm ? ` · ${ARCADE.board.calm}` : ""}`;
  return (
    <Plate reduced={reduced} live>
      <Text style={[styles.banner, { color: best ? ISLAND.accent : a.ink60 }]}>{banner.toUpperCase()}</Text>
      <Text style={styles.score} accessibilityLabel={`Score ${ARCADE.fmt(end.score)}`}>
        {ARCADE.fmt(end.score)}
      </Text>
      {sub ? <Text style={[styles.sub, refused ? styles.subRefused : { color: a.ink55 }]}>{refused ? sub : sub.toUpperCase()}</Text> : null}
      <Text style={[styles.meta, { color: a.ink40 }]}>{meta}</Text>
      <View style={styles.actions}>
        <Cta label={ARCADE.over.again} onPress={onAgain} style={styles.cta} />
      </View>
    </Plate>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 6, justifyContent: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 26 },
  title: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, letterSpacing: 1.32, color: ISLAND.ink },
  pitch: { fontFamily: FONT.body, fontSize: 12, lineHeight: 16.8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  cta: { alignSelf: "flex-start", minHeight: 40, minWidth: 132 },
  best: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.68, fontVariant: ["tabular-nums"] },
  banner: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 2.8 },
  score: { fontFamily: PIXEL_FONT, fontSize: 33, lineHeight: 33, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  sub: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
  subRefused: { fontFamily: FONT.dataRegular, color: ISLAND.loss, letterSpacing: 0 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
