import { formatCadence } from "@agari/core/copy";
import { formatClock } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import type { AgentPreviewResponse } from "@/features/strategies/protocol";
import type { DryRead } from "@/features/strategies/useDryRead";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";

const DRY = STRATEGIES.studio.agent.dry;

const cents = (value: number | null) => (value === null ? DRY.unquoted : `${value}¢`);

function Stat({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.data, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** What one dry read saw and said: the Window, the print and books, the call, the gate's ruling, the model. */
function Result({ result }: { result: AgentPreviewResponse }) {
  const { color } = useTheme();
  const { market, read, verdict, failure, gate, model } = result;
  return (
    <>
      <View style={styles.window}>
        <AssetDisc asset={market.asset} size={24} />
        <Text style={[TYPE.data, styles.flex, { color: color.ink }]}>
          {DRY.window(market.asset, formatCadence(market.intervalSec))}
          <Text style={{ color: color.inkMuted }}>
            {" · "}
            {DRY.elapsed(formatClock(market.elapsedSec), formatClock(market.leftSec))}
            {market.inSlot ? "" : ` · ${DRY.outsideSlot}`}
          </Text>
        </Text>
      </View>
      <View style={styles.grid}>
        <Stat label={DRY.print} value={read.openingText} />
        <Stat label="EMA" value={DRY.move(read.moveBps)} />
        <Stat label={DRY.books} value={`${cents(read.upCents)} · ${cents(read.downCents)}`} />
      </View>
      <View style={[styles.section, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{DRY.said}</Text>
        {verdict ? (
          <>
            <Text style={[TYPE.data, { color: color.ink }]}>{DRY.call(verdict.side, verdict.confidence)}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>“{verdict.why}”</Text>
          </>
        ) : (
          <Text style={[TYPE.data, { color: color.inkMuted }]}>{DRY.noAnswer(failure ?? "")}</Text>
        )}
      </View>
      <View style={[styles.section, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{DRY.gate}</Text>
        <Text style={[TYPE.data, { color: gate.side ? color.accent : color.inkSecondary }]}>{gate.side ? DRY.gateTrade(gate.side) : DRY.gateHold}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{gate.reason}</Text>
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
        {DRY.model(model)}
      </Text>
    </>
  );
}

/** web's features/strategies/DryReadPanel.tsx. */
export function DryReadPanel({ state }: { state: DryRead }) {
  const { color } = useTheme();
  if (state.status === "idle") return null;
  return (
    <View style={[styles.box, { borderColor: color.accentDim, backgroundColor: color.surface1 }]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{DRY.eyebrow}</Text>
        {state.status === "reading" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DRY.reading}</Text> : null}
      </View>
      {state.status === "error" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{state.error}</Text> : null}
      {state.status === "ok" ? <Result result={state.result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between" },
  window: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  grid: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 4 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
});
