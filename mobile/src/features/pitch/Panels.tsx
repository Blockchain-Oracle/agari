import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT } from "~/theme";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";
import { Dots, Mono, Rise, Rule } from "./Folio";

/** web pitch/primitives.tsx's panels — SpecPanel, Glance, StatCard, PhaseCard — as pitch.css stacks them under 900 px. */
export type SpecRow = readonly [string, ReactNode, boolean?];

/** The receipt stub: a titled rule with the vermilion eyelet, then key · dotted leader · value rows. */
export function SpecPanel({ title, badge, badgeTone = "live", rows, i = 1 }: { title: string; badge?: string; badgeTone?: "live" | "verm"; rows: readonly SpecRow[]; i?: number }) {
  return (
    <Rise i={i} style={styles.full}>
      <View style={styles.specHead}>
        <Mono style={{ color: PP.ink }}>{title}</Mono>
        {badge ? (
          <Mono tone={badgeTone} size={10}>
            {badge}
          </Mono>
        ) : null}
      </View>
      <Rule />
      <View style={styles.specRows}>
        {rows.map(([key, value, hl], index) => (
          <View key={index} style={styles.specRow}>
            <Text style={styles.specKey}>{key}</Text>
            <Dots style={styles.leader} />
            {typeof value === "string" ? <Text style={[styles.specVal, hl && { color: PP.green }]}>{value}</Text> : value}
          </View>
        ))}
      </View>
    </Rise>
  );
}

/** The cover's facts: bold Sora values against faint mono keys, hairline between rows. */
export function Glance({ title, badge, rows, i = 1 }: { title: string; badge: string; rows: readonly SpecRow[]; i?: number }) {
  return (
    <Rise i={i} style={styles.full}>
      <View style={styles.glanceHead}>
        <Mono size={11} style={{ color: PP.ink }}>
          {title}
        </Mono>
        <Mono tone="live">{badge}</Mono>
      </View>
      <Rule />
      {rows.map(([key, value, hl], index) => (
        <View key={index} style={[styles.glanceRow, index < rows.length - 1 && styles.glanceRule]}>
          <Mono tone="faint" size={11.5}>
            {key}
          </Mono>
          {typeof value === "string" ? <Text style={[styles.glanceVal, hl && { color: PP.green }]}>{value}</Text> : value}
        </View>
      ))}
    </Rise>
  );
}

export function GlanceVal({ children }: { children: ReactNode }) {
  return <Text style={styles.glanceVal}>{children}</Text>;
}

/** A large Sora figure, a dotted ink rule, its mono label and where it came from. */
export function StatCard({ value, label, source, hl, i = 1 }: { value: ReactNode; label: string; source?: string; hl?: boolean; i?: number }) {
  return (
    <Rise i={i}>
      <Text style={[styles.statValue, hl && { color: PP.green }]}>{value}</Text>
      <Dots ink style={styles.statDots} />
      <Text style={styles.statLabel}>{label}</Text>
      {source ? <Text style={styles.statSource}>{source}</Text> : null}
    </Rise>
  );
}

/** The holding word in a StatCard while the venue reads. */
export function StatHolding({ children }: { children: ReactNode }) {
  return <Text style={styles.statHolding}>{children}</Text>;
}

/** now / next / then: a card with a 3 px left rule, green on the live phase. */
export function PhaseCard({ tag, title, body, tone = "ink", i = 1 }: { tag: string; title: string; body: string; tone?: "ink" | "live"; i?: number }) {
  return (
    <Rise i={i} style={[styles.phase, { borderLeftColor: tone === "live" ? PP.green : PP.ink }]}>
      <Mono tone={tone === "live" ? "live" : "verm"} size={10}>
        {tag}
      </Mono>
      <Text style={styles.phaseTitle}>{title}</Text>
      <Text style={styles.phaseBody}>{body}</Text>
    </Rise>
  );
}

const styles = StyleSheet.create({
  full: { width: "100%" },
  specHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  specRows: { marginTop: 3 },
  specRow: { flexDirection: "row", alignItems: "flex-end", paddingVertical: 10 },
  specKey: { fontFamily: FONT.dataRegular, fontSize: 12.5, lineHeight: 20, letterSpacing: 0.625, textTransform: "uppercase", color: PP.mute },
  leader: { flex: 1, marginHorizontal: 12, marginBottom: 6, minWidth: 12 },
  specVal: { fontFamily: FONT.dataRegular, fontSize: 15, lineHeight: 24, color: PP.ink, textAlign: "right", flexShrink: 1 },
  glanceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 11 },
  glanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24, paddingVertical: 11, minHeight: 42 },
  glanceRule: { borderBottomWidth: 1, borderBottomColor: PP.hair },
  glanceVal: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 24.2, letterSpacing: -0.33, color: PP.ink, textAlign: "right", flexShrink: 1 },
  statValue: { fontFamily: FONT.headingHeavy, fontSize: 28.5, lineHeight: 25.65, letterSpacing: -1, color: PP.ink, paddingTop: 3 },
  statHolding: { fontFamily: FONT.dataRegular, fontSize: 14, letterSpacing: 0, color: PP.mute },
  statDots: { width: "46%", marginTop: 14, marginBottom: 12 },
  statLabel: { fontFamily: FONT.dataRegular, fontSize: 13.5, lineHeight: 20.25, letterSpacing: 1.215, textTransform: "uppercase", color: PP.body },
  statSource: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18, letterSpacing: 0.48, color: PP.mute },
  phase: { backgroundColor: PP.card, borderWidth: 1, borderColor: PP.hair, borderLeftWidth: 3, borderRadius: 8, paddingVertical: 18, paddingHorizontal: 20 },
  phaseTitle: { marginTop: 8, fontFamily: FONT.heading, fontSize: 21, lineHeight: 27, letterSpacing: -0.21, color: PP.ink },
  phaseBody: { marginTop: 8, fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 21, color: PP.body },
});
