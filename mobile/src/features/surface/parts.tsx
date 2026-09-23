import { formatClock, formatOracleRaw, remainingSec } from "@agari/core/units";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { isBasketAsset, ORACLE_SCALE, POINTS_UNIT } from "@/features/markets/hero/units";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's `oraclePriceText` (markets/hero/OraclePrice.tsx): dollars, or points for a basket; "—" when unknown. */
export function oraclePriceText(raw: bigint | null, asset = ""): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} ${POINTS_UNIT}` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}

/** web's `Countdown` as text: the clock to the close, "—" once it has passed or before the first tick. */
export function clockText(expirySec: number, nowMs: number): string {
  const left = nowMs > 0 ? remainingSec(nowMs, expirySec) : 0;
  return left > 0 ? formatClock(left) : "—";
}

/** A bordered box for a chart or a table with a centred sentence when there is nothing to draw. */
export function SurfaceBox({ children, empty }: { children?: ReactNode; empty?: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      {empty ? <Text style={[TYPE.caption, styles.empty, { color: color.inkMuted }]}>{empty}</Text> : children}
    </View>
  );
}

/** web's `.sf-params`: the mono line of figures under a box. */
export function Params({ items }: { items: readonly string[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.params}>
      {items.map((item) => (
        <Text key={item} style={[styles.param, { color: color.inkMuted }]}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  empty: { textAlign: "center", paddingVertical: 36 },
  params: { gap: 3 },
  param: { fontFamily: FONT.data, fontSize: 11, lineHeight: 15 },
});
