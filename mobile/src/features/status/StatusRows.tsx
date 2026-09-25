import { CircleCheckBig, TriangleAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { STATUS } from "@/features/status/copy";
import { lagTone, type LagTone, type StatusPayload, type StatusPipeline } from "@/features/status/protocol";
import { FONT, useTheme, type Palette } from "~/theme";
import { statusTokens, type StatusTokens } from "~/theme/web/explore/status";

/** status.css `.status-dot[data-tone]`: profit, amber, loss, and gray-600 for closed or not set up. */
function dotInk(tone: LagTone, color: Palette, t: StatusTokens): string {
  if (tone === "warn") return t.amber;
  if (tone === "bad") return color.loss;
  if (tone === "off") return color.inkDisabled;
  return color.profit;
}

/** web StatusRows.tsx `StatusBanner`: the verdict, the worst lag, and the chain head. */
export function StatusBanner({ payload }: { payload: StatusPayload }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  const healthy = payload.overall === "healthy";
  const ink = healthy ? color.profit : t.amber;
  const Icon = healthy ? CircleCheckBig : TriangleAlert;
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: healthy ? t.profitBannerFill : t.amberBannerFill, borderColor: healthy ? t.profitBannerBorder : t.amberBorder },
      ]}
    >
      <Icon size={24} color={ink} />
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: ink }]} accessibilityRole="header">
          {healthy ? STATUS.healthy : STATUS.degraded}
        </Text>
        <Text style={[styles.bannerSub, { color: color.inkMuted }]}>
          {payload.maxLagSec !== null && payload.maxLagPipeline ? STATUS.maxLag(payload.maxLagSec, payload.maxLagPipeline) : STATUS.noLag}
        </Text>
      </View>
      <View style={styles.checkpoint}>
        <Text style={[styles.mono9, { color: color.inkDisabled }]}>{STATUS.checkpoint}</Text>
        <Text style={[styles.checkpointValue, { color: color.ink }]}>{payload.slot === null ? STATUS.noSlot : payload.slot.toLocaleString("en-US")}</Text>
      </View>
    </View>
  );
}

function PipelineRow({ pipeline, sessionLabel, first }: { pipeline: StatusPipeline; sessionLabel: string | null; first: boolean }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  const notConfigured = pipeline.optional && !pipeline.configured;
  const figure = pipeline.lagSec !== null ? STATUS.lag(pipeline.lagSec) : pipeline.latencyMs !== null ? STATUS.latency(pipeline.latencyMs) : "—";
  const chips = [notConfigured ? STATUS.optional : null, pipeline.expected ? STATUS.expected(sessionLabel) : null].filter((c): c is string => c !== null);
  return (
    <View style={[styles.row, first ? null : { borderTopWidth: 1, borderTopColor: t.rule }]} accessible accessibilityLabel={`${pipeline.label}, ${figure}. ${pipeline.detail}`}>
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: dotInk(lagTone(pipeline), color, t) }]} />
        <Text style={[styles.label, { color: color.ink }]} numberOfLines={1}>
          {pipeline.label}
        </Text>
        <Text style={[styles.lag, { color: color.inkMuted }]}>{figure}</Text>
      </View>
      <Text style={[styles.detail, { color: color.inkDisabled }]}>{pipeline.detail}</Text>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={[styles.chip, { backgroundColor: t.amberWash, borderColor: t.amberBorder }]}>
              <Text style={[styles.chipText, { color: t.amber }]}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** web StatusRows.tsx `StatusTable`: one row per dependency; on a phone the detail drops under the label (status.css ≤640). */
export function StatusTable({ pipelines, sessionLabel }: { pipelines: StatusPipeline[]; sessionLabel: string | null }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  return (
    <View style={[styles.table, { backgroundColor: color.ground, borderColor: t.hairline }]}>
      <View style={[styles.tableHead, { borderBottomColor: t.rule }]}>
        <Text style={[styles.mono9, { color: color.inkDisabled }]} accessibilityRole="header">
          {STATUS.tableTitle(pipelines.length)}
        </Text>
      </View>
      {pipelines.map((pipeline, i) => (
        <PipelineRow key={pipeline.id} pipeline={pipeline} sessionLabel={sessionLabel} first={i === 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, borderRadius: 12, borderWidth: 1 },
  bannerText: { flex: 1 },
  bannerTitle: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
  bannerSub: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, marginTop: 2 },
  checkpoint: { alignItems: "flex-end" },
  mono9: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  checkpointValue: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  table: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  tableHead: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  row: { paddingVertical: 12, paddingHorizontal: 20, gap: 4 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 9999 },
  label: { flex: 1, minWidth: 0, fontFamily: FONT.bodyMedium, fontSize: 12, lineHeight: 19.2 },
  lag: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  detail: { paddingLeft: 20, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  chip: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1 },
  chipText: { fontFamily: FONT.body, fontSize: 9, lineHeight: 14.4 },
});
