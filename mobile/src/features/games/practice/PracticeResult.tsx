import type { PracticeRound, PracticeScore } from "@agari/core/games";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { useGamesTokens } from "~/features/games/frame";
import { useGames } from "~/features/games/shell";
import { useStageTokens } from "~/features/games/stage";
import { FONT } from "~/theme";
import { practiceStyles, PrLink } from "./PracticePanels";
import { PracticeRow } from "./PracticeRow";

/**
 * web's `PracticeResult`: the scoreboard (`.pr-score` — you, the dash, the bot, the verdict), the scored rows, the
 * footnotes, and two `.pr-link`s: play again, or on to the duel. A count of cards and nothing else — practice
 * writes no money, rating or streak. The result's own cue plays once on arrival.
 */
export function PracticeResult({ round, score, onAgain }: { round: PracticeRound; score: PracticeScore; onAgain: () => void }) {
  const { s, color } = useStageTokens();
  const { t } = useGamesTokens();
  const { feedback } = useGames();
  const unscored = round.picks.length - score.cards.length;

  useEffect(() => {
    feedback(score.winner === "you" ? "duel-win" : score.winner === "bot" ? "duel-lose" : "modal-open");
    // The cue belongs to arriving here, not to the score object's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdict = score.winner === "you" ? PRACTICE.result.won : score.winner === "bot" ? PRACTICE.result.lost : PRACTICE.result.tied;
  const edge = score.winner === "you" ? s.scoreWon : score.winner === "bot" ? s.scoreLost : t.cardBorder;
  const foot = [practiceStyles.foot, { color: color.inkMuted }];

  return (
    <View style={styles.watch} accessibilityLabel={PRACTICE.result.title}>
      <View style={[styles.score, { backgroundColor: s.scoreBg, borderColor: edge }]}>
        <Tally label={PRACTICE.result.you} value={score.youWon} />
        <Text style={[styles.dash, { color: color.inkDisabled }]}>—</Text>
        <Tally label={PRACTICE.result.bot} value={score.botWon} />
        <Text style={[styles.verdict, { color: color.ink }]}>{verdict}</Text>
      </View>

      <View style={styles.rows}>
        {score.cards.map((c) => (
          <PracticeRow key={c.card.index} card={c.card} side={c.side} botSide={c.botSide} entryRaw={c.entryRaw} closeRaw={c.closeRaw} you={c.you} bot={c.bot} />
        ))}
      </View>

      {score.cards.some((c) => c.move === "flat") ? <Text style={foot}>{PRACTICE.result.flatNote}</Text> : null}
      {unscored > 0 ? <Text style={foot}>{PRACTICE.result.unscored(unscored)}</Text> : null}
      <Text style={foot}>{PRACTICE.result.botNote}</Text>

      <View style={practiceStyles.actions}>
        <PrLink label={PRACTICE.result.again} onPress={onAgain} />
        <PrLink label={PRACTICE.result.toDuel} quiet onPress={() => router.push("/games/duel" as Href)} />
      </View>
    </View>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  const { color } = useStageTokens();
  return (
    <View style={styles.side}>
      <Text style={[styles.k, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.v, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  watch: { gap: 12 },
  score: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 1 },
  side: { gap: 4 },
  k: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.9 },
  v: { fontFamily: FONT.dataRegular, fontSize: 30, lineHeight: 30, fontVariant: ["tabular-nums"] },
  dash: { fontFamily: FONT.dataRegular, fontSize: 20, lineHeight: 32 },
  verdict: { marginLeft: "auto", flexShrink: 1, textAlign: "right", fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6 },
  rows: { gap: 8 },
});
