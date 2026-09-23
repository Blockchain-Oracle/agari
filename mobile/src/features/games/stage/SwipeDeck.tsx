/**
 * The shared swipe deck — web's `features/games/stage/SwipeDeck.tsx` as a native gesture (Gesture Handler +
 * Reanimated). Practice and the Duel use it; it knows a card's identity and nothing about money.
 *
 * Props (same names as web, so a mode ports by changing imports):
 *   cards       readonly DeckCard[]                           the whole deck, for the pips and the stack
 *   active      DeckCard | null                               the card awaiting a swipe; null = played out
 *   playedSide  (cardIndex) => Pick | null                    which way a card was played, for the pips
 *   onPick      (card, side) => void                          a committed throw (drag or button)
 *   busy?       boolean                                       a pick is in flight: the card holds, the calls go quiet
 *   refusal?    string | null                                 why this card cannot be played now (shown above the calls)
 *   odds?       DeckOdds | null                               per-side { pct, locked }; a locked side springs back
 *   renderFace  (card, place: { position, total }) => node    the face; `StageFace` draws web's bands
 *   hint?       ReactNode                                     replaces the default hint line (a string is styled)
 *
 * Drag up = Up, drag down = Down, as web. Past 84 pt of travel or 480 pt/s the throw commits; below both it springs
 * back. The card tilts with the drag, a tint rises on the chosen side, a stamp appears past 24 pt, the face's mascot
 * reacts (via `LeanContext`), the next card comes forward; a confirmed pick flies the card off. Reduced motion (the
 * game setting, or the OS) removes the drag and the flight; the two calls are always drawn and always sufficient,
 * and VoiceOver/TalkBack get increment (Up) / decrement (Down) actions on the card.
 * Sound + haptic: swipe-up / swipe-down on a commit, deny on a refusal — through `~/games/feedback`.
 * The deck must not sit inside a vertical ScrollView (the drag is vertical): give it a fixed layout.
 */
import type { DeckCard, Pick } from "@agari/core/games";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from "react-native-reanimated";
import { STAGE } from "@/features/games/stage/copy";
import { FONT, useTheme } from "~/theme";
import { cadenceLabel } from "./cadence";
import { BehindCards, CardShell, LeavingCard, useDragStyles } from "./DeckCards";
import { Call, DeckEmpty, ProgressStrip, type DeckOdds, type SideOdds } from "./DeckParts";
import { LeanContext } from "./lean";
import { useStageFeel } from "./useStageFeel";

export type { DeckOdds, SideOdds };

export interface DeckPlace {
  position: number;
  total: number;
}

export interface SwipeDeckProps {
  cards: readonly DeckCard[];
  active: DeckCard | null;
  playedSide: (cardIndex: number) => Pick | null;
  onPick: (card: DeckCard, side: Pick) => void;
  busy?: boolean;
  refusal?: string | null;
  odds?: DeckOdds | null;
  renderFace: (card: DeckCard, place: DeckPlace) => ReactNode;
  hint?: ReactNode;
}

/** web's thresholds, in points. */
const COMMIT_TRAVEL = 84;
const COMMIT_VELOCITY = 480;
const STAMP_AT = 24;
/** web's `dragElastic`: the card follows the finger at this fraction, so it feels held on a spring. */
const ELASTIC = 0.7;
const LOCKED_HINT_MS = 4_000;
const SETTLE = { stiffness: 260, damping: 26 };
const NO_ODDS: SideOdds = { pct: null, locked: false };
/** web's hint mentions arrow keys; a phone has none, so the phone's line names what it does have. */
const PHONE_HINT = "Swipe up or down — the buttons do the same.";

