import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STATUS } from "@/features/status/copy";
import { lagTone, type LagTone, type StatusPayload, type StatusPipeline } from "@/features/status/protocol";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme, type Palette } from "~/theme";
import type { Check } from "./history";

/** web status.css `data-tone`: green, amber, red, and grey for closed or not set up. */
export function toneInk(tone: LagTone, color: Palette): string {
  if (tone === "good") return color.profit;
  if (tone === "warn") return color.warning;
  if (tone === "bad") return color.loss;
  return color.inkMuted;
}

const overallTone = (overall: Check["overall"]): LagTone => (overall === "healthy" ? "good" : overall === "degraded" ? "warn" : "bad");

// 21st: openstatusHQ/status-bar — a timeline of colour-coded bars, one per check, newest on the right.
/** The checks this screen has seen, as bars; `pick` reads one pipeline's tone at each check instead of the verdict. */
export function CheckStrip({ checks, pick, height = 22 }: { checks: readonly Check[]; pick?: (check: Check) => LagTone | undefined; height?: number }) {
  const { color } = useTheme();
  return (
    <View style={[styles.strip, { height }]} accessible={false}>
      {checks.map((check) => {
        const tone = pick ? pick(check) : overallTone(check.overall);
        return <View key={check.atMs} style={[styles.bar, { backgroundColor: tone ? toneInk(tone, color) : color.surface2 }]} />;
      })}
    </View>
  );
}

/** web StatusRows.tsx `StatusBanner`: the verdict, the worst lag, and the chain head ("Slot"), plus this visit's strip. */
export function StatusBanner({ payload, checks }: { payload: StatusPayload; checks: readonly Check[] }) {
  const { color } = useTheme();
  const healthy = payload.overall === "healthy";
  const ink = healthy ? color.profit : color.warning;
  return (
    <View style={[styles.banner, { backgroundColor: healthy ? color.profitWash : color.surface1, borderColor: ink }]}>
      <View style={styles.bannerRow}>
        <SymbolView
          name={healthy ? { ios: "checkmark.circle.fill", android: "check_circle" } : { ios: "exclamationmark.triangle.fill", android: "warning" }}
          size={26}
          tintColor={ink}
        />
        <View style={styles.bannerText}>
          <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
            {healthy ? STATUS.healthy : STATUS.degraded}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {payload.maxLagSec !== null && payload.maxLagPipeline ? STATUS.maxLag(payload.maxLagSec, payload.maxLagPipeline) : STATUS.noLag}
          </Text>
        </View>
      </View>
      <View style={[styles.slot, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{STATUS.checkpoint}</Text>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{payload.slot === null ? STATUS.noSlot : payload.slot.toLocaleString("en-US")}</Text>
      </View>
      <View style={styles.visit}>
        <CheckStrip checks={checks} />
        <Text style={[TYPE.caption, styles.small, { color: color.inkMuted }]}>
          {checks.length === 1 ? "1 check since you opened this screen" : `${checks.length} checks since you opened this screen`}
        </Text>
      </View>
    </View>
  );
}

/** web StatusRows.tsx `PipelineRow`: the tone dot, the label, lag or latency, the detail and its chips; tap for all of it. */
export function PipelineRow({ pipeline, sessionLabel, checks }: { pipeline: StatusPipeline; sessionLabel: string | null; checks: readonly Check[] }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const tone = lagTone(pipeline);
  const notConfigured = pipeline.optional && !pipeline.configured;
  const figure = pipeline.lagSec !== null ? STATUS.lag(pipeline.lagSec) : pipeline.latencyMs !== null ? STATUS.latency(pipeline.latencyMs) : "—";
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        setOpen((v) => !v);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${pipeline.label}, ${tone}, ${figure}. ${pipeline.detail}`}
      style={[styles.row, { borderBottomColor: color.hairline }]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: toneInk(tone, color) }]} />
        <Text style={[TYPE.bodyStrong, styles.rowLabel, { color: color.ink }]}>{pipeline.label}</Text>
        <Text style={[TYPE.data, { color: color.inkSecondary }]}>{figure}</Text>
      </View>
      <Text style={[TYPE.data, styles.detail, { color: color.inkMuted }]} numberOfLines={open ? undefined : 2} selectable={open}>
        {pipeline.detail}
      </Text>
      {notConfigured || pipeline.expected ? (
        <View style={styles.chips}>
          {notConfigured ? <Chip text={STATUS.optional} /> : null}
          {pipeline.expected ? <Chip text={STATUS.expected(sessionLabel)} /> : null}
        </View>
      ) : null}
      {checks.length > 1 ? (
        <View style={styles.indent}>
          <CheckStrip checks={checks} pick={(check) => check.tones[pipeline.id]} height={8} />
        </View>
      ) : null}
    </Pressable>
  );
}

function Chip({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: color.surface2 }]}>
      <Text style={[styles.chipText, { color: color.inkSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: 3 },
  bar: { flex: 1, maxWidth: 12, borderRadius: 2 },
  banner: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16, gap: 14 },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerText: { flex: 1, gap: 2 },
  slot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  visit: { gap: 6 },
  small: { fontSize: 11.5 },
  row: { paddingVertical: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  rowLabel: { flex: 1, fontSize: 14 },
  detail: { fontSize: 12, lineHeight: 17, marginLeft: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: 19 },
  indent: { marginLeft: 19 },
  chip: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.4 },
});
