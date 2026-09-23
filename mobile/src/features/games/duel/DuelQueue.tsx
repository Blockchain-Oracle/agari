import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { DUEL } from "@/features/games/duel/copy";
import type { QueueView } from "@/features/games/duel/useDuelRoom";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { Button } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { SearchingBanner } from "../shell/PixelArt";
import { useStageFeel } from "../stage";
import { DeckLine, Facts, Foot, Plate, PlateTitle } from "./parts";

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
      <Button label={DUEL.queue.leave} variant="destructive" onPress={onLeave} icon={{ ios: "xmark", android: "close" }} />
    </Plate>
  );
}

// 21st: su2491251/pulse-loader — a solid centre and two rings expanding out of it, behind Flicky's searching banner.

/** Flicky's searching plate: it breathes rather than pings, rings widen behind the banner, three dots bounce. */
function Searching() {
  const { color } = useTheme();
  const { reducedMotion } = useStageFeel();
  const breathe = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    breathe.value = withRepeat(withTiming(1, { duration: 1_200, easing: Easing.inOut(Easing.sin) }), -1, true);
    ringA.value = withRepeat(withTiming(1, { duration: 2_400, easing: Easing.out(Easing.quad) }), -1, false);
    ringB.value = withDelay(1_200, withRepeat(withTiming(1, { duration: 2_400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(ringA);
      cancelAnimation(ringB);
    };
  }, [reducedMotion, breathe, ringA, ringB]);
  const plate = useAnimatedStyle(() => ({ borderColor: breathe.value > 0.5 ? color.accent : color.accentDim }));
  return (
    <Animated.View
      style={[styles.searching, { backgroundColor: color.accentWash, borderColor: color.accentDim }, plate]}
      accessibilityRole="progressbar"
      accessibilityLabel={DUEL.queue.searching}
    >
      <View style={styles.rings} pointerEvents="none">
        <Ring progress={ringA} />
        <Ring progress={ringB} />
      </View>
      <SearchingBanner size={220} />
      <Text style={[styles.word, { color: color.inkSecondary }]}>{DUEL.queue.searching.toUpperCase()}</Text>
      <View style={styles.dots}>
        {[0, 150, 300].map((delay) => (
          <Dot key={delay} delay={delay} still={reducedMotion} />
        ))}
      </View>
    </Animated.View>
  );
}

function Ring({ progress }: { progress: SharedValue<number> }) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 0.3 + progress.value * 1.4 }],
  }));
  return <Animated.View style={[styles.ring, { borderColor: color.accent }, style]} />;
}

function Dot({ delay, still }: { delay: number; still: boolean }) {
  const { color } = useTheme();
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
  searching: { alignItems: "center", justifyContent: "center", gap: 10, minHeight: 150, borderRadius: 16, borderWidth: 1, padding: 20, overflow: "hidden" },
  rings: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  word: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 2 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
