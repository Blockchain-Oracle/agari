import { diagnosisCopy } from "@agari/core/copy";
import { groupByHorizon, LISTED_HORIZON, type TickerSymbol } from "@agari/core/market";
import type { Diagnosis, EventMarket, LaneSet } from "@agari/core/types";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { WORD_BOARD } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase, useWhen } from "@/lib/when";
import { FONT, useTheme } from "~/theme";
import { useWords, WordsEmptyState, WordsQuiet } from "../words/parts";
import { WordCard } from "../words/WordCard";
import { WordListedCard } from "../words/WordListedCard";

interface WordBoardProps {
  /** The lane set the rail already holds — the board never opens a second market stream. */
  laneSet: LaneSet | null;
  /** Why there is no lane set, when the read failed rather than is still in flight. */
  failure: Diagnosis | null;
  /** The rail's pinned ticker: the board narrows with the rail. */
  ticker: TickerSymbol | null;
  nowMs: number;
}

/** Listed Windows as one card per company, in the group's order (earliest open, shortest cadence first). */
function byAsset(markets: readonly EventMarket[]): EventMarket[][] {
  const rows = new Map<string, EventMarket[]>();
  for (const m of markets) rows.set(m.asset, [...(rows.get(m.asset) ?? []), m]);
  return [...rows.values()];
}

function forTicker(laneSet: LaneSet | null, ticker: TickerSymbol | null): LaneSet | null {
  if (laneSet === null || ticker === null) return laneSet;
  return { ...laneSet, lanes: laneSet.lanes.map((lane) => ({ ...lane, markets: lane.markets.filter((market) => market.asset === ticker) })) };
}

/**
 * web's word-board/WordMarketBoard (§02 "Just ask"): the same live Windows as time-scheduled Yes/No questions, grouped
 * by how soon they close. While the stock market is shut the closed strip leads and the listed stock Windows gather
 * as one card per company. Its children sit in the section's 16 pt column, each with web's own margins.
 */
export function WordBoard({ laneSet: allLanes, failure, ticker, nowMs }: WordBoardProps) {
  const laneSet = useMemo(() => forTicker(allLanes, ticker), [allLanes, ticker]);
  const session = useMarketSession();
  const when = useWhen();
  const phrase = useSessionPhrase();
  const groups = groupByHorizon(laneSet, nowMs);

  if (laneSet === null && failure) return <WordsQuiet text={diagnosisCopy(failure.kind).body} />;
  if (laneSet === null || nowMs === 0) return <WordsQuiet text={WORD_BOARD.reading} />;
  if (groups.length === 0 && session && !session.open) {
    return <WordsEmptyState why={SESSION_COPY.board.closed(phrase(session.status, Math.floor(nowMs / 1000)))} action={{ label: SESSION_COPY.board.nextAction, onPress: () => router.push("/news") }} />;
  }
  if (groups.length === 0) return <WordsQuiet text={WORD_BOARD.between} />;

  return (
    <View style={styles.column}>
      {session !== null && !session.open ? <ClosedStrip line={CLOSED.strip(phrase(session.status, Math.floor(nowMs / 1000)))} /> : null}
      {groups.map((group) => {
        const listed = group.key === LISTED_HORIZON.key;
        const first = group.markets[0];
        const label = listed && first ? CLOSED.listed(when(first.tradingStartSec)) : group.label;
        const rows = listed ? byAsset(group.markets) : null;
        return (
          <View key={group.key} style={styles.section} accessibilityLabel={label}>
            <SectionHead label={label} count={rows ? rows.length : group.markets.length} />
            <View style={styles.grid}>
              {rows
                ? rows.map((markets) => <WordListedCard key={markets[0]!.asset} markets={markets} />)
                : group.markets.map((market) => <WordCard key={market.marketId} market={market} nowMs={nowMs} />)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** `.words-sechead`: the Sora 22 label and its count over a hairline, with the 40 × 2 vermilion tick under the label. */
function SectionHead({ label, count }: { label: string; count: number }) {
  const { color, t } = useWords();
  return (
    <View style={[styles.head, { borderBottomColor: t.secheadRule }]}>
      <Text style={[styles.label, { color: color.ink }]} accessibilityRole="header">
        {label}
      </Text>
      <Text style={[styles.count, { color: color.inkMuted }]}>{count}</Text>
      <View style={[styles.tick, { backgroundColor: color.accent }]} />
    </View>
  );
}

/** web's `.words-closed`: "US stocks · Closed · opens …", then that pre-IPO names and baskets trade around the clock. */
export function ClosedStrip({ line }: { line: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.closed, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityRole="summary">
      <View style={[styles.closedDot, { backgroundColor: color.warning }]} />
      <Text style={[styles.closedStrong, { color: color.ink }]}>{line}</Text>
      <Text style={[styles.closedText, { color: color.inkSecondary }]}>{CLOSED.stripTail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  section: { marginTop: 40 },
  head: { flexDirection: "row", alignItems: "baseline", gap: 14, paddingBottom: 14, marginBottom: 20, borderBottomWidth: 1 },
  label: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 35.2, letterSpacing: -0.44 },
  count: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  tick: { position: "absolute", left: 0, bottom: -1, width: 40, height: 2 },
  grid: { gap: 16 },
  closed: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18, borderWidth: 1, borderRadius: 12 },
  closedDot: { width: 8, height: 8, borderRadius: 9999 },
  closedStrong: { fontFamily: FONT.bodyBold, fontSize: 13, lineHeight: 20.8 },
  closedText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
});
