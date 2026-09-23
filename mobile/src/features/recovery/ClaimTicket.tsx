import { StyleSheet, Text, View } from "react-native";
import { CLAIM } from "@/features/x/copy";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const BARS = Array.from({ length: 46 }, (_, i) => 2 + ((i * 7 + 3) % 5));
const C = CLAIM.card;

/**
 * web's features/x/ClaimReceiptCard.tsx: the Trading Balance as a cream paper ticket — masked until the X account is
 * proven, the figure once known, "claimed" when the right wallet is connected.
 */
export function ClaimTicket({ amount, handle, done, symbol }: { amount: string | null; handle: string | null; done: boolean; symbol: string }) {
  const { color } = useTheme();
  const known = amount !== null;
  const ink = color.creamInk;
  return (
    <View style={[styles.ticket, { backgroundColor: color.cream, borderColor: color.creamHairline, shadowColor: color.shadow }]} accessibilityLabel={`${C.eyebrow}: ${known ? `${amount} ${symbol}` : "hidden"}`}>
      <View style={[styles.top, { backgroundColor: color.accent }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.brand}>
            <AgariMark width={18} height={18} figure={ink} />
            <Text style={[TYPE.bodyStrong, { color: ink }]}>{C.brand}</Text>
          </View>
          <View style={[styles.pill, { borderColor: known ? color.accent : color.creamHairline }]}>
            <View style={[styles.dot, { backgroundColor: known ? color.accent : color.creamHairline }]} />
            <Text style={[styles.pillText, { color: ink }]}>{done ? C.claimed : known ? C.settled : C.waiting}</Text>
          </View>
        </View>
        <Text style={[styles.eyebrow, { color: ink }]}>{C.eyebrow}</Text>
        <View style={styles.figure}>
          <Text style={[TYPE.dataHero, styles.amount, { color: known ? ink : color.creamHairline }]} adjustsFontSizeToFit numberOfLines={1}>
            {known ? `${amount} ${symbol}` : `${symbol} ${C.masked}`}
          </Text>
          <Text style={[TYPE.stamp, styles.word, { color: color.accent }]}>{done ? C.sent : C.waitingWord}</Text>
        </View>
        <Text style={[TYPE.caption, { color: ink }]}>{done ? C.paid : handle ? C.waitingFor(handle) : C.reveal}</Text>
        <View style={[styles.hr, { borderColor: color.creamHairline }]} />
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {BARS.map((w, i) => (
            <View key={i} style={{ width: w, height: 28, backgroundColor: ink }} />
          ))}
        </View>
        <View style={styles.foot}>
          <Text style={[styles.fine, { color: ink }]}>{C.footer}</Text>
          <Text style={[styles.fine, { color: ink }]}>{C.network}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  top: { height: 4 },
  body: { padding: 18, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, height: 24 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6, opacity: 0.7 },
  figure: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  amount: { flexShrink: 1 },
  word: { fontSize: 22 },
  hr: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 4 },
  bars: { flexDirection: "row", gap: 2, overflow: "hidden" },
  foot: { flexDirection: "row", justifyContent: "space-between" },
  fine: { fontFamily: FONT.data, fontSize: 10, opacity: 0.7 },
});
