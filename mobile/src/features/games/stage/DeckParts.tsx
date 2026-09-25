import type { DeckCard, Pick } from "@agari/core/games";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STAGE } from "@/features/games/stage/copy";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { useStageTokens } from "./tokens";

/**
 * The parts of web's `SwipeDeck.tsx` around the card (stage.css): the progress strip (a 22 × 4 pip per card,
 * coloured by the side played) with "Card N of M" in the pixel face, the fifth band's two `.st-call` chips with
 * a side's odds on each, and the dashed `.st-empty` plate.
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
  const { s, color } = useStageTokens();
  return (
    <View style={styles.progress}>
      <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cards.map((card) => {
          const side = playedSide(card.index);
          const fill = side === "up" ? color.profit : side === "down" ? color.loss : card.index === active?.index ? s.pipActive : s.pip;
          return <View key={card.index} style={[styles.pip, { backgroundColor: fill }]} />;
        })}
      </View>
      <Text style={[styles.progressLabel, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/**
 * `.st-call`: an arrow, the word, the side's odds, in the side's wash with its ink for the border, and the two
 * inset lips. A locked side stays pressable — the press is how a player learns why — at 40 %, as the reference's
 * `opacity-35 grayscale`.
 */
export function Call({ side, odds, disabled, onPress }: { side: Pick; odds: SideOdds; disabled: boolean; onPress: () => void }) {
  const { s, color } = useStageTokens();
  const ink = side === "up" ? color.profit : color.loss;
  const wash = side === "up" ? color.profitWash : color.lossWash;
  const word = side === "up" ? STAGE.up : STAGE.down;
  const Arrow = side === "up" ? ChevronUp : ChevronDown;
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
        { backgroundColor: wash, borderColor: ink, boxShadow: `inset 0 2px 0 ${s.callLipTop}, inset 0 -2px 0 ${s.callLipBottom}` },
        disabled ? styles.disabled : odds.locked ? styles.locked : null,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Arrow size={16} color={ink} strokeWidth={2} />
      <Text style={[styles.callWord, { color: ink }]}>{word.toUpperCase()}</Text>
      {showOdds ? <Text style={[styles.callOdds, { color: ink }]}>{odds.locked ? STAGE.locked : `${odds.pct}%`}</Text> : null}
    </Pressable>
  );
}

export function DeckEmpty() {
  const { s, color } = useStageTokens();
  return (
    <View style={[styles.empty, { borderColor: s.emptyBorder }]}>
      <Text style={[styles.emptyTitle, { color: color.ink }]}>{STAGE.empty.title}</Text>
      <Text style={[styles.emptyBody, { color: color.inkSecondary }]}>{STAGE.empty.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", alignItems: "center", gap: 10 },
  pips: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  pip: { width: 22, height: 4, borderRadius: 9999 },
  progressLabel: { marginLeft: "auto", fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88 },
  call: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1 },
  disabled: { opacity: 0.42 },
  locked: { opacity: 0.4 },
  pressed: { transform: [{ translateY: 1 }] },
  callWord: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.56 },
  callOdds: { fontFamily: PIXEL_FONT, fontSize: 16, letterSpacing: 0.96, opacity: 0.75, fontVariant: ["tabular-nums"] },
  empty: { minHeight: 224, alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", padding: 24 },
  emptyTitle: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  emptyBody: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
});
