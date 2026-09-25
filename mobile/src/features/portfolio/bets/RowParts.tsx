import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";

/** history.css `.bets-row`: flex-wrap, gap 8/16, padding 12/20, a hairline on top (none on the list's first row). */
export function BetsRow({ first = false, children }: { first?: boolean; children: ReactNode }) {
  const { color } = useTheme();
  return <View style={[styles.row, { borderTopColor: color.hairline }, first && styles.first]}>{children}</View>;
}

/** The state word where the live dot sits: `● LIVE` in ink-secondary, a settled word in ink. */
export function Status({ word, dot }: { word: string; dot?: "accent" | "muted" | null }) {
  const { color } = useTheme();
  return (
    <Text style={[WEB_TYPE.labelMicro, { color: dot ? color.inkSecondary : color.ink }]}>
      {dot ? <Text style={{ color: dot === "accent" ? color.accent : color.inkMuted }}>{"●  "}</Text> : null}
      {word}
    </Text>
  );
}

/** The call, linked to its Window: the 18 pt mark (`.bets-mark`) then "AAPL UP" in type-body-strong. */
export function Call({ marketId, asset, text }: { marketId: string; asset: string | null; text: string }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: marketId } })} accessibilityRole="link" hitSlop={6} style={styles.call}>
      {asset ? <AssetDisc asset={asset} size={18} /> : null}
      <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{text}</Text>
    </Pressable>
  );
}

export function Micro({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" }) {
  const { color } = useTheme();
  return <Text style={[WEB_TYPE.labelMicro, { color: tone === "accent" ? color.accent : color.inkMuted }]}>{children}</Text>;
}

export function Caption({ children, tone = "secondary" }: { children: ReactNode; tone?: "secondary" | "muted" | "warning" | "ink" }) {
  const { color } = useTheme();
  const ink = { secondary: color.inkSecondary, muted: color.inkMuted, warning: color.warning, ink: color.ink }[tone];
  return <Text style={[WEB_TYPE.caption, { color: ink }]}>{children}</Text>;
}

/** web `<Money>`: the figure in tabular numbers, the symbol after it; `pnl` signs it and inks it profit or loss. */
export function MoneyText({ value, decimals, symbol, pnl, big }: { value: bigint; decimals: number; symbol?: string; pnl?: boolean; big?: boolean }) {
  const { color } = useTheme();
  const ink = pnl ? (value > 0n ? color.profit : value < 0n ? color.loss : color.inkSecondary) : undefined;
  return (
    <Text style={[big ? WEB_TYPE.data : WEB_TYPE.numbers, ink ? { color: ink } : null]}>
      {formatBaseUnits(value, decimals, { signed: pnl })}
      {symbol ? <Text style={{ color: color.inkSecondary }}> {symbol}</Text> : null}
    </Text>
  );
}

/** `.bets-break` + `flex-1`: the money and the action wrap to a second line on a phone, pushed to the trailing edge. */
export function Break() {
  return (
    <>
      <View style={styles.break} />
      <View style={styles.grow} />
    </>
  );
}

/** `type-caption text-accent underline`: the row's one action. */
export function TextAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} hitSlop={8}>
      <Text style={[WEB_TYPE.caption, styles.underline, { color: color.accent }, disabled && styles.off]}>{label}</Text>
    </Pressable>
  );
}

/** A refusal under the row: `basis-full text-left text-warning`. */
export function RowNote({ text }: { text: string | null }) {
  const { color } = useTheme();
  if (!text) return null;
  return (
    <Text style={[WEB_TYPE.caption, styles.full, { color: color.warning }]} accessibilityRole="alert">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 8, columnGap: 16, paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1 },
  first: { borderTopWidth: 0 },
  call: { flexDirection: "row", alignItems: "center", gap: 6 },
  break: { width: "100%", height: 0 },
  grow: { flexGrow: 1 },
  underline: { textDecorationLine: "underline" },
  off: { opacity: 0.5 },
  full: { width: "100%" },
});
