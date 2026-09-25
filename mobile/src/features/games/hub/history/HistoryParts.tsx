import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PAGER } from "@/lib/copy";
import type { PagerState } from "@/lib/use-pager";
import { FONT } from "~/theme";
import { useDuelTokens } from "../../duel/parts";

export type Verdict = "won" | "lost" | "live" | "tied" | "neutral";

/**
 * duel.css `.du-history-row`: the verdict word (mono 10, its side's colour) in a 52 px column, the main line over
 * its detail, and the right-hand figure over the time; one touch target when it opens something.
 */
export function HistoryRow({ verdict, word, main, detail, value, valueTone, time, onPress, label }: {
  verdict: Verdict;
  word: string;
  main: string;
  detail: string;
  value: ReactNode;
  valueTone?: "profit" | "loss";
  time: string;
  onPress?: () => void;
  label: string;
}) {
  const { color } = useDuelTokens();
  const ink = verdict === "won" ? color.profit : verdict === "lost" ? color.loss : verdict === "live" ? color.accent : color.inkMuted;
  const body = (
    <>
      <Text style={[styles.verdict, { color: ink }]} numberOfLines={1}>
        {word.toUpperCase()}
      </Text>
      <View style={styles.main}>
        <Text style={[styles.v, { color: color.ink }]} numberOfLines={1}>
          {main}
        </Text>
        <Text style={[styles.k, { color: color.inkMuted }]}>{detail.toUpperCase()}</Text>
      </View>
      <View style={styles.side}>
        {typeof value === "string" ? (
          <Text style={[styles.v, { color: valueTone === "profit" ? color.profit : valueTone === "loss" ? color.loss : color.ink }]} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          value
        )}
        <Text style={[styles.k, { color: color.inkMuted }]}>{time.toUpperCase()}</Text>
      </View>
    </>
  );
  const style = [styles.row, { borderColor: color.hairline, backgroundColor: color.surface1 }];
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => [style, pressed && { borderColor: color.accent, transform: [{ scale: 0.97 }] }]}>
      {body}
    </Pressable>
  );
}

/** web's `Pager` under a paged list (`.pager` as `.du-pager`): "← Prev", "1–8 of 23", "Next →" in mono caps; nothing while one page fits. */
export function HistoryPager<T>({ pager }: { pager: PagerState<T> }) {
  const { color } = useDuelTokens();
  if (pager.total <= pager.pageSize) return null;
  const button = (label: string, onPress: () => void, enabled: boolean) => (
    <Pressable onPress={onPress} disabled={!enabled} accessibilityRole="button" hitSlop={10} style={!enabled && styles.off}>
      <Text style={[styles.pager, { color: color.accent }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
  return (
    <View style={styles.pagerRow} accessibilityLabel={PAGER.aria}>
      {button(PAGER.prev, pager.prev, pager.canPrev)}
      <Text style={[styles.pager, styles.range, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
        {PAGER.range(pager.from, pager.to, pager.total).toUpperCase()}
      </Text>
      {button(PAGER.next, pager.next, pager.canNext)}
    </View>
  );
}

export const historyStyles = StyleSheet.create({
  list: { gap: 8 },
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  verdict: { minWidth: 52, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  side: { alignItems: "flex-end", gap: 2 },
  v: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  k: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  pagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, marginTop: 8 },
  pager: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4 },
  range: { fontVariant: ["tabular-nums"] },
  off: { opacity: 0.35 },
});
