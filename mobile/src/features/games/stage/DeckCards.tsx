import type { DeckCard, Pick } from "@agari/core/games";
import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { STAGE } from "@/features/games/stage/copy";
import { PIXEL_FONT } from "~/theme/web/games";
import { CardBack } from "../shell/PixelArt";
import { useStageTokens } from "./tokens";

/**
 * The cards themselves, from web's `SwipeDeck.tsx` and `stage.css`: the drag's five signals derived from one shared
 * value (tilt, the tint on the chosen side, the stamp, the next card rising), the opaque card shell, the backs in the
 * stack, and the throw — the card leaves opaque, spinning past its drag tilt, in 300 ms (Flicky's `THROW`).
 */

// 21st: ddoemonn/swipe-deck — drag-to-decide with the stack rising behind, ported to the UI thread on the vertical axis.

const DRAG_MAX_ROTATE_DEG = 18;
const FLY_ROTATE_DEG = DRAG_MAX_ROTATE_DEG + 6;
const THROW_DISTANCE = 420;
const THROW_MS = 300;
const SETTLE = { stiffness: 260, damping: 26 };

export type DragStyles = ReturnType<typeof useDragStyles>;

export function useDragStyles(y: SharedValue<number>, height: SharedValue<number>, commitTravel: number) {
  const progress = useDerivedValue(() => Math.min(1, Math.abs(y.value) / commitTravel));
  const card = useAnimatedStyle(() => {
    const half = Math.max(1, height.value / 2);
    const rotate = Math.max(-DRAG_MAX_ROTATE_DEG, Math.min(DRAG_MAX_ROTATE_DEG, -(y.value / half) * DRAG_MAX_ROTATE_DEG));
    return { transform: [{ translateY: y.value }, { rotate: `${rotate}deg` }] };
  });
  const upTint = useAnimatedStyle(() => ({ opacity: y.value < 0 ? Math.min(1, -y.value / commitTravel) : 0 }));
  const downTint = useAnimatedStyle(() => ({ opacity: y.value > 0 ? Math.min(1, y.value / commitTravel) : 0 }));
  return { card, upTint, downTint, progress };
}

/** The opaque card: a new one comes in from 96 % and 12 pt low; the tints and the stamp ride on top of the face. */
export function CardShell({ children, held, reducedMotion, drag, leaning }: {
  children: ReactNode;
  held: boolean;
  reducedMotion: boolean;
  drag: DragStyles;
  leaning: Pick | null;
}) {
  const { s } = useStageTokens();
  const enter = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) enter.value = withSpring(1, SETTLE);
  }, [enter, reducedMotion]);
  const entering = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: 12 * (1 - enter.value) }, { scale: 0.96 + 0.04 * enter.value }],
  }));
  return (
    <Animated.View style={[styles.card, { backgroundColor: s.cardBg, borderColor: s.cardBorder }, held && styles.held, entering]}>
      {children}
      {reducedMotion ? null : (
        <>
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: s.tintUp }, drag.upTint]} />
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: s.tintDown }, drag.downTint]} />
        </>
      )}
      {leaning ? <Stamp side={leaning} /> : null}
    </Animated.View>
  );
}

/** The stamp past 24 pt of travel: a bordered word at ∓6°, with the reference's hard offset shadow. */
function Stamp({ side }: { side: Pick }) {
  const { s, color } = useStageTokens();
  const ink = side === "up" ? color.profit : color.loss;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.stamp,
        side === "up" ? styles.stampUp : styles.stampDown,
        { borderColor: ink, backgroundColor: s.stampBg, boxShadow: `3px 3px 0 ${s.stampShadow}` },
      ]}
    >
      <Text style={[styles.stampText, { color: ink }]}>{(side === "up" ? STAGE.up : STAGE.down).toUpperCase()}</Text>
    </View>
  );
}

/** The two cards still to come, stacked behind and inert; the next one rises toward full size as the top is dragged. */
export function BehindCards({ cards, progress }: { cards: readonly DeckCard[]; progress: DerivedValue<number> }) {
  const { s } = useStageTokens();
  const next = useAnimatedStyle(() => ({
    transform: [{ translateY: 10 * (1 - progress.value) }, { scale: 0.965 + 0.035 * progress.value }],
  }));
  return (
    <>
      {cards
        .map((card, depth) => (
          <Animated.View
            key={card.index}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.behind,
              { backgroundColor: s.cardBg, borderColor: s.cardBorder, opacity: 0.5 - (depth + 1) * 0.14 },
              depth === 0 ? next : { transform: [{ translateY: 20 }, { scale: 0.93 }] },
            ]}
          >
            <View style={styles.backArt}>
              <CardBack size={96} />
            </View>
          </Animated.View>
        ))
        .reverse()}
    </>
  );
}

/** A confirmed card on its way out: opaque, spinning off past its tilt, then gone. */
export function LeavingCard({ side, onDone, children }: { side: Pick; onDone: () => void; children: ReactNode }) {
  const { s } = useStageTokens();
  const t = useSharedValue(0);
  // Held in a ref so a parent re-render (the clock ticks every second) never restarts the throw.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const finish = () => done.current();
    t.value = withTiming(1, { duration: THROW_MS, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [t]);
  const sign = side === "up" ? -1 : 1;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: sign * THROW_DISTANCE * t.value }, { rotate: `${sign * FLY_ROTATE_DEG * t.value}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, styles.leaving, { backgroundColor: s.cardBg, borderColor: s.cardBorder }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 20, padding: 16, borderWidth: 1, overflow: "hidden" },
  held: { opacity: 0.86 },
  leaving: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 5 },
  behind: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backArt: { opacity: 0.9 },
  tint: { ...StyleSheet.absoluteFill, borderRadius: 20, zIndex: 3 },
  stamp: {
    position: "absolute",
    zIndex: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 4,
  },
  stampUp: { top: 18, left: 18, transform: [{ rotate: "-6deg" }] },
  stampDown: { bottom: 18, right: 18, transform: [{ rotate: "6deg" }] },
  stampText: { fontFamily: PIXEL_FONT, fontSize: 33, lineHeight: 33, letterSpacing: 2.64 },
});
