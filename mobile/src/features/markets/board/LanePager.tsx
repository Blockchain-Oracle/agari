import { Pressable, StyleSheet, Text, View } from "react-native";
import { PAGER } from "@/lib/copy";
import type { PagerState } from "@/lib/use-pager";
import { FONT, useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";

/**
 * web's components/chrome Pager under a lane (`nav.pager`): "← Prev", "1–8 of 9" in mono caps, "Next →" — the two
 * buttons in vermilion and their own case, a spent one at 35 %; nothing while the lane fits on one page.
 */
export function LanePager<T>({ pager }: { pager: PagerState<T> }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  if (pager.total <= pager.pageSize) return null;
  const button = (label: string, on: boolean, press: () => void) => (
    <Pressable onPress={press} disabled={!on} accessibilityRole="button" accessibilityState={{ disabled: !on }} hitSlop={10}>
      <Text style={[styles.text, { color: t.vermilion, opacity: on ? 1 : 0.35 }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.pager, { borderTopColor: t.pagerRule }]} accessibilityLabel={PAGER.aria}>
      {button(PAGER.prev, pager.canPrev, pager.prev)}
      <Text style={[styles.text, styles.range, { color: t.inkMuted }]} accessibilityLiveRegion="polite">
        {PAGER.range(pager.from, pager.to, pager.total)}
      </Text>
      {button(PAGER.next, pager.canNext, pager.next)}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1 },
  text: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4 },
  range: { textTransform: "uppercase", fontVariant: ["tabular-nums"] },
});
