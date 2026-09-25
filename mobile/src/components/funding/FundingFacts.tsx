import type { Address } from "@agari/core/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFundingProgress, type FundingLink } from "@/features/funding/useFundingProgress";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";

/** web `FundingProgress` (`.fund-progress`): the two balance cells, the SOL policy, the live step, and each claim's receipt. */
export function FundingFacts({ address, faucet }: { address: Address; faucet: ReturnType<typeof useFaucet> }) {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const p = useFundingProgress(address, faucet);
  const cell = (label: string, value: string) => (
    <View style={[styles.cell, { borderColor: t.fundCell }]}>
      <Text style={[styles.dt, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.dd, { color: color.ink }]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.progress} accessibilityLiveRegion="polite">
      <View style={styles.balances}>
        {cell("SOL for network fees", p.solText)}
        {cell("tUSDC for trading", p.tokenText)}
      </View>
      <FootLine text={p.policy} />
      <FootLine text={p.gasLine} />
      <FootLine text={p.mintNote} />
      {p.busyLabel ? <Text style={[fundStyles.msg, { color: color.ink }]}>{p.busyLabel}</Text> : null}
      {p.error ? (
        <Text style={[fundStyles.msg, { color: color.loss }]} accessibilityRole="alert">
          {p.error}
        </Text>
      ) : null}
      <FootLink link={p.solLink} />
      <FootLine text={p.solNext} />
      <FootLink link={p.mintLink} />
      <FootLine text={p.mintNext} />
    </View>
  );
}

/** `.fund-foot-line`: mono 11, gray-500. */
export function FootLine({ text }: { text: string | null | undefined }) {
  const { color } = useTheme();
  return text ? <Text style={[fundStyles.foot, { color: color.inkMuted }]}>{text}</Text> : null;
}

/** `.fund-foot-link`: mono 11, gray-500, vermilion while pressed. */
export function FootText({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      {({ pressed }) => <Text style={[fundStyles.foot, { color: pressed ? color.accent : color.inkMuted }]}>{label}</Text>}
    </Pressable>
  );
}

function FootLink({ link }: { link: FundingLink | null }) {
  return link ? <FootText label={link.label} onPress={() => void openExternal(link.href)} /> : null;
}

export const fundStyles = StyleSheet.create({
  foot: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  msg: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, marginTop: 12, textAlign: "center" },
});

const styles = StyleSheet.create({
  progress: { gap: 10, marginVertical: 16 },
  balances: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, minWidth: 0, padding: 10, borderWidth: 1, borderRadius: 8 },
  dt: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  dd: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, marginTop: 5 },
});
