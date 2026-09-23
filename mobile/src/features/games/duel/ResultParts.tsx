import { cardPnl, type CardReceipt, type DeckCard, type MatchOutcome } from "@agari/core/games";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme } from "~/theme";
import { cadenceLabel } from "../stage";
import { Facts, Foot, Key, Plate } from "./parts";

/** web's `.du-verdict`: the verdict line, both seats' real PnL, and what the pot follows. */
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
  const { color } = useTheme();
  const won = outcome.winner !== null && outcome.winner === you;
  const lost = outcome.winner !== null && outcome.winner !== you;
  const line = outcome.winner === null ? DUEL.result.tied : won ? DUEL.result.won : DUEL.result.lost;
  const border = won ? color.accent : lost ? color.hairline : color.borderStrong;
  return (
    <Plate style={{ borderColor: border, borderWidth: won ? 1 : StyleSheet.hairlineWidth }}>
      <Text style={[TYPE.stamp, { color: won ? color.accent : color.ink }]} accessibilityRole="header">
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

/** Every card's two receipts: the cost the contract measured, the payout once settled, and the PnL between them. */
export function ReceiptRows({ receipts, cards, you, money, symbol }: {
  receipts: readonly CardReceipt[];
  cards: readonly DeckCard[];
  you: string | null;
  money: (base: bigint | null) => string;
  symbol: string;
}) {
  const { color } = useTheme();
  const rows = [...receipts].sort((a, b) => a.cardIndex - b.cardIndex || (a.player === you ? -1 : 1));
  return (
    <Plate>
      <Key>{DUEL.result.cards}</Key>
      {rows.map((receipt) => {
        const card = cards.find((c) => c.index === receipt.cardIndex);
        const pnl = cardPnl(receipt);
        const settled = receipt.payoutBase !== null;
        const side = receipt.pick === "up" ? color.profit : color.loss;
        return (
          <View key={receipt.pickKey} style={[styles.row, { borderTopColor: color.hairline }]}>
            {card ? <AssetDisc asset={card.asset} size={26} /> : <View style={styles.disc} />}
            <View style={styles.main}>
              <Text style={[styles.title, { color: color.ink }]} numberOfLines={1}>
                {card?.asset ?? "—"} <Text style={{ color: color.inkMuted }}>{card ? cadenceLabel(card.intervalSec) : ""}</Text>{" "}
                <Text style={{ color: side }}>{receipt.pick.toUpperCase()}</Text>
              </Text>
              <Text style={[styles.sub, { color: color.inkMuted }]} numberOfLines={1}>
                {(receipt.player === you ? DUEL.result.you : DUEL.result.opponent).toUpperCase()} · {DUEL.result.cost} {money(receipt.costBase)} · {DUEL.result.payout}{" "}
                {settled ? money(receipt.payoutBase) : DUEL.result.unsettled} {symbol}
              </Text>
            </View>
            {pnl === null ? (
              <View style={[styles.live, { backgroundColor: color.accent }]} accessibilityLabel={DUEL.settling.waitingCard} />
            ) : (
              <Text style={[styles.pnl, { color: pnl > 0n ? color.profit : pnl < 0n ? color.loss : color.inkSecondary }]}>{signed(pnl, money)}</Text>
            )}
          </View>
        );
      })}
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  disc: { width: 26, height: 26 },
  main: { flex: 1, gap: 2 },
  title: { fontFamily: FONT.dataStrong, fontSize: 13 },
  sub: { fontFamily: FONT.data, fontSize: 10 },
  pnl: { fontFamily: FONT.dataStrong, fontSize: 13, fontVariant: ["tabular-nums"] },
  live: { width: 8, height: 8, borderRadius: 4 },
});
