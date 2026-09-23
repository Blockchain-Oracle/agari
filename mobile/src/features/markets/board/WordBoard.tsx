import { diagnosisCopy, formatCadence, PLAIN_WORDS, wordQuestion } from "@agari/core/copy";
import { groupByHorizon, isTickerSymbol, LISTED_HORIZON, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Diagnosis, EventMarket, LaneSet, Side } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { ORACLE_PRICE_SCALE } from "@agari/markets/identity";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { MARKETS, PREOPEN, WORD_BOARD } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase, useWhen } from "@/lib/when";
import { Button, Card, EmptyState, haptic, LoadingState, Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Countdown } from "../parts/Countdown";

const PAGE = 6;
const ticket = (marketId: string, dir?: Side) => router.push({ pathname: "/ticket", params: dir ? { m: marketId, dir } : { m: marketId } });

/**
 * web's WordMarketBoard (§02 "Just ask"): the same live Windows as plain Yes/No questions, grouped by how soon they
 * close; while the stock market is shut, the closed strip leads and the listed stock Windows gather as one card per
 * company that schedules a call.
 */
export function WordBoard({ laneSet: allLanes, failure, ticker, nowMs }: { laneSet: LaneSet | null; failure: Diagnosis | null; ticker: TickerSymbol | null; nowMs: number }) {
  const { color } = useTheme();
  const when = useWhen();
  const phrase = useSessionPhrase();
  const session = useMarketSession();
  const laneSet = useMemo(() => (allLanes && ticker ? { ...allLanes, lanes: allLanes.lanes.map((lane) => ({ ...lane, markets: lane.markets.filter((m) => m.asset === ticker) })) } : allLanes), [allLanes, ticker]);
  const groups = groupByHorizon(laneSet, nowMs);
  const closed = session !== null && !session.open;

  if (laneSet === null && failure) return <EmptyState why={diagnosisCopy(failure.kind).body} />;
  if (laneSet === null || nowMs === 0) return <LoadingState shape="list" label={WORD_BOARD.reading} />;
  if (groups.length === 0 && session && !session.open) {
    return <EmptyState why={SESSION_COPY.board.closed(phrase(session.status, Math.floor(nowMs / 1000)))} action={{ label: SESSION_COPY.board.nextAction, onPress: () => router.push("/news") }} />;
  }
  if (groups.length === 0) return <EmptyState why={WORD_BOARD.between} />;

  return (
    <View style={styles.stack}>
      {closed && session ? <ClosedStrip line={CLOSED.strip(phrase(session.status, Math.floor(nowMs / 1000)))} /> : null}
      {groups.map((group) => {
        const listed = group.key === LISTED_HORIZON.key;
        const first = group.markets[0];
        const label = listed && first ? CLOSED.listed(when(first.tradingStartSec)) : group.label;
        const rows = listed ? byAsset(group.markets) : null;
        return (
          <View key={group.key} style={styles.stack} accessibilityLabel={label}>
            <View style={[styles.groupHead, { borderBottomColor: color.hairline }]}>
              <Text style={[TYPE.labelMicro, styles.grow, { color: listed ? color.accent : color.inkSecondary }]}>{label}</Text>
              <Text style={[TYPE.data, { color: color.inkMuted }]}>{rows ? rows.length : group.markets.length}</Text>
            </View>
            {rows ? rows.map((markets) => <WordListedCard key={markets[0]!.asset} markets={markets} />) : <Paged markets={group.markets} nowMs={nowMs} />}
          </View>
        );
      })}
    </View>
  );
}

/** web's `.words-closed`: "US stocks · After hours · reopens …", and that pre-IPO names and baskets keep trading. */
export function ClosedStrip({ line }: { line: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.closed, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: color.warning }]} />
      <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{line}</Text> {CLOSED.stripTail}
      </Text>
    </View>
  );
}

function Paged({ markets, nowMs }: { markets: readonly EventMarket[]; nowMs: number }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      {markets.slice(0, shown).map((market) => <WordCard key={market.marketId} market={market} nowMs={nowMs} />)}
      {markets.length > shown ? <Button label={`Show ${Math.min(PAGE, markets.length - shown)} more`} variant="secondary" size="sm" onPress={() => setShown((n) => n + PAGE)} /> : null}
    </>
  );
}

function byAsset(markets: readonly EventMarket[]): EventMarket[][] {
  const rows = new Map<string, EventMarket[]>();
  for (const m of markets) rows.set(m.asset, [...(rows.get(m.asset) ?? []), m]);
  return [...rows.values()];
}

