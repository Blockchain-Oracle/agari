import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Article } from "@/features/news/protocol";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { articleSymbols, Cashtags, MarkCluster, metaLine, Tone, toneInk } from "./parts";

const RISE_STEP_MS = 40;

// 21st: ssychui/news-card — the timestamp whisper over a bold ink headline with the source beneath, on one card.
/**
 * web NewsFeed.tsx's lead story: "01", the tone, time · source, the headline at display size with a 2-pt edge in the
 * tone's ink, and the stocks it names under it. The card opens the story's own screen.
 */
export function LeadStory({ article, onOpen }: { article: Article; onOpen: () => void }) {
  const { color } = useTheme();
  const symbols = articleSymbols(article.symbols);
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Lead story: ${article.title}. ${metaLine(article)}`}
        style={({ pressed }) => [
          styles.lead,
          {
            backgroundColor: color.surface1,
            borderColor: color.hairline,
            borderLeftColor: toneInk(article.sentiment, color),
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.leadMeta}>
          <Text style={[styles.index, { color: color.accent }]}>01</Text>
          <Tone tone={article.sentiment} />
          <Text style={[TYPE.data, styles.meta, { color: color.inkMuted }]} numberOfLines={1}>
            {metaLine(article)}
          </Text>
        </View>
        <Text style={[TYPE.headline, styles.leadTitle, { color: color.ink }]}>{article.title}</Text>
        {symbols.length > 0 ? (
          <View style={styles.leadFoot}>
            <MarkCluster symbols={symbols} size={26} />
            <Cashtags symbols={symbols} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** web NewsRow.tsx: `index · mark slot · body · tone · arrow`, a 2-pt edge in the tone's ink down the left. */
export function WireRow({ article, index, onOpen }: { article: Article; index: number; onOpen: () => void }) {
  const { color } = useTheme();
  const symbols = articleSymbols(article.symbols);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * RISE_STEP_MS).duration(280)}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${article.title}. ${metaLine(article)}`}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: color.hairline, borderLeftColor: toneInk(article.sentiment, color) },
          pressed && { backgroundColor: color.surface1 },
        ]}
      >
        <Text style={[styles.index, { color: color.inkMuted }]}>{String(index).padStart(2, "0")}</Text>
        <View style={styles.rowBody}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={3}>
            {article.title}
          </Text>
          <View style={styles.rowMeta}>
            <MarkCluster symbols={symbols} size={18} />
            <Text style={[TYPE.data, styles.meta, { color: color.inkMuted }]} numberOfLines={1}>
              {metaLine(article)}
            </Text>
          </View>
          <View style={styles.rowMeta}>
            <Tone tone={article.sentiment} />
            <Cashtags symbols={symbols} />
          </View>
        </View>
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right" }}
          size={14}
          tintColor={color.inkMuted}
          style={styles.chevron}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lead: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
    padding: 16,
    gap: 12,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  leadMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  leadTitle: { fontSize: 24, lineHeight: 29 },
  leadFoot: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 0.6, width: 22 },
  meta: { fontSize: 11.5, flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 64,
    paddingVertical: 14,
    paddingLeft: 10,
    paddingRight: 4,
    borderLeftWidth: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 6 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  chevron: { marginTop: 4, width: 14, height: 14 },
});
