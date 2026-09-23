import type { Address } from "@agari/core/types";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFundingProgress, type FundingLink } from "@/features/funding/useFundingProgress";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's FundingProgress facts: both balances, the SOL policy, the live step, and the claims with their receipts. */
export function FundingFacts({ address, faucet }: { address: Address; faucet: ReturnType<typeof useFaucet> }) {
  const { color } = useTheme();
  const p = useFundingProgress(address, faucet);
  const line = (text: string | null, tone: "muted" | "ink" | "loss" = "muted") =>
    text ? <Text style={[TYPE.caption, { color: tone === "loss" ? color.loss : tone === "ink" ? color.ink : color.inkMuted }]}>{text}</Text> : null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Row label="SOL for network fees" value={p.solText} />
        <View style={[styles.rule, { backgroundColor: color.hairline }]} />
        <Row label="tUSDC for trading" value={p.tokenText} />
      </View>
      {line(p.policy)}
      {line(p.gasLine)}
      {line(p.mintNote)}
      {line(p.busyLabel, "ink")}
      {line(p.error, "loss")}
      <Receipt link={p.solLink} />
      {line(p.solNext)}
      <Receipt link={p.mintLink} />
      {line(p.mintNext)}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{label}</Text>
      <Text style={[TYPE.data, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

function Receipt({ link }: { link: FundingLink | null }) {
  const { color } = useTheme();
  if (!link) return null;
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(link.href)} accessibilityRole="link">
      <Text style={[TYPE.caption, { color: color.accent }]}>{link.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  rule: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
