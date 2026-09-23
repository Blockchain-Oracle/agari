import { sessionStateWord } from "@agari/core/copy";
import { haltLabel, isTickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { MARKETS } from "@/lib/copy";
import { useSessionPhrase } from "@/lib/when";
import { FONT, RADIUS, useTheme } from "~/theme";

const PHRASE_TICK_MS = 30_000;

/** A halt shows in regular hours on a stock lane, and at any hour on a token lane (web's `haltShown`). */
function haltShown(session: MarketSession, asset: string | undefined): boolean {
  if (!session.halt) return false;
  return session.status.state === "halted" || (asset !== undefined && !isTickerSymbol(asset));
}

/**
 * web's MarketSessionChip: the NYSE session as a word and a phrase ("● Open · closes in 2h 05m", "● After hours ·
 * reopens Thu 09:30 ET"), or the halt alone. Renders nothing while the session is unknown.
 */
export function SessionChip({ asset }: { asset?: string }) {
  const session = useMarketSession(asset);
  useTick(PHRASE_TICK_MS);
  const phraseOf = useSessionPhrase();
  const { color } = useTheme();
  if (!session) return null;

  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const halted = session.halt !== null && haltShown(session, asset);
  const open = session.open && !halted;
  const dot = halted ? color.loss : open ? color.profit : color.inkMuted;
  let word: string;
  let tail: string;
  if (halted && session.halt) {
    word = haltLabel(session.halt.reason);
    tail = "";
  } else {
    word = sessionStateWord(session.status);
    const phrase = phraseOf(session.status, nowSec);
    tail = phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  }
  return (
    <View
      style={[styles.chip, { borderColor: color.hairline, backgroundColor: color.surface1 }]}
      accessibilityRole="text"
      accessibilityLabel={MARKETS.session.aria(halted ? MARKETS.session.halted : word, halted ? word : tail)}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.word, { color: color.ink }]} numberOfLines={1}>
        {word}
        {tail ? <Text style={{ color: color.inkSecondary }}> · {tail}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, height: 26, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, maxWidth: "100%" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  word: { fontFamily: FONT.data, fontSize: 11, flexShrink: 1 },
});
