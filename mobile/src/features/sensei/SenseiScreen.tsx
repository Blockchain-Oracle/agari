import { ADVICE_COPY } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { chipsFor, SENSEI_STARTERS, SENSEI_UI } from "@/features/sensei/copy";
import { useSenseiChat } from "@/features/sensei/useSenseiChat";
import { useSenseiSnapshot } from "@/features/sensei/useSenseiSnapshot";
import { Chips, haptic } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
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
 * Sensei as a native sheet — web's `SenseiDock` + `SenseiDrawer` (features/sensei): the meter over the nearest Window,
 * the thread with its typewriter reveal, the reference's follow-up chips, the starters on the first turn, the trade
 * cards once a read exists, and web's own `useSenseiChat` posting to `/api/sensei` (one JSON reply, revealed here).
 */
export function SenseiScreen({ focus }: { focus: TickerSymbol | null }) {
  const { color } = useTheme();
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
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: color.ground }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: color.accent }]}>{SENSEI_UI.eyebrow.toUpperCase()}</Text>
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
          {SENSEI_UI.title} <Text style={[styles.beta, { color: color.inkMuted }]}>{SENSEI_UI.beta}</Text>
        </Text>
      </View>
      <View style={styles.meter}>
        <SenseiMeter reading={reading} secsLeft={clock?.remainingSec ?? 0} urgent={clock?.urgent ?? false} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <SenseiThread messages={chat.messages} loading={chat.loading} typingIndex={chat.typingIndex} doneTyping={chat.doneTyping} onType={toBottom} />
        {showChips && last ? <Chips options={chipsFor(last.content).map((chip) => ({ value: chip, label: chip }))} onPick={ask} /> : null}
        {chat.messages.length === 1 ? <Chips options={SENSEI_STARTERS.map((s) => ({ value: s, label: s }))} onPick={ask} /> : null}
        {hasRead ? <SenseiTradeCards markets={nearestMarkets} nowMs={nowMs} /> : null}
      </ScrollView>

      <SenseiComposer
        value={input}
        onChange={setInput}
        busy={chat.loading}
        onSend={() => {
          ask(input);
          setInput("");
        }}
      />
      <Text style={[TYPE.caption, styles.advice, { color: color.inkMuted }]}>{ADVICE_COPY.notAdvice}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 22, gap: 2 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  beta: { fontFamily: FONT.data, fontSize: 12, letterSpacing: 1 },
  meter: { paddingHorizontal: 16, paddingTop: 12 },
  body: { padding: 16, gap: 14, paddingBottom: 24 },
  advice: { paddingHorizontal: 16, paddingBottom: 12 },
});
