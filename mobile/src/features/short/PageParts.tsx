import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";

export { Note, TitleHero } from "./LegacyParts";

/**
 * web's `components/shell/SectionHead.tsx` (`.section-head`, part-05 + part-15 at ≤ 720 px): the mono index at the
 * foot of its column, the 22 px Sora title, the 12 px caption, the rule with its 46 px vermilion tick.
 */
export function SectionHead({ number, title, desc }: { number: string; title: string; desc?: string }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  return (
    <View style={[styles.head, { borderBottomColor: t.sectionRule }]}>
      <View style={styles.index}>
        <Text style={[styles.indexNum, { color: color.inkMuted }]}>{number}</Text>
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

/** `.sh-how-card`: the circled numeral in Sora 24 vermilion, a 14 px title, a 12 px paragraph. */
export function HowCards({ cards }: { cards: readonly { n: string; t: string; d: string }[] }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  return (
    <View style={styles.how}>
      {cards.map((card) => (
        <View key={card.n} style={[styles.howCard, { backgroundColor: t.howBg, borderColor: t.howBorder }]}>
          <Text style={[styles.howN, { color: color.accent }]}>{card.n}</Text>
          <Text style={[styles.howT, { color: color.ink }]}>{card.t}</Text>
          <Text style={[styles.howD, { color: color.inkMuted }]}>{card.d}</Text>
        </View>
      ))}
    </View>
  );
}

/** web's `components/shell/CapabilityPending.tsx` (`.capability-pending`, shell.css): the honest holding state. */
export function CapabilityPending({ eyebrow, title, dependency, children }: { eyebrow: string; title: string; dependency: string; children: ReactNode }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  return (
    <View style={styles.pending}>
      <Text style={[styles.cpEyebrow, { color: color.accent }]}>{eyebrow}</Text>
      <Text style={[styles.cpTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.cpBody}>{children}</View>
      <Text style={[styles.cpMeta, { color: color.inkMuted, borderTopColor: t.pendingRule }]}>Not connected yet · waiting on {dependency}</Text>
      <Pressable onPress={() => router.push("/markets")} accessibilityRole="link" hitSlop={8} style={styles.cpActionHit}>
        <Text style={[styles.cpAction, { color: color.accent }]}>Make a call on the markets →</Text>
      </Pressable>
    </View>
  );
}

/** A paragraph inside `CapabilityPending`'s body (15 px, 1.6, gray-400). */
export function PendingParagraph({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[styles.cpP, { color: color.inkSecondary }]}>{children}</Text>;
}

/** web's `features/markets/wallet/ConnectButton.tsx` disconnected: the default Button, "Connecting…" while one is in flight. */
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

/**
 * web's `components/data/Money.tsx`: the amount in tabular figures, the symbol in the secondary ink after a space;
 * `pnl` signs it and gives it the profit or loss ink. Nest it in a Text to take that line's size.
 */
export function Money({ value, decimals, symbol, tone = "neutral", style }: { value: bigint; decimals: number; symbol?: string; tone?: "neutral" | "pnl"; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  const ink = tone === "pnl" ? (value > 0n ? color.profit : value < 0n ? color.loss : color.inkSecondary) : undefined;
  return (
    <Text style={[styles.numbers, ink ? { color: ink } : null, style]}>
      {formatBaseUnits(value, decimals, { signed: tone === "pnl" })}
      {symbol ? <Text style={{ color: color.inkSecondary }}> {symbol}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 18, borderBottomWidth: 1 },
  index: { alignItems: "center", paddingBottom: 2, marginRight: 8 + 14 },
  indexNum: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.4 },
  mid: { flex: 1, gap: 6 },
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 22, letterSpacing: -0.55 },
  desc: { marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  tick: { position: "absolute", left: 0, bottom: -1, width: 46, height: 2 },
  how: { gap: 16 },
  howCard: { padding: 20, borderWidth: 1, borderRadius: 16 },
  howN: { marginBottom: 8, fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 24 },
  howT: { marginBottom: 6, fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  howD: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5 },
  pending: { paddingVertical: 48 },
  cpEyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
  cpTitle: { marginTop: 12, fontFamily: FONT.heading, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56 },
  cpBody: { marginTop: 12 },
  cpP: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  cpMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  cpActionHit: { alignSelf: "flex-start", marginTop: 16 },
  cpAction: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
  connect: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  connectText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  numbers: { fontFamily: FONT.body, fontVariant: ["tabular-nums"] },
});