/** web's WordCard: one Window as a plain question with the book's price on each answer; the bar is a stated derivation. */
function WordCard({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color } = useTheme();
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const closeClock = formatWallClock(market.expirySec * 1000);
  const question = wordQuestion({ ...market, marketId: String(market.marketId) }, ORACLE_PRICE_SCALE, closeClock);
  const share = upCents !== null && downCents !== null && upCents + downCents > 0 ? Math.round((upCents / (upCents + downCents)) * 100) : null;
  const kind = market.lane === "token" && isTickerSymbol(market.asset) ? CLOSED.kind[TICKERS[market.asset].kind] : null;
  const unquoted = !hydrating && upCents === null && downCents === null;
  const cents = (value: number | null) => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);
  return (
    <Card>
      <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } })} accessibilityRole="button" accessibilityLabel={question.text} style={styles.question}>
        <View style={styles.top}>
          <AssetDisc asset={market.asset} size={24} />
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{market.asset}</Text>
          {kind ? <Pill label={kind} tone="accent" /> : null}
          <View style={styles.grow} />
          <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
        </View>
        <Text style={[TYPE.title, { color: question.pending ? color.inkSecondary : color.ink }]}>{question.text}</Text>
      </Pressable>
      {unquoted ? (
        <View style={styles.top}>
          <View style={[styles.dot, { backgroundColor: color.inkMuted }]} />
          <Text style={[TYPE.caption, styles.grow, { color: color.inkMuted }]}>{CLOSED.noQuotes}</Text>
          <Button label={WORD_BOARD.open} size="sm" variant="ghost" block={false} onPress={() => ticket(market.marketId)} />
        </View>
      ) : (
        <>
          <View style={[styles.bar, { backgroundColor: color.surface2 }]}>{share !== null ? <View style={[styles.fill, { width: `${share}%`, backgroundColor: color.profit }]} /> : null}</View>
          <View style={styles.top}>
            <Text style={[TYPE.caption, styles.grow, { color: color.inkMuted }]}>{WORD_BOARD.closes(closeClock)}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</Text>
          </View>
          <View style={styles.answers}>
            <Answer word={PLAIN_WORDS.yes} price={cents(upCents)} up onPress={() => ticket(market.marketId, "up")} />
            <Answer word={PLAIN_WORDS.no} price={cents(downCents)} onPress={() => ticket(market.marketId, "down")} />
          </View>
        </>
      )}
    </Card>
  );
}

/** web's WordListedCard: one company's listed Windows as one card — pick the length, then call Up or Down before the bell. */
function WordListedCard({ markets }: { markets: readonly EventMarket[] }) {
  const { color } = useTheme();
  const [picked, setPicked] = useState(0);
  const market = markets[Math.min(picked, markets.length - 1)];
  if (!market) return null;
  const name = isTickerSymbol(market.asset) ? TICKERS[market.asset].name : market.asset;
  return (
    <Card>
      <View style={styles.top}>
        <AssetDisc asset={market.asset} size={24} />
        <Text style={[TYPE.bodyStrong, styles.grow, { color: color.ink }]}>{market.asset}</Text>
        <Pill label={PREOPEN.card.clock} dot />
      </View>
      <Text style={[TYPE.title, { color: color.ink }]}>{name}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{PREOPEN.card.why}</Text>
      {markets.length > 1 ? (
        <View style={styles.cadences} accessibilityLabel={CLOSED.cadencesAria}>
          {markets.map((m, i) => (
            <Pressable
              key={String(m.marketId)}
              onPress={() => {
                haptic.select();
                setPicked(i);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: i === picked }}
              style={[styles.cadence, { borderColor: i === picked ? color.accent : color.hairline, backgroundColor: i === picked ? color.accentWash : "transparent" }]}
            >
              <Text style={[TYPE.data, { color: i === picked ? color.accent : color.ink }]}>{formatCadence(m.intervalSec)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.answers}>
        <Answer word={CLOSED.callUp} up onPress={() => ticket(market.marketId, "up")} />
        <Answer word={CLOSED.callDown} onPress={() => ticket(market.marketId, "down")} />
      </View>
    </Card>
  );
}

function Answer({ word, price, up = false, onPress }: { word: string; price?: string; up?: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const ink = up ? color.profit : color.loss;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={price ? `${word}, ${price}` : word}
      style={({ pressed }) => [styles.answer, { borderColor: ink, backgroundColor: up ? color.profitWash : color.lossWash, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.answerWord, { color: ink }]}>{word}</Text>
      {price ? <Text style={[TYPE.data, { color: ink }]}>{price}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  question: { gap: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 6 },
  grow: { flex: 1 },
  closed: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4 },
  answers: { flexDirection: "row", gap: 10 },
  answer: { flex: 1, height: 48, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  answerWord: { fontFamily: FONT.headingHeavy, fontSize: 16 },
  cadences: { flexDirection: "row", gap: 8 },
  cadence: { minWidth: 56, height: 44, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
});
