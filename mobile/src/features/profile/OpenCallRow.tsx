import { countdown } from "@agari/core/lifecycle";
import type { OpenPosition } from "@agari/core/types";
import { formatBaseUnits, formatClock } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCadence, MARKETS, PORTFOLIO } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme } from "~/theme";

/** UP, DOWN, or both — a position can hold either token, and merging them into one word would hide a hedge. */
function sideLabel(position: OpenPosition): string {
  const up = position.balanceUpRaw > 0n;
  const down = position.balanceDownRaw > 0n;
  if (up && down) return PORTFOLIO.bothSides;
  return up ? MARKETS.up : MARKETS.down;
}

/**
 * One open call — web's `BetRow` (features/markets/portfolio/BetRow.tsx) read-only: live or settling, the Window,
 * the clock, staked · worth now · the unrealised P&L in its tone. The row opens the Window. Cash-out lives on the
 * owner's own Portfolio, where the wallet can sign it.
 */
export function OpenCallRow({ position, symbol, nowMs }: { position: OpenPosition; symbol: string; nowMs: number }) {
  const { color } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, position.expirySec, position.intervalSec) : null;
  const settling = state?.settling ?? false;
  const pnl = position.unrealizedPnlBase;
  const pnlInk = pnl > 0n ? color.profit : pnl < 0n ? color.loss : color.inkSecondary;
  const money = (value: bigint, signed = false) => formatBaseUnits(value, position.decimals, { signed });
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(`/markets/${position.marketId}`);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${position.asset} ${sideLabel(position)} ${formatCadence(position.intervalSec)}, ${PORTFOLIO.stake} ${money(position.costBasisBase)} ${symbol}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: color.hairline, backgroundColor: pressed ? color.surface2 : "transparent" }]}
    >
      <AssetDisc asset={position.asset} size={32} />
      <View style={styles.main}>
        <View style={styles.line}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            {position.asset} {sideLabel(position)}
          </Text>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{formatCadence(position.intervalSec)}</Text>
          <View style={styles.status}>
            {!settling ? <View style={[styles.dot, { backgroundColor: color.accent }]} /> : null}
            <Text style={[TYPE.labelMicro, { color: settling ? color.ink : color.inkSecondary }]}>
              {settling ? PORTFOLIO.settling : PORTFOLIO.live}
            </Text>
          </View>
        </View>
        <Text style={[styles.meta, { color: color.inkSecondary }]}>
          {!settling && state ? `${formatClock(state.remainingSec)} ${PORTFOLIO.left} · ` : ""}
          {PORTFOLIO.stake} {money(position.costBasisBase)} {symbol} · {PORTFOLIO.value} {money(position.markValueBase)}
        </Text>
      </View>
      <Text style={[TYPE.data, { color: pnlInk }]}>{money(pnl, true)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  status: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { fontFamily: FONT.data, fontSize: 12 },
});
