import { verdictStrings } from "@agari/core/copy";
import type { VerdictOutcome } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";

interface Props {
  outcome: VerdictOutcome;
  size?: "hero" | "compact";
}

/**
 * web's VerdictStamp: the kanji (Noto Serif JP, 64 hero / 28 compact) pressed at web's -4° `stamp-press`, with romaji
 * and translation always beneath, so the verdict never depends on reading Japanese or on colour. Colour law
 * (tokens.css --verdict-stamp-*): vermilion for the win alone, a loss in secondary ink, a void muted.
 */
export function VerdictStamp({ outcome, size = "hero" }: Props) {
  const { color } = useTheme();
  const strings = verdictStrings(outcome);
  const ink = outcome === "win" ? color.accent : outcome === "loss" ? color.inkSecondary : color.inkMuted;
  return (
    <View style={styles.press} accessibilityRole="text" accessibilityLabel={`${strings.romaji}, ${strings.translation}`}>
      <Text style={[size === "hero" ? styles.hero : styles.compact, { color: ink }]}>{strings.kanji}</Text>
      <Text style={[styles.sub, { color: color.inkSecondary }]}>
        {strings.romaji} · {strings.translation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  press: { alignItems: "flex-start", alignSelf: "flex-start", transform: [{ rotate: "-4deg" }] },
  hero: { fontFamily: FONT.stamp, fontSize: 64, lineHeight: 64 },
  compact: { fontFamily: FONT.stamp, fontSize: 28, lineHeight: 30.8 },
  sub: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76 },
});
