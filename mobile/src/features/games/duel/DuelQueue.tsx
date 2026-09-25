import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { DUEL } from "@/features/games/duel/copy";
import type { QueueView } from "@/features/games/duel/useDuelRoom";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { Cta } from "~/features/games/frame";
import { PIXEL_FONT } from "~/theme/web/games";
import { SearchingBanner } from "../shell/PixelArt";
import { useStageFeel } from "../stage";
import { DeckLine, Facts, Foot, Plate, PlateTitle, useDuelTokens } from "./parts";

/**
 * web's `DuelQueue.tsx`: waiting for an opponent, with the venue's own supply beside the count. `nextDeckInSec` has
 * three values that must not be merged: a number is a countdown, null is "further out than the projection looked",
 * absent is "not known yet".
 */
export function DuelQueue({ queue, waitedSec, onLeave }: { queue: QueueView | null; waitedSec: number; onLeave: () => void }) {
  const session = useMarketSession();
  const closed = session !== null && !session.open;
  const deckLine =
    queue === null || queue.nextDeckInSec === undefined
      ? DUEL.queue.deckUnknown
      : queue.nextDeckInSec === null
        ? closed
          ? DUEL.queue.deckClosed(session?.label ?? "")
          : DUEL.queue.deckNone
        : DUEL.queue.deckIn(queue.nextDeckInSec);

  return (
    <Plate>
      <Searching />
      <PlateTitle spinning>{DUEL.queue.title}</PlateTitle>
      <Facts
        items={[
          { k: DUEL.queue.waited(waitedSec), v: queue ? DUEL.queue.waiting(queue.waitingCount) : "—" },
          { k: DUEL.entry.mode, v: queue ? DUEL.queue.band(queue.bandNow) : "—" },
        ]}
      />
      <DeckLine>{deckLine}</DeckLine>
      <Foot>{closed ? DUEL.queue.deckWhyClosed : DUEL.queue.deckWhy}</Foot>
      <Cta label={DUEL.queue.leave} variant="leave" onPress={onLeave} />
    </Plate>
  );
}

/**
 * Flicky's searching banner (`.du-searching.du-breathe`): a vermilion-washed plate that breathes in its border and
 * glow over 2.4 s rather than pinging, the banner art at up to 320 wide, the word in the pixel face and three dots
 * that bounce 150 ms apart. Still when motion is reduced.
 */
function Searching() {
  const { d, color } = useDuelTokens();
  const { reducedMotion } = useStageFeel();
  const [width, setWidth] = useState(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    breathe.value = withRepeat(withTiming(1, { duration: 1_200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [reducedMotion, breathe]);
  const plate = useAnimatedStyle(() => ({
    borderColor: interpolateColor(breathe.value, [0, 1], [d.searchingBorder, d.searchingBorderPeak]),
    shadowOpacity: breathe.value,
  }));
  return (
    <Animated.View
      style={[styles.searching, { backgroundColor: d.searchingBg, borderColor: d.searchingBorder, shadowColor: d.searchingGlow }, plate]}
      onLayout={(e) => setWidth(Math.min(320, e.nativeEvent.layout.width - 40))}
      accessibilityRole="progressbar"
      accessibilityLabel={DUEL.queue.searching}
    >
      {width > 0 ? <SearchingBanner size={width} /> : null}
      <Text style={[styles.word, { color: color.inkSecondary }]}>{DUEL.queue.searching.toUpperCase()}</Text>
      <View style={styles.dots}>
        {[0, 150, 300].map((delay) => (
          <Dot key={delay} delay={delay} still={reducedMotion} />
        ))}
      </View>
    </Animated.View>
  );
}

/** One `.du-dots` dot: up 6 px at 30 % of each 1 s cycle, back by 60 %. */
function Dot({ delay, still }: { delay: number; still: boolean }) {
  const { color } = useDuelTokens();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    lift.value = withDelay(delay, withRepeat(withSequence(withTiming(-6, { duration: 300 }), withTiming(0, { duration: 300 }), withTiming(0, { duration: 400 })), -1, false));
    return () => cancelAnimation(lift);
  }, [delay, still, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color.ink }, style]} />;
}

const styles = StyleSheet.create({
  searching: { alignItems: "center", justifyContent: "center", gap: 10, minHeight: 120, borderRadius: 16, borderWidth: 1, padding: 20, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  word: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.98 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 9999 },
});
