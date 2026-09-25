import { ADVICE_COPY } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SENSEI_UI } from "@/features/sensei/copy";
import { useSenseiChat } from "@/features/sensei/useSenseiChat";
import { useSenseiSnapshot } from "@/features/sensei/useSenseiSnapshot";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";
import { SenseiChips, SenseiStarters } from "./SenseiChips";
import { SenseiComposer } from "./SenseiComposer";
import { SenseiMeter } from "./SenseiMeter";
import { SenseiThread } from "./SenseiThread";
import { SenseiTradeCards } from "./SenseiTradeCards";
import { useSenseiContext } from "./useSenseiContext";

/** With a focus (a ticker or a Window's ticker), Sensei reads that stock's Windows: the meter, the tape and the snapshot. */
function focusLanes(laneSet: LaneSet | null, asset: TickerSymbol | null): LaneSet | null {
  if (!laneSet || !asset) return laneSet;
  const lanes = laneSet.lanes
    .map((lane) => ({ ...lane, markets: lane.markets.filter((market) => market.asset === asset) }))
    .filter((lane) => lane.markets.length > 0);
  return lanes.length > 0 ? { ...laneSet, lanes } : laneSet;
}

/**
 * web's `SenseiDrawer` panel content, top to bottom as web stacks it: the head (eyebrow, title, beta, ✕),
 * the meter over the nearest Window, the thread with its typewriter reveal and follow-up chips, the trade cards once a
 * read exists, the starters on the first turn, the pill composer and the advice line. Chat is web's own
 * `useSenseiChat` posting to `/api/sensei`.
 */
export function SenseiScreen({ focus, onClose }: { focus: TickerSymbol | null; onClose: () => void }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const insets = useSafeAreaInsets();
  const venue = useVenue();
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();
  const laneSet = useMemo(() => focusLanes(lanes?.ok ? lanes.value : null, focus), [lanes, focus]);
  const reading = useSenseiSnapshot(laneSet, nowMs);
  const context = useSenseiContext(true, nowMs);
  const chat = useSenseiChat(reading.snapshot, context);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const toBottom = () => scrollRef.current?.scrollToEnd({ animated: false });

  const nearest = reading.nearest;
  const clock = nearest && nowMs > 0 ? countdown(nowMs, nearest.expirySec, nearest.intervalSec) : null;
  const markets = reading.snapshot === null ? [] : (laneSet?.lanes.flatMap((lane) => lane.markets) ?? []);
  const nearestMarkets = markets
    .filter((market) => market.expirySec * 1000 > nowMs)
    .sort((a, b) => a.expirySec - b.expirySec)
    .slice(0, reading.snapshot?.markets.length ?? 0);

  const last = chat.messages[chat.messages.length - 1];
  const showChips = !chat.loading && chat.messages.length > 1 && last?.role === "assistant" && !last.failed && chat.typingIndex === -1;
  const hasRead = chat.messages.some((message, index) => index > 0 && message.role === "assistant" && !message.failed);
  const ask = (text: string) => {
    haptic.tap();
    void chat.send(text);
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.head, { borderBottomColor: t.rule }]}>
        <View>
          <Text style={[styles.eyebrow, { color: color.accent }]}>{SENSEI_UI.eyebrow}</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.title }]} accessibilityRole="header">
              {SENSEI_UI.title}
            </Text>
            <Text style={[styles.beta, { color: color.accent, borderColor: t.betaBorder }]}>{SENSEI_UI.beta}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={SENSEI_UI.close} style={styles.close}>
          <Text style={[styles.closeText, { color: color.inkMuted }]}>✕</Text>
        </Pressable>
      </View>

      <SenseiMeter reading={reading} secsLeft={clock?.remainingSec ?? 0} urgent={clock?.urgent ?? false} />

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.msgs}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <SenseiThread messages={chat.messages} loading={chat.loading} typingIndex={chat.typingIndex} doneTyping={chat.doneTyping} onType={toBottom} />
        {showChips && last ? <SenseiChips reply={last.content} onPick={ask} /> : null}
      </ScrollView>

      {hasRead ? <SenseiTradeCards markets={nearestMarkets} snapshotMarkets={reading.snapshot?.markets ?? []} nowMs={nowMs} /> : null}
      {chat.messages.length === 1 ? <SenseiStarters onPick={ask} /> : null}

      <SenseiComposer
        value={input}
        onChange={setInput}
        busy={chat.loading}
        onSend={() => {
          ask(input);
          setInput("");
        }}
      />
      <Text style={[styles.advice, { color: color.inkMuted, paddingBottom: 12 + insets.bottom }]}>{ADVICE_COPY.notAdvice}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 22, lineHeight: 35.2 },
  beta: { fontFamily: FONT.dataStrong, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.12, textTransform: "uppercase", borderWidth: 1, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 6, overflow: "hidden" },
  close: { padding: 4 },
  closeText: { fontSize: 15, lineHeight: 15 },
  msgs: { padding: 18, gap: 14 },
  advice: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85, paddingHorizontal: 16 },
});
