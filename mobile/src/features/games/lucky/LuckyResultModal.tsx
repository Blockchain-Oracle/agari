import type { Signature } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { router } from "expo-router";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Button } from "~/components/kit";
import { playSfx } from "~/games/audio";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

interface Props {
  row: LuckyRowWire;
  decimals: number | null;
  symbol: string;
  streak: number;
  reduced: boolean;
  onClose: () => void;
}

/**
 * web's `LuckyResultModal.tsx` — the verdict, the moment it lands (YOU WON / MISSED) — as a native modal: 21st
 * ddoemonn/modal's scrim fade and card rise, ported to Reanimated entering animations. It says only what the chain
 * decided; the streak shows only on a win, and only the number the verified history adds up to. It never re-spins.
 */
// 21st: ddoemonn/modal
export function LuckyResultModal({ row, decimals, symbol, streak, reduced, onClose }: Props) {
  const { color } = useTheme();
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
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={[styles.root, { backgroundColor: color.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={words.close} />
        <Animated.View
          entering={reduced ? undefined : ZoomIn.springify().damping(16)}
          style={[styles.card, { backgroundColor: color.surface1, borderColor: won ? color.profit : lost ? color.loss : color.hairline }]}
          accessibilityViewIsModal
        >
          <Text style={[styles.kicker, { color: color.accent }]}>{words.eyebrow.toUpperCase()}</Text>
          <Text style={[TYPE.stampHero, styles.verdict, { color: ink }]} accessibilityRole="header">
            {verdict}
          </Text>
          {row.asset && row.side && row.multiplier ? (
            <Text style={[TYPE.dataLg, { color: color.ink }]}>{words.line(row.asset, SIDE_WORD[row.side], row.multiplier)}</Text>
          ) : null}
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{line}</Text>
          {won && streak > 0 ? <Text style={[TYPE.data, { color: color.accent }]}>{words.streak(streak)}</Text> : null}
          <View style={styles.actions}>
            {row.txHash ? (
              <Button
                label={`${LUCKY.placed.tx} ${shortHex(row.txHash, 6, 4)}`}
                variant="outline"
                size="sm"
                icon={{ ios: "arrow.up.right.square", android: "open_in_new" }}
                onPress={() => void openExternal(txUrl(row.txHash as Signature))}
              />
            ) : null}
            {won ? (
              <Button
                label={words.claim}
                variant="profit"
                onPress={() => {
                  onClose();
                  router.push("/portfolio");
                }}
              />
            ) : null}
            <Button label={words.close} variant="secondary" onPress={onClose} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: SPACE.gutter },
  card: { borderRadius: RADIUS.xl, borderWidth: 1, padding: 24, gap: 12 },
  kicker: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  verdict: { fontSize: 52, lineHeight: 58 },
  actions: { gap: 8, marginTop: 6 },
});
