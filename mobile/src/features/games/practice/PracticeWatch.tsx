import { PRACTICE_WATCH_SEC, type PracticeRound } from "@agari/core/games";
import type { AssetPrice } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { PracticeRow } from "./PracticeRow";

/**
 * web's `PracticeWatch`: the thirty seconds between the last swipe and the score. Every card's live move is on
 * screen and none is called yet; the bar and the clock only claim how long is left. An unreadable feed shows a
 * dash rather than freezing at its entry, which would read as "no movement".
 */
export function PracticeWatch({ round, leftSec, priceOf }: { round: PracticeRound; leftSec: number; priceOf: (asset: string) => AssetPrice | null }) {
  const { color } = useTheme();
  const fraction = Math.max(0, Math.min(1, leftSec / PRACTICE_WATCH_SEC));
  const picks = round.picks.slice().sort((a, b) => a.cardIndex - b.cardIndex);
  return (
    <View style={styles.root} accessibilityLabel={PRACTICE.watch.label}>
      <View style={styles.head}>
        <Text style={[TYPE.headline, styles.title, { color: color.ink }]}>{PRACTICE.watch.label}</Text>
        <Text style={[styles.clock, { color: color.accent }]} accessibilityRole="timer" accessibilityLiveRegion="polite">
          {PRACTICE.watch.left(leftSec)}
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: color.surface2 }]}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: color.accent }]} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{PRACTICE.watch.body}</Text>
      {picks.map((pick) => {
        const card = round.cards.find((c) => c.index === pick.cardIndex);
        if (!card) return null;
        return <PracticeRow key={pick.cardIndex} card={card} side={pick.side} entryRaw={pick.entryRaw} closeRaw={priceOf(card.asset)?.priceRaw ?? null} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  title: { flex: 1 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 34, lineHeight: 38, fontVariant: ["tabular-nums"] },
  bar: { height: 6, borderRadius: RADIUS.full, overflow: "hidden" },
  fill: { height: "100%" },
});
