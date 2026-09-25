import { isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { ORACLE_PRICE_SCALE } from "@agari/markets/identity";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { MARKETS, PLAIN_WORDS, WORD_BOARD, wordQuestion } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { Countdown } from "../parts/Countdown";
import { openTicket, openWindow, useWords, wq, WqButton, WqCard } from "./parts";

/** The share of the two asks that sits on UP, as a whole percent; null unless both sides rest. */
function impliedUpShare(upCents: number | null, downCents: number | null): number | null {
  if (upCents === null || downCents === null) return null;
  const total = upCents + downCents;
  return total === 0 ? null : Math.round((upCents / total) * 100);
}

const cents = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);

/**
 * web's word-board/WordCard: one Window as a plain question with the book's price on each answer. The bar is the only
 * derivation (UP's share of the two asks) and draws flat until both asks are known; an empty book says so in words
 * with an "Open" link instead of two prices nobody is making.
 */
export function WordCard({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color, t } = useWords();
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const closeClock = formatWallClock(market.expirySec * 1000);
  const question = wordQuestion({ ...market, marketId: String(market.marketId) }, ORACLE_PRICE_SCALE, closeClock);
  const share = impliedUpShare(upCents, downCents);
  const kind = market.lane === "token" && isTickerSymbol(market.asset) ? CLOSED.kind[TICKERS[market.asset].kind] : null;
  const unquoted = !hydrating && upCents === null && downCents === null;

  return (
    <WqCard>
      <View style={wq.top}>
        <AssetDisc asset={market.asset} size={28} />
        <Text style={[wq.meta, { color: color.inkMuted }]}>{market.asset}</Text>
        {kind ? <Text style={[styles.kind, { color: color.accent, borderColor: t.wqKindBorder }]}>{kind}</Text> : null}
        <View style={styles.push} />
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} style={styles.clock} />
      </View>

      <Text style={[wq.q, { color: question.pending ? t.wqPending : t.wqInk }]}>{question.text}</Text>

      {unquoted ? null : (
        <>
          <View style={[styles.bar, { backgroundColor: share === null ? t.wqTrackUnknown : t.wqTrack }]} accessibilityElementsHidden importantForAccessibility="no">
            {share === null ? null : (
              <LinearGradient colors={[t.wqFillFrom, t.wqFillTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${share}%`, shadowColor: t.wqFillGlow }]} />
            )}
          </View>
          <View style={styles.oddsRow}>
            <Text style={[styles.close, { color: color.inkDisabled }]}>{WORD_BOARD.closes(closeClock)}</Text>
            <Text style={[styles.lead, { color: color.inkMuted }]}>{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</Text>
          </View>
        </>
      )}

      {unquoted ? (
        <View style={[styles.unquoted, { borderColor: color.hairline }]}>
          <View style={[styles.dot, { backgroundColor: color.inkMuted }]} />
          <Text style={[styles.unquotedText, { color: color.inkMuted }]}>{CLOSED.noQuotes}</Text>
          <Pressable onPress={() => openWindow(market.marketId)} accessibilityRole="link" hitSlop={10}>
            <Text style={[styles.open, { color: color.inkSecondary }]}>{WORD_BOARD.open}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={wq.actions}>
          <WqButton side="up" word={PLAIN_WORDS.yes} cents={cents(upCents, hydrating)} label={`${PLAIN_WORDS.yes} ${cents(upCents, hydrating)}`} onPress={() => openTicket(market.marketId, "up")} />
          <WqButton side="down" word={PLAIN_WORDS.no} cents={cents(downCents, hydrating)} label={`${PLAIN_WORDS.no} ${cents(downCents, hydrating)}`} onPress={() => openTicket(market.marketId, "down")} />
        </View>
      )}
    </WqCard>
  );
}

const styles = StyleSheet.create({
  kind: { marginLeft: 6, paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderRadius: 9999, fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  push: { flex: 1 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8 },
  bar: { height: 6, borderRadius: 4, marginBottom: 10, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 4, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  oddsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  close: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
  lead: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  unquoted: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: 10 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  unquotedText: { flex: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  open: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
});
