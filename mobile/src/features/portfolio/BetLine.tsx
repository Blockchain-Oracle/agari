import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme } from "~/theme";

export interface Figure {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "accent" | "muted";
}

interface BetLineProps {
  /** "Live", "Settling", "Resting", "Won"… — the state word web puts where the live dot sits. */
  status: string;
  /** The accent dot beside a live row. */
  live?: boolean;
  asset: string | null;
  title: string;
  marketId: string;
  /** Cadence, the seat ("from Trading Balance"), the time left: small words under the title. */
  meta: readonly (string | null | false | undefined)[];
  /** The money, as label/value pairs. */
  figures: readonly Figure[];
  /** Lines of plain words under the figures (a refusal, "stake returns as venue credit"). */
  notes?: readonly (string | null | false | undefined)[];
  action?: ReactNode;
}

/**
 * web's `.bets-row` grammar for a phone: the state word and the asset on top (tapping it opens the Window), the
 * figures as a mono grid under it, the row's one action at the trailing edge — every row in the bets plate shares it.
 */
export function BetLine({ status, live, asset, title, marketId, meta, figures, notes = [], action }: BetLineProps) {
  const { color } = useTheme();
  const tones = { profit: color.profit, loss: color.loss, accent: color.accent, muted: color.inkMuted };
  const metaText = meta.filter(Boolean).join(" · ");
  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]}>
      <Pressable
        onPress={() => router.push({ pathname: "/markets/[id]", params: { id: marketId } })}
        accessibilityRole="link"
        accessibilityLabel={`${status}. ${title}. ${metaText}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        {asset ? <AssetDisc asset={asset} size={32} /> : null}
        <View style={styles.headText}>
          <View style={styles.statusRow}>
            {live ? <View style={[styles.dot, { backgroundColor: color.accent }]} /> : null}
            <Text style={[TYPE.labelMicro, { color: live ? color.inkSecondary : color.ink }]}>{status}</Text>
          </View>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
            {title}
          </Text>
          {metaText ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{metaText}</Text> : null}
        </View>
      </Pressable>
      {figures.length > 0 ? (
        <View style={styles.figures}>
          {figures.map((f) => (
            <View key={f.label} style={styles.figure} accessible accessibilityLabel={`${f.label}: ${f.value}`}>
              <Text style={[styles.figLabel, { color: color.inkMuted }]}>{f.label}</Text>
              <Text style={[styles.figValue, { color: f.tone ? tones[f.tone] : color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {notes.filter(Boolean).map((n) => (
        <Text key={String(n)} style={[TYPE.caption, { color: color.inkSecondary }]}>
          {n}
        </Text>
      ))}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  pressed: { opacity: 0.7 },
  headText: { flex: 1, minWidth: 0, gap: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  figures: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  figure: { width: "50%", paddingRight: 8, gap: 1 },
  figLabel: { fontFamily: FONT.body, fontSize: 11.5 },
  figValue: { fontFamily: FONT.data, fontSize: 14, fontVariant: ["tabular-nums"] },
  action: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
