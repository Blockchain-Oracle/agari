import { StyleSheet, Text, View } from "react-native";
import { Eyebrow, useGamesTokens } from "~/features/games/frame";
import { FONT } from "~/theme";

/**
 * A stage's head (practice.css `.pr-head`, duel.css `.du-head`): the eyebrow and the mode's name with its vermilion
 * stop at 30 / 0.96 — not the hub's page title, so the deck and both calls stay above the fold.
 */
export function StageHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { color } = useGamesTokens();
  return (
    <View style={styles.head}>
      <Eyebrow style={styles.eyebrow}>{eyebrow}</Eyebrow>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {title}
        <Text style={{ color: color.accent }}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 20 },
  eyebrow: { marginBottom: 12 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 32, letterSpacing: -1.2 },
});
