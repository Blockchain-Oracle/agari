import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";

/** `.lb-state` — the reading line, mono 11, 64 above and below. */
export function BoardReading({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.reading, { color: color.inkMuted }]} accessibilityRole="progressbar" accessibilityLabel={text}>
      {text}
    </Text>
  );
}

/**
 * `.lb-state.lb-state-empty` (leaderboard-theme.css): the ◷ glyph, the headline, the dimmer sub line and, on a failed
 * read, part-03's `.btn.btn-primary` retry pill.
 */
export function BoardEmpty({ headline, sub, retry }: { headline: string; sub: string; retry?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  return (
    <View style={styles.empty} accessibilityRole={retry ? "alert" : undefined}>
      <Text style={[styles.glyph, { color: color.inkMuted }]}>◷</Text>
      <Text style={[styles.line, { color: color.inkMuted }]}>
        {headline}
        {"\n"}
        <Text style={{ color: color.inkDisabled }}>{sub}</Text>
      </Text>
      {retry ? (
        <Pressable onPress={retry.onPress} accessibilityRole="button" style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
          <Text style={[styles.btnText, { color: color.onAccent }]}>{retry.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, paddingVertical: 64, textAlign: "center" },
  empty: { paddingVertical: 96, paddingHorizontal: 24, alignItems: "center" },
  glyph: { fontFamily: FONT.dataRegular, fontSize: 30, lineHeight: 48, marginBottom: 14, opacity: 0.5 },
  line: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 24, textAlign: "center" },
  btn: { marginTop: 16, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  btnText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 13, letterSpacing: 0.26 },
});
