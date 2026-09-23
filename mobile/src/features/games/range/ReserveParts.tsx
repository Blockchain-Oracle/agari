import { StyleSheet, Text, View } from "react-native";
import { Card, SectionHeader } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";

/**
 * The pieces Range and Moonshot share on web's parlay-page frame: `CapabilityPending` (the reserve is not on this
 * network — what the mode is, and why it is not here yet) and the "How it pays" cards.
 */
export function ReservePending({ title, body, why, dependency }: { title: string; body: string; why: string; dependency: string }) {
  const { color } = useTheme();
  return (
    <Card>
      <Text style={[TYPE.labelMicro, { color: color.warning }]}>Not on this network yet</Text>
      <Text style={[TYPE.title, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{body}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{why}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>Waiting on {dependency}.</Text>
    </Card>
  );
}

export function HowCards({ number, title, cards }: { number: string; title: string; cards: readonly { n: string; t: string; d: string }[] }) {
  const { color } = useTheme();
  return (
    <>
      <SectionHeader index={number} title={title} />
      {cards.map((card, i) => (
        <View key={card.n} style={[styles.how, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
          <Text style={[styles.n, { color: color.accent }]}>{String(i + 1).padStart(2, "0")}</Text>
          <View style={styles.howText}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{card.t}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{card.d}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  how: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  n: { fontFamily: FONT.dataStrong, fontSize: 15, lineHeight: 23 },
  howText: { flex: 1, gap: 4 },
});
