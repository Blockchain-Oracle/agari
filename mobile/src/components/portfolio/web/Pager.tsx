import { Pressable, StyleSheet, Text, View } from "react-native";
import { PAGER } from "@/lib/copy";
import type { PagerState } from "@/lib/use-pager";
import { FONT, useTheme } from "~/theme";

/** web `components/chrome/Pager` in history.css's `.pager`: Prev · "1–8 of 23" · Next in 10 px mono caps; nothing while the list fits. */
export function Pager<T>({ pager }: { pager: PagerState<T> }) {
  const { color } = useTheme();
  if (pager.total <= pager.pageSize) return null;
  const button = (label: string, on: boolean, press: () => void) => (
    <Pressable onPress={press} disabled={!on} accessibilityRole="button" accessibilityState={{ disabled: !on }} hitSlop={10}>
      <Text style={[styles.text, { color: color.accent, opacity: on ? 1 : 0.35 }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.pager, { borderTopColor: color.hairline }]} accessibilityLabel={PAGER.aria}>
      {button(PAGER.prev, pager.canPrev, pager.prev)}
      <Text style={[styles.text, styles.range, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
        {PAGER.range(pager.from, pager.to, pager.total)}
      </Text>
      {button(PAGER.next, pager.canNext, pager.next)}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1 },
  text: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  range: { fontVariant: ["tabular-nums"] },
});
