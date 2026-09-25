import { StyleSheet, Text, View } from "react-native";
import { CLAIM } from "@/features/x/copy";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

const BARS = Array.from({ length: 46 }, (_, i) => 2 + ((i * 7 + 3) % 5));
const C = CLAIM.card;

/**
 * web features/x/ClaimReceiptCard.tsx in x-card.css's `.xr`: the Trading Balance as a cream ticket fixed in both themes —
 * a 6 px vermilion top, the brand and the state pill, the masked or known figure, the barcode and the footer.
 */
export function ClaimTicket({ amount, handle, done, symbol }: { amount: string | null; handle: string | null; done: boolean; symbol: string }) {
  const t = activityTokens(useTheme().name);
  const known = amount !== null;
  return (
    <View style={[styles.xr, { backgroundColor: t.xrPaper, shadowColor: t.xrShadow }]} accessibilityLabel={`${C.eyebrow}: ${known ? `${amount} ${symbol}` : C.reveal}`}>
      <View style={[styles.top, { backgroundColor: t.xrV }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.brand}>
            <AgariMark width={22} height={22} figure={t.xrInk} />
            <Text style={[styles.brandText, { color: t.xrInk }]}>{C.brand}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: known ? t.xrPillKnown : t.xrPill }]}>
            <View style={[styles.pillDot, { backgroundColor: known ? t.xrGreen : t.xrFaint }]} />
            <Text style={[styles.pillText, { color: known ? t.xrGreen : t.xrFaint }]}>{done ? C.claimed : known ? C.settled : C.waiting}</Text>
          </View>
        </View>
        <Text style={[styles.eyebrow, { color: t.xrFaint }]}>{C.eyebrow}</Text>
        <View style={styles.figure}>
          <Text style={[styles.amount, { color: known ? t.xrGreen : t.xrInk }]}>{known ? `${amount} ${symbol}` : `${symbol} ${C.masked}`}</Text>
          <Text style={[styles.word, { color: t.xrMute }]}>{done ? C.sent : C.waitingWord}</Text>
        </View>
        <Text style={[styles.sub, { color: t.xrMute }]}>{done ? C.paid : handle ? C.waitingFor(handle) : C.reveal}</Text>
        <View style={[styles.hr, { backgroundColor: t.xrHr }]} />
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {BARS.map((w, i) => (
            <View key={i} style={[styles.bar, { width: w, backgroundColor: t.xrInk }]} />
          ))}
        </View>
        <View style={styles.foot}>
          <Text style={[styles.fine, { color: t.xrFaint }]}>{C.footer}</Text>
          <Text style={[styles.fine, { color: t.xrFaint }]}>{C.network}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  xr: { borderRadius: 22, shadowOpacity: 0.55, shadowRadius: 40, shadowOffset: { width: 0, height: 34 }, elevation: 10 },
  top: { position: "absolute", top: 0, left: 0, right: 0, height: 6, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  body: { paddingTop: 30, paddingHorizontal: 30, paddingBottom: 24 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandText: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28.8, letterSpacing: -0.3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88, textTransform: "uppercase" },
  eyebrow: { marginTop: 32, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, letterSpacing: 2.64, textTransform: "uppercase" },
  figure: { marginTop: 6, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 10 },
  amount: { fontFamily: FONT.headingHeavy, fontSize: 48.24, lineHeight: 48.24, letterSpacing: -1.45 },
  word: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 32 },
  sub: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  hr: { height: 1, marginTop: 26, marginBottom: 18 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 42, overflow: "hidden" },
  bar: { height: "100%", opacity: 0.8 },
  foot: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  fine: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
