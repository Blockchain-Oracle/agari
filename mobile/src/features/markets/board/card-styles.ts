import { StyleSheet } from "react-native";
import { FONT } from "~/theme";
import { SERIF_MEDIUM } from "~/theme/web/markets-lanes";

/**
 * The market card's blocks as web computes them on a phone (yosuku part-06 `.market-card` / `.mc-*`, part-16's price
 * bar and strip, their ≤720 px overrides): shared by the live card, the listed and paused slots and the next-Window
 * card, which web draws from the same rules. Colours come from `lanesTokens`.
 */
export const card = StyleSheet.create({
  article: { borderWidth: 1, borderRadius: 4, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  asset: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  ticker: { fontFamily: FONT.bodyHeavy, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.28 },
  cadence: { fontFamily: SERIF_MEDIUM, fontSize: 15, lineHeight: 15, letterSpacing: 0.075, fontStyle: "italic" },
  kind: { marginLeft: 6, paddingVertical: 1, paddingHorizontal: 7, borderWidth: 1, borderRadius: 9999, fontFamily: FONT.data, fontSize: 9.5, lineHeight: 15.2, letterSpacing: 0.57, textTransform: "uppercase" },
  countdown: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  countdownText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, letterSpacing: -0.24, fontVariant: ["tabular-nums"] },
  clockDot: { width: 5, height: 5, borderRadius: 2.5 },
  body: { flexDirection: "column", gap: 10, paddingTop: 13, paddingHorizontal: 14 },
  question: { fontFamily: FONT.headingSemi, fontSize: 15, lineHeight: 18.75, letterSpacing: -0.3 },
  strikeLoading: { letterSpacing: 2.25, opacity: 0.55 },
  strikeDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 4, transform: [{ translateY: -3 }] },
  pricebar: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 10, marginBottom: 8 },
  px: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  big: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 28.8, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  chg: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, fontVariant: ["tabular-nums"] },
  spark: { height: 70, borderRadius: 3, overflow: "hidden" },
  strip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  stripText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.72, textTransform: "uppercase" },
  ramp: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { width: 72, height: 3, borderRadius: 999, overflow: "hidden" },
  pct: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  foot: { flexDirection: "row", gap: 8, margin: 12, paddingTop: 12, borderTopWidth: 1 },
  side: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  sideLabel: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.96, textTransform: "uppercase" },
  sidePrice: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: -0.24, opacity: 0.82 },
  room: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 12, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  roomLabel: { fontFamily: FONT.dataStrong, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.05, textTransform: "uppercase" },
  roomHint: { marginLeft: "auto", opacity: 0.5, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08, textTransform: "uppercase" },
  pending: { minHeight: 200, alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 32, paddingHorizontal: 22 },
  pendingCopy: { maxWidth: 246, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
  pendingStrong: { fontFamily: FONT.bodyStrong },
  lists: { marginHorizontal: 22, marginBottom: 18, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, textAlign: "center" },
  pressed: { opacity: 0.86 },
});
