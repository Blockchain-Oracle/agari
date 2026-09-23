import type { PagerState } from "@/lib/use-pager";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

export type Verdict = "won" | "lost" | "live" | "tied" | "neutral";

/** A history section's opening (web's `du-head`): the eyebrow, the title with its accent period, an aside. */
export function HistoryHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.head}>
      <View style={styles.headText}>
        <Text style={[styles.eyebrow, { color: color.accent }]}>{eyebrow.toUpperCase()}</Text>
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
          {title}
          <Text style={{ color: color.accent }}>.</Text>
        </Text>
      </View>
      {aside}
    </View>
  );
}

/**
 * web's `du-history-row`: the verdict word in its colour, the main line and its detail, and the right-hand
 * figure over the time. `onPress` makes the row one touch target.
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
  const { color } = useTheme();
  const ink = verdict === "won" ? color.profit : verdict === "lost" ? color.loss : verdict === "live" ? color.accent : color.inkMuted;
  const body = (
    <>
      <View style={[styles.verdict, { borderColor: ink }]}>
        <Text style={[styles.verdictText, { color: ink }]} numberOfLines={1}>
          {word.toUpperCase()}
        </Text>
      </View>
      <View style={styles.main}>
        <Text style={[TYPE.data, { color: color.ink }]} numberOfLines={1}>
          {main}
        </Text>
        <Text style={[styles.detail, { color: color.inkMuted }]}>{detail}</Text>
      </View>
      <View style={styles.side}>
        {typeof value === "string" ? (
          <Text style={[TYPE.data, { color: valueTone === "profit" ? color.profit : valueTone === "loss" ? color.loss : color.ink }]} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          value
        )}
        <Text style={[styles.detail, { color: color.inkMuted }]}>{time}</Text>
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}>
      {body}
    </Pressable>
  );
}

/** web's `Pager`: "1–8 of 23" between previous and next. */
export function HistoryPager<T>({ pager }: { pager: PagerState<T> }) {
  const { color } = useTheme();
  if (pager.pageCount <= 1) return null;
  return (
    <View style={styles.pager}>
      <Button label="Previous" variant="outline" size="sm" block={false} disabled={!pager.canPrev} onPress={pager.prev} />
      <Text style={[TYPE.data, { color: color.inkMuted }]}>
        {pager.from}–{pager.to} of {pager.total}
      </Text>
      <Button label="Next" variant="outline" size="sm" block={false} disabled={!pager.canNext} onPress={pager.next} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  headText: { flex: 1, gap: 4 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  verdict: { width: 74, borderWidth: 1, borderRadius: RADIUS.full, paddingVertical: 3, alignItems: "center" },
  verdictText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 0.6 },
  main: { flex: 1, gap: 2 },
  detail: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 16 },
  side: { alignItems: "flex-end", gap: 2, maxWidth: 120 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
