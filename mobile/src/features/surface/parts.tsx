import { SETTLING, STALE_REASON_LABEL, staleLine } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { StaleReason } from "@agari/core";
import { formatClock, formatOracleRaw, formatUtc } from "@agari/core/units";
import { TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { isBasketAsset, ORACLE_SCALE, POINTS_UNIT } from "@/features/markets/hero/units";
import { FONT, useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";

const PLACEHOLDER = "–:––";

/** web's `oraclePriceText` (markets/hero/OraclePrice.tsx): dollars, or points for a basket; "—" when unknown. */
export function oraclePriceText(raw: bigint | null, asset = ""): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} ${POINTS_UNIT}` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}

/** web's components/data/Countdown.tsx: the clock to the close, vermilion (`text-accent`) once urgent. */
export function Countdown({ expirySec, intervalSec, nowMs, style }: { expirySec: number; intervalSec: number; nowMs: number; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <Text style={[style, { fontVariant: ["tabular-nums"] }, state?.urgent ? { color: color.accent } : null]} accessibilityRole="timer">
      {state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : PLACEHOLDER}
    </Text>
  );
}

/** web's StaleTick: the triangle and how old the kept value is, in the warning ink. */
export function StaleTick({ asOfMs, reason = "refresh-failed", compact = false }: { asOfMs: number; reason?: StaleReason; compact?: boolean }) {
  const { color } = useTheme();
  const label = STALE_REASON_LABEL[reason];
  return (
    <View style={styles.stale} accessibilityRole="text" accessibilityLiveRegion="polite">
      <TriangleAlert size={14} color={color.warning} />
      <Text style={[styles.staleText, { color: color.warning }]}>{compact ? label : staleLine(formatUtc(asOfMs, { withSeconds: false }), label)}</Text>
    </View>
  );
}

/** `.sf-box`: the hairline box on the page ground (the paper step in light). */
export function SurfaceBox({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { name } = useTheme();
  const t = surfaceTokens(name);
  return <View style={[styles.box, { backgroundColor: t.boxFill, borderColor: t.boxBorder }, style]}>{children}</View>;
}

/** `.sf-box-empty`: the centred mono sentence where there is nothing to draw. */
export function BoxEmpty({ text, rows = false }: { text: string; rows?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={rows ? styles.emptyRows : styles.emptyFill}>
      <Text style={[styles.emptyText, { color: color.inkDisabled }]}>{text}</Text>
    </View>
  );
}

/** `.sf-params`: the 10 px mono line of figures under a box; `<b>` spans in gray-400. */
export function Params({ children }: { children: ReactNode }) {
  return <View style={styles.params}>{children}</View>;
}

export function Param({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[styles.param, { color: color.inkDisabled }]}>{children}</Text>;
}

export function ParamB({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={{ color: color.inkSecondary }}>{children}</Text>;
}

export const MONO = FONT.dataRegular;

const styles = StyleSheet.create({
  stale: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  staleText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  box: { borderWidth: 1, borderRadius: 4, overflow: "hidden" },
  emptyFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emptyRows: { paddingVertical: 32, paddingHorizontal: 20, alignItems: "center" },
  emptyText: { fontFamily: MONO, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
  params: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 },
  param: { fontFamily: MONO, fontSize: 10, lineHeight: 16 },
});
