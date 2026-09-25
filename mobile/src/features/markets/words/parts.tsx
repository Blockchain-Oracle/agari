import type { Side } from "@agari/core/types";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { wordsTokens } from "~/theme/web/markets-words";

/** web's word-board links, as the app routes them: a side opens the ticket on that Window, "Open" opens the Window. */
export const openTicket = (marketId: string, dir: Side) => router.push({ pathname: "/ticket", params: { m: marketId, dir } });
export const openWindow = (marketId: string) => router.push({ pathname: "/markets/[id]", params: { id: marketId } });

export function useWords() {
  const { name, color } = useTheme();
  return { color, t: wordsTokens(name) };
}

/** yosuku part-16 `.wq-card`: 20 px radius, black ground (white with a 1 px shadow in light), 22/22/18 padding. */
export function WqCard({ children }: { children: ReactNode }) {
  const { t } = useWords();
  return <View style={[styles.card, { backgroundColor: t.wqCard, borderColor: t.wqCardBorder, shadowColor: t.wqCardShadow }]}>{children}</View>;
}

/** `.wq-btn.yes` / `.wq-btn.no`: the minute card's UP/DOWN language — mono caps, a tinted fill and a 32 % rim. */
export function WqButton({ side, word, cents, label, onPress }: { side: Side; word: string; cents?: string; label: string; onPress: () => void }) {
  const { color, t } = useWords();
  const up = side === "up";
  const ink = up ? color.profit : color.loss;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: up ? t.wqYesFill : t.wqNoFill, borderColor: up ? t.wqYesBorder : t.wqNoBorder, transform: [{ scale: pressed ? 0.972 : 1 }] },
      ]}
    >
      <Text style={[styles.side, { color: ink }]}>{word}</Text>
      {cents === undefined ? null : <Text style={[styles.cents, { color: ink }]}>{cents}</Text>}
    </Pressable>
  );
}

/** web's `EmptyState`: why it is empty, and the next action — never a blank panel. */
export function WordsEmptyState({ why, action }: { why: string; action?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <Text style={[styles.emptyWhy, { color: color.ink }]}>{why}</Text>
      {action ? <Button label={action.label} variant="secondary" size="sm" block={false} onPress={action.onPress} /> : null}
    </View>
  );
}

/** `.words-empty`: the board's own quiet line while it reads, or between rounds. */
export function WordsQuiet({ text }: { text: string }) {
  const { color } = useTheme();
  return <Text style={[styles.quiet, { color: color.inkMuted }]}>{text}</Text>;
}

export const wq = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  q: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 20.8, letterSpacing: -0.4, marginTop: 14, marginBottom: 12, minHeight: 36.8 },
  actions: { flexDirection: "row", gap: 8 },
});

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18, overflow: "hidden", shadowOpacity: 1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  side: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.96, textTransform: "uppercase" },
  cents: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: -0.24, opacity: 0.82 },
  empty: { alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: 12, padding: 16 },
  emptyWhy: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  quiet: { paddingVertical: 80, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
});
