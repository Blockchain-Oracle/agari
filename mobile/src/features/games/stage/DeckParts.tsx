import type { DeckCard, Pick } from "@agari/core/games";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STAGE } from "@/features/games/stage/copy";
import { FONT, RADIUS, useTheme } from "~/theme";

/**
 * The parts of web's `SwipeDeck.tsx` around the card: the progress strip (a pip per card, coloured by the side
 * played), the fifth band's two calls with a side's odds on each, and the played-out plate.
 */

export interface SideOdds {
  pct: number | null;
  locked: boolean;
}

export interface DeckOdds {
  up: SideOdds;
  down: SideOdds;
}

export function ProgressStrip({ cards, active, playedSide, label }: {
  cards: readonly DeckCard[];
  active: DeckCard | null;
  playedSide: (cardIndex: number) => Pick | null;
  label: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.progress}>
      <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cards.map((card) => {
          const side = playedSide(card.index);
          const fill = side === "up" ? color.profit : side === "down" ? color.loss : card.index === active?.index ? color.accent : color.borderStrong;
          return <View key={card.index} style={[styles.pip, { backgroundColor: fill }]} />;
        })}
      </View>
      <Text style={[styles.progressLabel, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/**
 * One call: an arrow, the word, the side's odds. A locked side stays pressable — the press is how a player learns
 * why — and is drawn dimmed, as the reference's `opacity-35 grayscale`.
 */
export function Call({ side, odds, disabled, onPress }: { side: Pick; odds: SideOdds; disabled: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const ink = side === "up" ? color.profit : color.loss;
  const wash = side === "up" ? color.profitWash : color.lossWash;
  const word = side === "up" ? STAGE.up : STAGE.down;
  const showOdds = odds.pct !== null || odds.locked;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={showOdds ? `${word}, ${odds.locked ? STAGE.locked : `${odds.pct}%`}` : word}
      accessibilityHint={odds.locked ? STAGE.hintLocked(side) : undefined}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.call,
        { backgroundColor: wash, borderColor: ink },
        (disabled || odds.locked) && styles.dim,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <SymbolView name={side === "up" ? { ios: "chevron.up", android: "keyboard_arrow_up" } : { ios: "chevron.down", android: "keyboard_arrow_down" }} size={16} tintColor={ink} />
      <Text style={[styles.callWord, { color: ink }]}>{word.toUpperCase()}</Text>
      {showOdds ? <Text style={[styles.callOdds, { color: ink }]}>{odds.locked ? STAGE.locked : `${odds.pct}%`}</Text> : null}
    </Pressable>
  );
}

export function DeckEmpty() {
  const { color } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: color.borderStrong }]}>
      <Text style={[styles.emptyTitle, { color: color.ink }]}>{STAGE.empty.title}</Text>
      <Text style={[styles.emptyBody, { color: color.inkSecondary }]}>{STAGE.empty.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", alignItems: "center", gap: 10 },
  pips: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  pip: { width: 22, height: 4, borderRadius: RADIUS.full },
  progressLabel: { marginLeft: "auto", fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.9 },
  call: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  dim: { opacity: 0.42 },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.88 },
  callWord: { fontFamily: FONT.heading, fontSize: 14, letterSpacing: 0.6 },
  callOdds: { fontFamily: FONT.data, fontSize: 15, opacity: 0.8, fontVariant: ["tabular-nums"] },
  empty: {
    minHeight: 224,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 24,
  },
  emptyTitle: { fontFamily: FONT.heading, fontSize: 14 },
  emptyBody: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
