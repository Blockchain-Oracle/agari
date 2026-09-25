import { formatCadence, isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CLOSED } from "@/lib/copy-closed";
import { PREOPEN } from "@/lib/copy-preopen";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { openTicket, useWords, wq, WqButton, WqCard } from "./parts";

/**
 * web's word-board/WordListedCard: one company's listed Windows as one card. A stock Window before its bell takes a
 * scheduled call, so the card says when it opens, lets you pick the Window length, and hands Up or Down to the
 * pre-open ticket — no countdown to an expiry hours away, no Yes/No against a book that cannot exist yet.
 */
export function WordListedCard({ markets }: { markets: readonly EventMarket[] }) {
  const { color, t } = useWords();
  const [picked, setPicked] = useState(0);
  const market = markets[Math.min(picked, markets.length - 1)];
  if (!market) return null;
  const name = isTickerSymbol(market.asset) ? TICKERS[market.asset].name : market.asset;
  return (
    <WqCard>
      <View style={wq.top}>
        <AssetDisc asset={market.asset} size={28} />
        <Text style={[wq.meta, { color: color.inkMuted }]}>{market.asset}</Text>
        <View style={styles.push} />
        <Text style={[styles.chip, { color: color.inkMuted, borderColor: color.hairline }]}>{PREOPEN.card.clock}</Text>
      </View>
      <Text style={[wq.q, { color: t.wqInk }]}>{name}</Text>
      <Text style={[styles.when, { color: color.inkSecondary }]}>{PREOPEN.card.why}</Text>
      {markets.length > 1 ? (
        <View style={styles.cadences} accessibilityLabel={CLOSED.cadencesAria}>
          {markets.map((m, i) => {
            const on = i === picked;
            return (
              <Pressable
                key={String(m.marketId)}
                onPress={() => {
                  haptic.select();
                  setPicked(i);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.cadence, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : "transparent" }]}
              >
                <Text style={[styles.cadenceText, { color: on ? color.ink : color.inkSecondary }]}>{formatCadence(m.intervalSec)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={wq.actions}>
        <WqButton side="up" word={CLOSED.callUp} label={CLOSED.callUp} onPress={() => openTicket(market.marketId, "up")} />
        <WqButton side="down" word={CLOSED.callDown} label={CLOSED.callDown} onPress={() => openTicket(market.marketId, "down")} />
      </View>
    </WqCard>
  );
}

const styles = StyleSheet.create({
  push: { flex: 1 },
  chip: { paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderRadius: 9999, fontFamily: FONT.body, fontSize: 10, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  when: { marginTop: -4, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  cadences: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  cadence: { minWidth: 44, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9999 },
  cadenceText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
});
