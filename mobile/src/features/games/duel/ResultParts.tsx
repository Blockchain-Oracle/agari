import { cardPnl, type CardReceipt, type DeckCard, type MatchOutcome } from "@agari/core/games";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import { PulseDot } from "~/features/games/frame";
import { FONT } from "~/theme";
import { cadenceLabel } from "../stage";
import { Facts, Foot, Key, Plate, useDuelTokens } from "./parts";

/** web's `.du-verdict`: the verdict line (Sora 800 20), both seats' real PnL, what the pot follows; edged in the side's colour. */
export function Verdict({ outcome, you, yourPnl, theirPnl, money, symbol, free, children }: {
  outcome: MatchOutcome;
  you: string | null;
  yourPnl: bigint | null;
  theirPnl: bigint | null;
  money: (base: bigint | null) => string;
  symbol: string;
  free: boolean;
  children?: ReactNode;
}) {
  const { d, color } = useDuelTokens();
  const won = outcome.winner !== null && outcome.winner === you;
  const lost = outcome.winner !== null && outcome.winner !== you;
  const line = outcome.winner === null ? DUEL.result.tied : won ? DUEL.result.won : DUEL.result.lost;
  return (
    <Plate style={[styles.verdict, won ? { borderColor: d.verdictWon } : lost ? { borderColor: d.verdictLost } : null]}>
      <Text style={[styles.line, { color: color.ink }]} accessibilityRole="header">
        {line}
      </Text>
      <Facts
        items={[
          { k: `${DUEL.result.you} · ${DUEL.result.pnl}`, v: `${signed(yourPnl, money)} ${symbol}`, tone: tone(yourPnl) },
          { k: `${DUEL.result.opponent} · ${DUEL.result.pnl}`, v: `${signed(theirPnl, money)} ${symbol}`, tone: tone(theirPnl) },
        ]}
      />
      <Foot>{DUEL.result.pnlNote}</Foot>
      <Foot>{free ? DUEL.result.freePotNote : DUEL.result.potNote}</Foot>
      {children}
    </Plate>
  );
}

/**
 * web's result card list (`.du-picked-list` of `.du-picked-row`): each receipt's side dot (a pulsing vermilion dot
 * while it waits), the asset, cadence and seat, the cost and payout, and its PnL; a settled row takes its side's wash.
 */
export function ReceiptRows({ receipts, cards, you, money, symbol }: {
  receipts: readonly CardReceipt[];
  cards: readonly DeckCard[];
  you: string | null;
  money: (base: bigint | null) => string;
  symbol: string;
}) {
  const { color } = useDuelTokens();
  const rows = [...receipts].sort((a, b) => a.cardIndex - b.cardIndex || (a.player === you ? -1 : 1));
  return (
    <Plate>
      <Key>{DUEL.result.cards}</Key>
      <View style={styles.list}>
        {rows.map((receipt) => {
          const card = cards.find((c) => c.index === receipt.cardIndex);
          const pnl = cardPnl(receipt);
          const settled = receipt.payoutBase !== null;
          const wash = settled ? (pnl !== null && pnl > 0n ? color.profitWash : color.lossWash) : "transparent";
          return (
            <View key={receipt.pickKey} style={[styles.row, { backgroundColor: wash }]}>
              {settled ? (
                <View style={[styles.dot, { backgroundColor: receipt.pick === "up" ? color.profit : color.loss }]} />
              ) : (
                <PulseDot color={color.accent} style={{ shadowColor: color.accent, shadowOpacity: 1, shadowRadius: 2.5, shadowOffset: { width: 0, height: 0 } }} />
              )}
              <Text style={[styles.v, { color: color.ink }]}>{card?.asset ?? "—"}</Text>
              <Key>{card ? cadenceLabel(card.intervalSec) : ""}</Key>
              <Key>{receipt.player === you ? DUEL.result.you : DUEL.result.opponent}</Key>
              <Text style={[styles.foot, styles.wide, { color: color.inkSecondary }]}>
                {DUEL.result.cost} {money(receipt.costBase)} · {DUEL.result.payout} {settled ? money(receipt.payoutBase) : DUEL.result.unsettled} {symbol}
              </Text>
              {pnl !== null ? <Text style={[styles.foot, { color: pnl > 0n ? color.profit : pnl < 0n ? color.loss : color.inkSecondary }]}>{signed(pnl, money)}</Text> : null}
            </View>
          );
        })}
      </View>
    </Plate>
  );
}

function tone(base: bigint | null): "profit" | "loss" | undefined {
  if (base === null || base === 0n) return undefined;
  return base > 0n ? "profit" : "loss";
}

export function signed(base: bigint | null, money: (b: bigint | null) => string): string {
  if (base === null) return DUEL.result.unsettled;
  return `${base > 0n ? "+" : base < 0n ? "−" : ""}${money(base < 0n ? -base : base)}`;
}

const styles = StyleSheet.create({
  verdict: { gap: 10 },
  line: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 32 },
  list: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  v: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  wide: { flexBasis: "100%" },
});
