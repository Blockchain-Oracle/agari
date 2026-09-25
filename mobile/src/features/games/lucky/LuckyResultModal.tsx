import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Cta, Eyebrow, GameModal } from "~/features/games/frame";
import { playSfx } from "~/games/audio";
import { PIXEL_FONT } from "~/theme/web/games";
import { LinkWord, LUCKY_TEXT, TxLine, useLuckyTokens } from "./parts";

interface Props {
  row: LuckyRowWire;
  decimals: number | null;
  symbol: string;
  streak: number;
  onClose: () => void;
}

/**
 * web's `LuckyResultModal.tsx` — Pips' LuckyResult (YOU WON / MISSED) in the duel's result-modal grammar
 * (`.du-modal`, `--won` profit, `--lost` loss): the eyebrow, the verdict in the pixel face, the draw, the one line
 * the chain decided, the streak on a win, the transaction and the way to collect, and a quiet Close. It never
 * re-spins.
 */
export function LuckyResultModal({ row, decimals, symbol, streak, onClose }: Props) {
  const { color } = useLuckyTokens();
  useEffect(() => {
    playSfx("modal-open");
    return () => playSfx("modal-close");
  }, []);

  const words = LUCKY.result;
  const won = row.result === "won";
  const lost = row.result === "lost";
  const verdict = won ? words.won : lost ? words.lost : row.result === "void" ? words.void : words.cashedOut;
  const ink = won ? color.profit : lost ? color.loss : color.ink;
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));
  const line = won ? words.pays(money(row.quantityRaw), symbol) : lost ? words.lostLine(money(row.costBase), symbol) : row.result === "void" ? words.voidLine : words.cashedLine;

  return (
    <GameModal open onClose={onClose} closeLabel={words.close}>
      <Eyebrow style={styles.eyebrow}>{words.eyebrow}</Eyebrow>
      <Text style={[styles.verdict, { color: ink }]} accessibilityRole="header">
        {verdict.toUpperCase()}
      </Text>
      <Text style={[styles.soft, { color: color.inkSecondary }]}>
        {row.asset && row.side && row.multiplier ? words.line(row.asset, SIDE_WORD[row.side], row.multiplier).toUpperCase() : ""}
      </Text>
      <Text style={[LUCKY_TEXT.body, { color: color.inkSecondary }]}>{line}</Text>
      {won && streak > 0 ? <Text style={[styles.streak, { color: color.accent }]}>{words.streak(streak).toUpperCase()}</Text> : null}
      <View style={styles.links}>
        {row.txHash ? <TxLine label={LUCKY.placed.tx} hash={row.txHash} /> : null}
        {won ? (
          <LinkWord
            label={words.claim}
            onPress={() => {
              onClose();
              router.push("/portfolio");
            }}
          />
        ) : null}
      </View>
      <Cta label={words.close} variant="quiet" onPress={onClose} />
    </GameModal>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: 12 },
  verdict: { textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, letterSpacing: 7.04 },
  soft: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 14, letterSpacing: 1.8 },
  streak: { marginTop: 6, fontFamily: PIXEL_FONT, fontSize: 16, lineHeight: 18, letterSpacing: 2.24, fontVariant: ["tabular-nums"] },
  links: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 },
});
