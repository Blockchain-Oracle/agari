import { sessionStateWord } from "@agari/core/copy";
import { haltLabel } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useSessionPhrase } from "@/lib/when";
import { haptic } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const PHRASE_TICK_MS = 30_000;

/** web's `.prf-stat`: a micro label over a big figure; `mono` for numbers, `long` to take the whole row. */
export function Stat({ label, value, mono = true, long = false }: { label: string; value: string; mono?: boolean; long?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.stat, long && styles.statLong]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[mono ? styles.bigMono : styles.big, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

/** web's `.prf-bar`: the figures in a wrapping grid over a hairline plate, then the caption and actions. */
export function StatBar({ children, foot, actions }: { children: ReactNode; foot?: ReactNode; actions?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.stats}>{children}</View>
      {foot}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** web's `SourceLine`: the source as a quiet caption; where a public page is pinned it opens outside the app. */
export function SourceLine({ label, tail }: { label: SourceLabel | null; tail?: string }) {
  const { color } = useTheme();
  if (!label && !tail) return null;
  const text = (
    <Text style={[TYPE.caption, { color: color.inkMuted }]}>
      {label ? (
        <Text style={label.href ? { color: color.inkSecondary, textDecorationLine: "underline" } : undefined}>{label.text}</Text>
      ) : null}
      {label && tail ? " · " : ""}
      {tail}
    </Text>
  );
  if (!label?.href) return text;
  const href = label.href;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        void openExternal(href);
      }}
      accessibilityRole="link"
      accessibilityLabel={label.text}
      hitSlop={6}
      style={styles.sourceRow}
    >
      <View style={styles.sourceText}>{text}</View>
      <SymbolView name={{ ios: "arrow.up.right", android: "open_in_new" }} size={11} tintColor={color.inkSecondary} />
    </Pressable>
  );
}

/** web's `MarketSessionChip`: "● Open · closes in 2h 05m", a halt said once; nothing while the session is unknown. */
export function SessionChip() {
  const { color } = useTheme();
  useTick(PHRASE_TICK_MS);
  const session = useMarketSession();
  const phraseOf = useSessionPhrase();
  if (!session) return null;
  if (session.halt && session.status.state === "halted") {
    return <Chip dot={color.warning} word={haltLabel(session.halt.reason)} />;
  }
  const now = Math.floor(marketsProvider.nowMs() / 1000);
  const word = sessionStateWord(session.status);
  const phrase = phraseOf(session.status, now);
  const tail = phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  const open = session.status.state === "regular" || session.status.state === "early-close";
  return <Chip dot={open ? color.profit : color.inkMuted} word={word} tail={tail} />;
}

export function Chip({ dot, word, tail }: { dot: string; word: string; tail?: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: color.hairline }]} accessibilityRole="text" accessibilityLabel={tail ? `${word}, ${tail}` : word}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.chipWord, { color: color.ink }]}>{word}</Text>
      {tail ? <Text style={[styles.chipTail, { color: color.inkSecondary }]}>· {tail}</Text> : null}
    </View>
  );
}

/** A mono-caps link row ("Trade it →", "Open the leaderboard →"). */
export function LinkButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={label.replace(/\s*→$/, "")}
      style={({ pressed }) => [styles.link, { borderColor: color.hairline, backgroundColor: pressed ? color.surface2 : "transparent" }]}
    >
      {icon ? <SymbolView name={{ ios: "chart.line.uptrend.xyaxis", android: "show_chart" }} size={15} tintColor={color.accent} /> : null}
      <Text style={[styles.linkText, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  stats: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, columnGap: 16 },
  stat: { minWidth: "44%", flexGrow: 1, gap: 4 },
  statLong: { minWidth: "100%" },
  big: { fontFamily: FONT.bodyStrong, fontSize: 17, lineHeight: 22 },
  bigMono: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 23, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, height: 28 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipWord: { fontFamily: FONT.dataStrong, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  chipTail: { fontFamily: FONT.data, fontSize: 11 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sourceText: { flexShrink: 1 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1 },
  linkText: { fontFamily: FONT.dataStrong, fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
});
