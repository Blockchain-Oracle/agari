import { PRACTICE_WATCH_SEC, type PracticeRound } from "@agari/core/games";
import type { AssetPrice } from "@agari/core/types";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { PRACTICE } from "@/features/games/practice/copy";
import { useStageTokens } from "~/features/games/stage";
import { FONT } from "~/theme";
import { practiceStyles } from "./PracticePanels";
import { PracticeRow } from "./PracticeRow";

/**
 * web's `PracticeWatch` (`.pr-watch`): the thirty seconds between the last swipe and the score — the title and the
 * clock, a 3 px bar easing down each second, the note, then every card's live move with nothing called yet.
 */
export function PracticeWatch({ round, leftSec, priceOf }: { round: PracticeRound; leftSec: number; priceOf: (asset: string) => AssetPrice | null }) {
  const { s, color } = useStageTokens();
  const fraction = Math.max(0, Math.min(1, leftSec / PRACTICE_WATCH_SEC));
  const width = useSharedValue(fraction);
  useEffect(() => {
    width.value = withTiming(fraction, { duration: 900, easing: Easing.linear });
  }, [fraction, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const picks = round.picks.slice().sort((a, b) => a.cardIndex - b.cardIndex);
  return (
    <View style={styles.watch} accessibilityLabel={PRACTICE.watch.label}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {PRACTICE.watch.label}
        </Text>
        <Text style={[styles.clock, { color: color.accent }]} accessibilityRole="timer">
          {PRACTICE.watch.left(leftSec)}
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: s.watchBar }]}>
        <Animated.View style={[styles.fill, { backgroundColor: color.accent }, fill]} />
      </View>
      <Text style={[practiceStyles.foot, { color: color.inkMuted }]}>{PRACTICE.watch.body}</Text>
      <View style={styles.rows}>
        {picks.map((pick) => {
          const card = round.cards.find((c) => c.index === pick.cardIndex);
          if (!card) return null;
          return <PracticeRow key={pick.cardIndex} card={card} side={pick.side} entryRaw={pick.entryRaw} closeRaw={priceOf(card.asset)?.priceRaw ?? null} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  watch: { gap: 12 },
  head: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  title: { flex: 1, fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  clock: { fontFamily: FONT.dataRegular, fontSize: 24, lineHeight: 38.4, fontVariant: ["tabular-nums"] },
  bar: { height: 3, borderRadius: 9999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 9999 },
  rows: { gap: 8 },
});
