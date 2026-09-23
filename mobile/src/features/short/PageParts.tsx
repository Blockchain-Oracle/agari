import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/**
 * The Trade pages' opening, as web draws `.page-title`: a mono eyebrow (with an optional chip beside it), the Sora
 * title closed by a vermilion full stop, an optional Japanese line, one lead paragraph.
 */
export function TitleHero({ eyebrow, aside, title, accent, jp, lead }: {
  eyebrow: string;
  aside?: ReactNode;
  title: string;
  /** A second line in the accent ink ("Earn the / spread."); without it the title ends in an accent stop. */
  accent?: string;
  jp?: string;
  lead?: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.hero}>
      <View style={styles.eyebrowRow}>
        <Text style={[styles.eyebrow, { color: color.accent }]}>{eyebrow.toUpperCase()}</Text>
        {aside}
      </View>
      <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
        {title}
        {accent ? "\n" : null}
        {accent ? <Text style={{ color: color.accent }}>{accent}</Text> : null}
        <Text style={{ color: color.accent }}>.</Text>
      </Text>
      {jp ? (
        <Text style={[styles.jp, { color: color.inkMuted }]}>{jp}</Text>
      ) : null}
      {lead ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{lead}</Text> : null}
    </View>
  );
}

/** web's "How it works" cards (`.sh-how-card`, `.pl-how-card`): a circled numeral, a title, a paragraph. */
export function HowCards({ cards }: { cards: readonly { n: string; t: string; d: string }[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.how}>
      {cards.map((card) => (
        <View key={card.n} style={[styles.howCard, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <Text style={[TYPE.dataLg, { color: color.accent }]}>{card.n}</Text>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{card.t}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{card.d}</Text>
        </View>
      ))}
    </View>
  );
}

/** A quiet line of guidance under a control; `warn` turns it to the loss ink (a refusal, a thin book). */
export function Note({ text, warn }: { text: string; warn?: boolean }) {
  const { color } = useTheme();
  return <Text style={[TYPE.caption, { color: warn ? color.loss : color.inkSecondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  eyebrow: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.8 },
  jp: { fontFamily: FONT.stamp, fontSize: 15, lineHeight: 20 },
  how: { gap: 10 },
  howCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
});
