import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { Article } from "@/features/news/protocol";
import { FONT, useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { newsTokens } from "~/theme/web/explore/news";
import { articleSymbols, Cashtags, MarkCluster, Meta, openArticle, Tone, toneInk } from "./parts";

/** The 2 px edge in the tone's ink; neutral keeps the hairline (D-082). */
function useEdge(article: Article) {
  const { name, color } = useTheme();
  return article.sentiment === "neutral" ? newsTokens(name).hairline : toneInk(article.sentiment, color);
}

/** web NewsFeed.tsx lead: 01 · tone · meta, the display-size headline with its arrow, the stocks it names. */
export function LeadStory({ article }: { article: Article }) {
  const { color } = useTheme();
  const symbols = articleSymbols(article.symbols);
  return (
    <View style={[styles.lead, { borderLeftColor: useEdge(article) }]}>
      <View style={styles.leadMeta}>
        <Text style={[styles.index, { color: color.accent }]}>01</Text>
        <Tone tone={article.sentiment} />
        <Meta article={article} />
      </View>
      <Pressable onPress={() => openArticle(article.url)} accessibilityRole="link">
        <Text style={[styles.leadTitle, { color: color.ink }]}>
          {article.title}
          <Text style={[styles.leadArrow, { color: color.inkDisabled }]}>{"  ↗"}</Text>
        </Text>
      </Pressable>
      {symbols.length > 0 ? (
        <View style={styles.leadFoot}>
          <MarkCluster symbols={symbols} size={20} />
          <Cashtags symbols={symbols} />
        </View>
      ) : null}
    </View>
  );
}

/** news.css `.news-rule`: a vermilion square end, then the hairline. */
export function Rule() {
  const { name, color } = useTheme();
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleEnd, { backgroundColor: color.accent }]} />
      <View style={[styles.ruleLine, { backgroundColor: newsTokens(name).hairline }]} />
    </View>
  );
}

/**
 * web NewsRow.tsx under 640 px (news-wire.css): index and mark columns, the title across the row, then meta, tone and
 * arrow on the second line.
 */
export function WireRow({ article, index }: { article: Article; index: number }) {
  const { name, color } = useTheme();
  const t = newsTokens(name);
  const symbols = articleSymbols(article.symbols);
  return (
    <View style={[styles.row, { borderLeftColor: useEdge(article), borderBottomColor: t.rule }]}>
      <Text style={[styles.index, styles.rowIndex, { color: color.inkDisabled }]}>{String(index).padStart(2, "0")}</Text>
      <View style={styles.rowMark}>
        <MarkCluster symbols={symbols} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: exploreTokens(name).gray200 }]} onPress={() => openArticle(article.url)} accessibilityRole="link">
          {article.title}
        </Text>
        <View style={styles.rowFoot}>
          <View style={styles.rowMeta}>
            <Meta article={article} />
            <Cashtags symbols={symbols} />
          </View>
          <View style={styles.rowEnd}>
            <Tone tone={article.sentiment} />
          </View>
          <Text style={[styles.arrow, { color: t.arrow }]}>↗</Text>
        </View>
      </View>
    </View>
  );
}

function Bone({ width, height }: { width: `${number}%` | number; height: number }) {
  const { name } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
  }, [reduce, pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: 4, backgroundColor: newsTokens(name).bone }, fade]} />;
}

/** web NewsFeed.tsx `NewsSkeleton`: a display-size lead and five wire lines, pulsing. */
export function NewsSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      <View style={styles.skeletonLead}>
        <Bone width={112} height={12} />
        <Bone width="80%" height={48} />
        <Bone width="60%" height={48} />
      </View>
      <View style={styles.skeletonWire}>
        {(["85%", "76%", "67%", "58%", "49%"] as const).map((width) => (
          <Bone key={width} width={width} height={20} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { paddingLeft: 16, borderLeftWidth: 2 },
  leadMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  index: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  leadTitle: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 32.4, letterSpacing: -0.6 },
  leadArrow: { fontFamily: FONT.body, fontSize: 24, lineHeight: 25.92, letterSpacing: 0 },
  leadFoot: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  rule: { flexDirection: "row", alignItems: "center", marginTop: 56, marginBottom: 8 },
  ruleEnd: { width: 10, height: 10 },
  ruleLine: { flex: 1, height: 1 },
  row: { flexDirection: "row", gap: 12, paddingTop: 16, paddingBottom: 16, paddingLeft: 12, borderLeftWidth: 2, borderBottomWidth: 1 },
  rowIndex: { width: 24, paddingTop: 6 },
  rowMark: { width: 16, paddingTop: 3, flexDirection: "row", overflow: "visible", zIndex: 1 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 22 },
  rowFoot: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rowMeta: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, marginTop: 6 },
  rowEnd: { marginTop: 6, paddingTop: 5 },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, marginTop: 6 },
  skeleton: { gap: 48 },
  skeletonLead: { gap: 16 },
  skeletonWire: { gap: 28 },
});