export function SwipeDeck({ cards, active, playedSide, onPick, busy = false, refusal = null, odds = null, renderFace, hint }: SwipeDeckProps) {
  const { color } = useTheme();
  const { reducedMotion, feedback } = useStageFeel();
  const [thrown, setThrown] = useState<Pick | null>(null);
  const [lockedHint, setLockedHint] = useState<Pick | null>(null);
  const [leaning, setLeaning] = useState<Pick | null>(null);
  const [leaving, setLeaving] = useState<{ card: DeckCard; side: Pick; place: DeckPlace } | null>(null);
  const previous = useRef<{ card: DeckCard; place: DeckPlace } | null>(null);

  const held = busy || refusal !== null;
  const draggable = active !== null && !held && !reducedMotion;
  const sideOdds = { up: odds?.up ?? NO_ODDS, down: odds?.down ?? NO_ODDS };

  const position = active ? cards.findIndex((card) => card.index === active.index) : cards.length;
  const behind = active ? cards.slice(position + 1, position + 3) : [];
  const place: DeckPlace = { position: Math.min(position + 1, cards.length), total: cards.length };

  const y = useSharedValue(0);
  const height = useSharedValue(420);
  const drag = useDragStyles(y, height, COMMIT_TRAVEL);

  // The locked reason clears on its own, and with the card: a new card has its own sides.
  useEffect(() => {
    if (!lockedHint) return;
    const timer = setTimeout(() => setLockedHint(null), LOCKED_HINT_MS);
    return () => clearTimeout(timer);
  }, [lockedHint]);

  // A new card: the one that left flies off the way it was thrown, the drag resets, a screen reader hears the deck advance.
  useEffect(() => {
    const prior = previous.current;
    if (prior && prior.card.index !== active?.index && thrown && !reducedMotion) {
      setLeaving({ card: prior.card, side: thrown, place: prior.place });
    }
    setThrown(null);
    setLockedHint(null);
    setLeaning(null);
    y.value = 0;
    previous.current = active ? { card: active, place } : null;
    if (active) AccessibilityInfo.announceForAccessibility(STAGE.announce(place.position, place.total, active.asset, cadenceLabel(active.intervalSec)));
    // Keyed on the card's identity only: `place` and `thrown` are read as they stand when the card changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.index]);

  const commit = useCallback(
    (side: Pick) => {
      if (!active || held) {
        feedback("deny");
        return;
      }
      // Flicky refuses the long-shot side before the chain can: the card springs back and says why.
      if (sideOdds[side].locked) {
        feedback("deny");
        setLockedHint(side);
        return;
      }
      feedback(side === "up" ? "swipe-up" : "swipe-down");
      setThrown(side);
      onPick(active, side);
    },
    [active, held, onPick, feedback, sideOdds.up.locked, sideOdds.down.locked],
  );

  const leanFromCode = useCallback((code: number) => setLeaning(code > 0 ? "up" : code < 0 ? "down" : null), []);
  const crossed = useCallback(() => feedback("tap"), [feedback]);

  useAnimatedReaction(
    () => (y.value < -STAMP_AT ? 1 : y.value > STAMP_AT ? -1 : 0),
    (code, prior) => {
      if (code !== prior) runOnJS(leanFromCode)(code);
    },
  );
  useAnimatedReaction(
    () => Math.abs(y.value) / ELASTIC >= COMMIT_TRAVEL,
    (past, prior) => {
      if (past && prior === false) runOnJS(crossed)();
    },
  );

  const pan = Gesture.Pan()
    .enabled(draggable)
    .activeOffsetY([-8, 8])
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      y.value = event.translationY * ELASTIC;
    })
    .onEnd((event) => {
      const up = event.translationY <= -COMMIT_TRAVEL || event.velocityY <= -COMMIT_VELOCITY;
      const down = event.translationY >= COMMIT_TRAVEL || event.velocityY >= COMMIT_VELOCITY;
      y.value = withSpring(0, SETTLE);
      // Both true is a fast flick that ended back near the origin — the travel decides.
      if (up && !down) runOnJS(commit)("up");
      else if (down && !up) runOnJS(commit)("down");
    });

  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") commit("up");
    if (event.nativeEvent.actionName === "decrement") commit("down");
  };

  const hintLine = lockedHint ? (
    <Text style={[styles.hint, { color: color.accent }]}>{STAGE.hintLocked(lockedHint)}</Text>
  ) : hint === undefined ? (
    <Text style={[styles.hint, { color: color.inkSecondary }]}>{held && refusal ? STAGE.hintHeld : PHONE_HINT}</Text>
  ) : typeof hint === "string" ? (
    <Text style={[styles.hint, { color: color.inkSecondary }]}>{hint}</Text>
  ) : (
    hint
  );

  return (
    <View style={styles.stage}>
      <ProgressStrip cards={cards} active={active} playedSide={playedSide} label={STAGE.cardOf(place.position, place.total)} />

      <View style={styles.deck}>
        <BehindCards cards={behind} progress={drag.progress} />
        {active ? (
          <GestureDetector gesture={pan}>
            <Animated.View
              key={active.index}
              style={reducedMotion ? undefined : drag.card}
              onLayout={(event) => {
                height.value = event.nativeEvent.layout.height;
              }}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={STAGE.cardLabel(active.asset, cadenceLabel(active.intervalSec))}
              accessibilityHint={PHONE_HINT}
              accessibilityActions={[
                { name: "increment", label: STAGE.up },
                { name: "decrement", label: STAGE.down },
              ]}
              onAccessibilityAction={onAction}
            >
              <LeanContext.Provider value={leaning}>
                <CardShell held={held} reducedMotion={reducedMotion} drag={drag} leaning={leaning}>
                  {renderFace(active, place)}
                </CardShell>
              </LeanContext.Provider>
            </Animated.View>
          </GestureDetector>
        ) : (
          <DeckEmpty />
        )}
        {leaving ? (
          <LeavingCard key={`leaving-${leaving.card.index}`} side={leaving.side} onDone={() => setLeaving(null)}>
            <LeanContext.Provider value={leaving.side}>{renderFace(leaving.card, leaving.place)}</LeanContext.Provider>
          </LeavingCard>
        ) : null}
      </View>

      {refusal ? (
        <View style={[styles.refusal, { borderColor: color.accentDim, backgroundColor: color.accentWash }]}>
          <Text style={[styles.refusalText, { color: color.inkSecondary }]}>{refusal}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Call side="up" odds={sideOdds.up} disabled={!active || held} onPress={() => commit("up")} />
        <Call side="down" odds={sideOdds.down} disabled={!active || held} onPress={() => commit("down")} />
      </View>

      {hintLine}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: 14 },
  // Above the calls and the hint that follow it, so a card dragged down over them stays on top.
  deck: { position: "relative", zIndex: 2, elevation: 2 },
  refusal: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  refusalText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10 },
  hint: { fontFamily: FONT.data, fontSize: 10.5, lineHeight: 16, textAlign: "center" },
});
