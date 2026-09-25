import { computeTraderEdge } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { router } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, RadialGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { EDGE } from "@/features/edge/copy";
import { useHistoryReading } from "@/features/markets/history/useHistoryReading";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy } from "@/lib/copy";
import { WebButton } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { EdgeReport } from "./EdgeReport";
import { EdgeEnter, EdgeSkeleton, EdgeState, EdgeStateAction } from "./EdgeState";
import { useEdgeInk } from "./useEdgeInk";
import { usePullRefresh } from "~/components/kit/PullRefresh";

/** `.edge-page`'s backdrop: #090909 under a vermilion glow at 82% / 8%, fading out over 27rem (405 px). */
function Backdrop({ width, height }: { width: number; height: number }) {
  const { edge } = useEdgeInk();
  if (width === 0 || height === 0) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="edge-glow" cx={width * 0.82} cy={height * 0.08} r={405} gradientUnits="userSpaceOnUse">
          <Stop offset="0" {...stopPaint(edge.glow)} />
          <Stop offset="1" {...stopPaint(edge.glowClear)} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={edge.bg} />
      <Rect width={width} height={height} fill="url(#edge-glow)" />
    </Svg>
  );
}

/** web `Intro` at 402 px: the title and lede, then the two meta items under a rule (the outlined folio is hidden there). */
function Intro() {
  const { edge } = useEdgeInk();
  const words = EDGE.intro;
  return (
    <EdgeEnter>
      <View style={[styles.intro, { borderColor: edge.rule }]}>
        <View>
          <Text style={[styles.title, { color: edge.text }]} accessibilityRole="header">
            {words.title}
          </Text>
          <Text style={[styles.lede, { color: edge.muted }]}>{words.lede}</Text>
        </View>
        <View style={[styles.meta, { borderTopColor: edge.rule }]} accessibilityLabel={words.detailsLabel}>
          {[words.source, words.method].map((item) => (
            <View key={item.label} style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: edge.faint }]}>{item.label}</Text>
              <Text style={[styles.metaValue, { color: edge.muted }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </EdgeEnter>
  );
}

/**
 * `/portfolio/edge` — web `TraderEdgeScreen` (features/edge, styles/edge.css + edge-report.css) as it draws at 402 px:
 * the back link, the intro, then one of connect, reading, failed with a retry, nothing settled, or the report.
 * The page keeps its own palette in both themes (`.edge-page` --edge-*); pull to refresh reruns the history scan.
 */
export function EdgeScreen() {
  const { color } = useTheme();
  const { edge } = useEdgeInk();
  const history = useHistoryReading();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const value = history.reading?.ok ? history.reading.value : null;
  const report = useMemo(() => (value ? computeTraderEdge(value.rounds, value.openCount) : null), [value]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const refreshControl = usePullRefresh(history.retry, Boolean(history.address));

  let body: ReactNode;
  if (!history.address) {
    body = <EdgeState {...EDGE.states.connect} action={<WebButton label="Connect" onPress={() => router.push("/connect")} />} />;
  } else if (history.reading === null) {
    body = <EdgeSkeleton />;
  } else if (!history.reading.ok) {
    body = (
      <EdgeState
        eyebrow={EDGE.states.failed.eyebrow}
        title={EDGE.states.failed.title}
        copy={diagnosisCopy(history.reading.error.kind).headline}
        action={<EdgeStateAction label={EDGE.states.failed.retry} onPress={history.retry} />}
      />
    );
  } else if (!value || !report || report.settledRounds === 0) {
    const open = value?.openCount ?? 0;
    body = (
      <EdgeState
        eyebrow={EDGE.states.none.eyebrow}
        title={EDGE.states.none.title}
        copy={open > 0 ? EDGE.states.none.open(open) : EDGE.states.none.first}
        action={<EdgeStateAction label={EDGE.states.none.action} onPress={() => router.navigate("/markets")} />}
      />
    );
  } else {
    body = <EdgeReport history={value} report={report} symbol={symbol} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: edge.bg }}
      contentContainerStyle={styles.scroll}
      refreshControl={refreshControl}
    >
      <View style={styles.page} onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <Backdrop width={size.width} height={size.height} />
        <View style={styles.main}>
          <Pressable
            onPress={() => router.navigate("/portfolio")}
            accessibilityRole="link"
            accessibilityLabel={EDGE.back}
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
          >
            <Text style={[styles.backText, { color: edge.muted }]}>←</Text>
            <Text style={[styles.backText, { color: edge.muted }]}>{EDGE.back}</Text>
          </Pressable>
          <Intro />
          {body}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1 },
  main: { marginHorizontal: 14, paddingBottom: 112 },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 9, height: 24, paddingTop: 2 },
  backPressed: { transform: [{ translateX: -2 }, { translateY: 1 }] },
  backText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8 },
  intro: { marginTop: 28, paddingTop: 30, paddingBottom: 26, gap: 30, borderTopWidth: 1, borderBottomWidth: 1 },
  title: { marginTop: 17, fontFamily: FONT.headingHeavy, fontSize: 42, lineHeight: 41.16, letterSpacing: -2.52 },
  lede: { marginTop: 18, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.8 },
  meta: { flexDirection: "row", borderTopWidth: 1, paddingTop: 24 },
  metaItem: { flex: 1, gap: 7 },
  metaLabel: { fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2, letterSpacing: 1.12, textTransform: "uppercase" },
  metaValue: { fontFamily: FONT.data, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.18 },
});
