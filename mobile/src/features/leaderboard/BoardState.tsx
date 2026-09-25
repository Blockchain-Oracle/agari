import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { BOARD_PHONE } from "./words";

/** The board while its first read is in flight: a podium's worth of space and five skeleton rows, under web's line. */
export function BoardSkeleton({ label }: { label: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}>
      <Text style={[styles.reading, { color: color.inkMuted }]}>{label}</Text>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.skRow, { borderBottomColor: t.rowBorder }]}>
          <Skeleton width={18} height={12} />
          <Skeleton width={34} height={34} radius={17} />
          <View style={styles.skText}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="35%" height={10} />
          </View>
          <Skeleton width={56} height={14} />
        </View>
      ))}
    </View>
  );
}

/** web's vermilion `.btn-primary` pill. */
function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
      <Text style={[styles.btnText, { color: color.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

/** `.lb-state-empty`: the ◷ glyph, the headline, the dimmer line and a CTA (retry, or a call). */
export function BoardEmpty({ headline, sub, action }: { headline: string; sub: string; action?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.glyph, { color: color.inkMuted }]}>◷</Text>
      <Text style={[styles.head, { color: color.ink }]}>{headline}</Text>
      <Text style={[styles.sub, { color: color.inkMuted }]}>{sub}</Text>
      {action ? <Cta label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** A board of one to three: the podium says who; this says the field is open and how to join it. */
export function BoardSparse({ headline }: { headline: string }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  return (
    <View style={[styles.sparse, { borderColor: t.spotBorder, backgroundColor: t.spotFill }]}>
      <Text style={[styles.sparseHead, { color: color.ink }]}>{headline}</Text>
      <Text style={[styles.sub, styles.left, { color: color.inkMuted }]}>{BOARD_PHONE.sparseBody}</Text>
      <View style={styles.leftCta}>
        <Cta label={BOARD_PHONE.placeCall} onPress={() => router.navigate("/markets")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, paddingVertical: 12 },
  skRow: { flexDirection: "row", alignItems: "center", gap: 12, height: 62, paddingHorizontal: 4, borderBottomWidth: 1 },
  skText: { flex: 1, gap: 6 },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 6 },
  glyph: { fontFamily: FONT.dataRegular, fontSize: 30, lineHeight: 40, opacity: 0.5, marginBottom: 6 },
  head: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 22, textAlign: "center" },
  sub: { fontFamily: FONT.dataRegular, fontSize: 11.5, lineHeight: 18, textAlign: "center" },
  left: { textAlign: "left" },
  btn: { marginTop: 12, alignSelf: "center", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  btnText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 15, letterSpacing: 0.26 },
  sparse: { marginTop: 16, borderWidth: 1, borderRadius: 4, padding: 16, gap: 6, alignItems: "flex-start" },
  leftCta: { alignSelf: "flex-start" },
  sparseHead: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 20 },
});
