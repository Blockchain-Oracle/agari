import type { PracticeRound, PracticeScore } from "@agari/core/games";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { Button } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { PracticeRow } from "./PracticeRow";

/**
 * web's `PracticeResult`: a count of cards and nothing else — no money, no rating, no streak, because practice
 * writes none. A card the feed could not price at the close is counted in one sentence rather than scored flat.
 * The result's own cue plays once on arrival (web: duel-win, duel-lose, or the neutral modal-open for a tie).
 */
export function PracticeResult({ round, score, onAgain }: { round: PracticeRound; score: PracticeScore; onAgain: () => void }) {
  const { color } = useTheme();
  const { feedback } = useGames();
  const unscored = round.picks.length - score.cards.length;

  useEffect(() => {
    feedback(score.winner === "you" ? "duel-win" : score.winner === "bot" ? "duel-lose" : "modal-open");
    // The cue belongs to arriving here, not to the score object's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdict = score.winner === "you" ? PRACTICE.result.won : score.winner === "bot" ? PRACTICE.result.lost : PRACTICE.result.tied;

  return (
    <View style={styles.root} accessibilityLabel={PRACTICE.result.title}>
      <View style={[styles.score, { backgroundColor: color.cream, borderColor: color.creamHairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{PRACTICE.result.title}</Text>
        <View style={styles.tally} accessible accessibilityLabel={`${PRACTICE.result.you} ${score.youWon}, ${PRACTICE.result.bot} ${score.botWon}`}>
          <Tally label={PRACTICE.result.you} value={score.youWon} />
          <Text style={[styles.dash, { color: color.creamInk }]}>–</Text>
          <Tally label={PRACTICE.result.bot} value={score.botWon} />
        </View>
        <Text style={[TYPE.stamp, styles.verdict, { color: color.creamInk }]}>{verdict}</Text>
      </View>

      {score.cards.map((c) => (
        <PracticeRow key={c.card.index} card={c.card} side={c.side} botSide={c.botSide} entryRaw={c.entryRaw} closeRaw={c.closeRaw} you={c.you} bot={c.bot} />
      ))}

      {score.cards.some((c) => c.move === "flat") ? <Foot>{PRACTICE.result.flatNote}</Foot> : null}
      {unscored > 0 ? <Foot>{PRACTICE.result.unscored(unscored)}</Foot> : null}
      <Foot>{PRACTICE.result.botNote}</Foot>

      <Button label={PRACTICE.result.again} icon={{ ios: "arrow.clockwise", android: "refresh" }} onPress={onAgain} />
      <Button label={PRACTICE.result.toDuel} variant="outline" onPress={() => router.push("/games/duel" as Href)} />
    </View>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  const { color } = useTheme();
  return (
    <View style={styles.side}>
      <Text style={[TYPE.labelMicro, { color: color.creamInk }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TYPE.dataHero, { color: color.creamInk }]}>{value}</Text>
    </View>
  );
}

function Foot({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  score: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 12, alignItems: "center" },
  tally: { flexDirection: "row", alignItems: "flex-end", gap: 18 },
  side: { alignItems: "center", gap: 4, minWidth: 96 },
  dash: { fontFamily: FONT.dataStrong, fontSize: 28, lineHeight: 42 },
  verdict: { textAlign: "center" },
});
