import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";
import { earnParlayTokens } from "~/theme/web/products/earn-parlay";

/** The theme's palette plus web's `/earn` and `/parlay` values (`theme/web/products/earn-parlay.ts`). */
export function useEarnParlay() {
  const { name, color } = useTheme();
  return { name, color, t: earnParlayTokens(name) };
}

/**
 * web's `components/shell/SectionHead.tsx` at 402 px (yosuku part-05 `.section-head`, phone rules in part-15): the mono
 * index bottom-left, the Sora 22 title and its 12 px description, the 1 px rule with the 46 px vermilion tick at its
 * left end. The right-hand meta is `display: none` on a phone, so it is not drawn. `/earn` tightens the bottom margin
 * to 16 (part-17); `/parlay` keeps part-15's 24.
 */
export function SectionHead({ number, title, desc, marginBottom = 24 }: { number: string; title: string; desc?: string; marginBottom?: number }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.head, { borderBottomColor: t.sectionRule, marginBottom }]}>
      <View style={styles.index}>
        <Text style={[styles.num, { color: color.inkMuted }]}>{number}</Text>
      </View>
      <View style={styles.mid}>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {desc ? <Text style={[styles.desc, { color: color.inkMuted }]}>{desc}</Text> : null}
      </View>
      <View style={[styles.tick, { backgroundColor: color.accent }]} />
    </View>
  );
}

/**
 * web's `features/markets/wallet/ConnectButton.tsx` disconnected: the default shadcn Button (48 tall on a phone, radius
 * 8, Inter 500), "Connecting…" while a wallet restores or a connection is in flight; it opens the wallet picker.
 */
export function ConnectButton() {
  const { color } = useTheme();
  const session = useWalletSession();
  const busy = session.isConnecting || session.connecting;
  return (
    <Pressable
      onPress={session.connect}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent, opacity: busy ? 0.5 : 1 }]}
    >
      <Text style={[styles.connectText, { color: color.onAccent }]}>{busy ? CONNECT.connecting : CONNECT.connect}</Text>
    </Pressable>
  );
}

/** web's `components/data/KeepCase.tsx`: `text` with every `symbol` kept in its own casing under an uppercase label. */
export function KeepCase({ text, symbol }: { text: string; symbol: string }) {
  if (!symbol || !text.includes(symbol)) return <>{text}</>;
  return (
    <>
      {text.split(symbol).map((part, i) => (
        <Fragment key={`${i}:${part}`}>
          {i > 0 ? <Text style={styles.sym}>{symbol}</Text> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sym: { textTransform: "none" },
  head: { flexDirection: "row", alignItems: "flex-end", columnGap: 14, paddingBottom: 18, borderBottomWidth: 1 },
  index: { alignItems: "center", paddingBottom: 2, marginRight: 8 },
  num: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.4 },
  mid: { flex: 1, gap: 6 },
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 22, letterSpacing: -0.55 },
  desc: { marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  tick: { position: "absolute", left: 0, bottom: -1, width: 46, height: 2 },
  connect: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  connectText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
});
