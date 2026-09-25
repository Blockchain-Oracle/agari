import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ReadoutCells } from "@/features/markets/ticket/ReadoutStrip";
import { TICKET } from "@/lib/copy";
import { FONT } from "~/theme";
import { tkType, useTk } from "./tk";

/** One `.tk-readout-cell`: the tiny mono label over the 13 px figure; the first sits flush left, the rest ruled. */
export function ReadoutCell({ label, children, index, accent = false }: { label: string; children: ReactNode; index: number; accent?: boolean }) {
  const tk = useTk();
  return (
    <View style={[styles.cell, index === 0 ? styles.first : [styles.ruled, { borderLeftColor: tk.cellRule }], index === 2 && styles.last]}>
      <Text style={[styles.label, { color: tk.readLabel }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color: accent ? tk.vermilion : tk.readValue }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** The three divided columns; the rule under them turns vermilion while a live quote is on screen. */
export function ReadoutRow({ live, children }: { live: boolean; children: ReactNode }) {
  const tk = useTk();
  return <View style={[styles.row, { borderBottomColor: live ? tk.liveRule : tk.rule }]}>{children}</View>;
}

/**
 * web's ReadoutStrip: Current cost · Return · Max loss, the caption line under them (where the number comes from, or
 * why there is none, with the chance on the right), and the one sentence when leverage or a lane guard applies.
 */
export function ReadoutStrip({ cells, live, caption, chance, note = null }: { cells: ReadoutCells; live: boolean; caption: string; chance: string | null; note?: string | null }) {
  const tk = useTk();
  return (
    <>
      <ReadoutRow live={live}>
        <ReadoutCell index={0} label={TICKET.currentCost}>
          {cells.cost ?? "—"}
        </ReadoutCell>
        <ReadoutCell index={1} label={TICKET.ret} accent={cells.ret !== null}>
          {cells.ret ?? "—"}
        </ReadoutCell>
        <ReadoutCell index={2} label={TICKET.maxLoss}>
          {cells.loss ?? "—"}
        </ReadoutCell>
      </ReadoutRow>
      <View style={styles.caption}>
        <Text style={[tkType.caption, styles.grow, { color: tk.caption }]}>{caption}</Text>
        {chance ? <Text style={[tkType.caption, { color: tk.chance }]}>{chance}</Text> : null}
      </View>
      {note ? <Text style={[tkType.caption, styles.note, { color: tk.caption }]}>{note}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1 },
  cell: { flex: 1, minWidth: 0, padding: 10 },
  first: { paddingLeft: 0 },
  last: { paddingRight: 0 },
  ruled: { borderLeftWidth: 1 },
  label: { fontFamily: FONT.dataRegular, fontSize: 7.5, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 4 },
  value: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  caption: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, minHeight: 28, marginTop: -4 },
  grow: { flex: 1 },
  note: { marginTop: -8 },
});
