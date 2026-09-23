import { StyleSheet, Text, View } from "react-native";
import type { ReadoutCells } from "@/features/markets/ticket/ReadoutStrip";
import { TICKET } from "@/lib/copy";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's ReadoutStrip: Current cost · Return · Max loss, the caption beneath, the chance with a live quote. */
export function ReadoutStrip({ cells, live, caption, chance }: { cells: ReadoutCells; live: boolean; caption: string; chance: string | null }) {
  const { color } = useTheme();
  const cell = (label: string, value: string | null, accent = false) => (
    <View style={styles.cell} key={label}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.dataLg, { color: accent && value ? color.profit : color.ink }]}>{value ?? "—"}</Text>
    </View>
  );
  return (
    <View style={styles.wrap}>
      <View style={[styles.strip, { backgroundColor: color.surface1, borderColor: live ? color.accentDim : color.hairline }]}>
        {cell(TICKET.currentCost, cells.cost)}
        <View style={[styles.rule, { backgroundColor: color.hairline }]} />
        {cell(TICKET.ret, cells.ret, true)}
        <View style={[styles.rule, { backgroundColor: color.hairline }]} />
        {cell(TICKET.maxLoss, cells.loss)}
      </View>
      <View style={styles.captionRow}>
        <Text style={[TYPE.caption, styles.caption, { color: color.inkSecondary }]}>{caption}</Text>
        {chance ? <Text style={[TYPE.data, { color: color.ink }]}>{chance}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  strip: { flexDirection: "row", borderRadius: RADIUS.lg, borderWidth: 1, paddingVertical: 12 },
  cell: { flex: 1, alignItems: "center", gap: 4 },
  rule: { width: StyleSheet.hairlineWidth },
  captionRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  caption: { flexShrink: 1 },
});
