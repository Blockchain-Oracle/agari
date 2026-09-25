import { formatCadence } from "@agari/core/copy";
import { formatClock } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import type { AgentPreviewResponse } from "@/features/strategies/protocol";
import type { DryRead } from "@/features/strategies/useDryRead";
import { FONT } from "~/theme";
import { ST, useStrat } from "../ui";

const DRY = STRATEGIES.studio.agent.dry;
const cents = (value: number | null) => (value === null ? DRY.unquoted : `${value}¢`);

function Stat({ label, value }: { label: string; value: string }) {
  const { t, color } = useStrat();
  return (
    <View style={styles.stat}>
      <Text style={[ST.micro, styles.mb4, { color: t.ink(0.4) }]}>{label}</Text>
      <Text numberOfLines={1} style={[ST.mono12, { color: color.ink }]}>
        {value}
      </Text>
    </View>
  );
}

function Result({ result }: { result: AgentPreviewResponse }) {
  const { t, color } = useStrat();
  const { market, read, verdict, failure, gate, model } = result;
  const rule = [styles.rule, { borderTopColor: color.hairline }];
  const small = [styles.small, { color: color.inkSecondary }];
  return (
    <>
      <Text style={[ST.mono11, styles.mt8, { color: color.ink }]}>
        {DRY.window(market.asset, formatCadence(market.intervalSec))}
        <Text style={{ color: t.ink(0.4) }}> · {DRY.elapsed(formatClock(market.elapsedSec), formatClock(market.leftSec))}</Text>
        {!market.inSlot ? <Text style={{ color: t.ink(0.4) }}> · {DRY.outsideSlot}</Text> : null}
      </Text>
      <View style={styles.grid}>
        <Stat label={DRY.print} value={read.openingText} />
        <Stat label="EMA" value={DRY.move(read.moveBps)} />
        <Stat label={DRY.books} value={`${cents(read.upCents)} · ${cents(read.downCents)}`} />
      </View>
      <View style={rule}>
        <Text style={[ST.micro, styles.mb4, { color: t.ink(0.4) }]}>{DRY.said}</Text>
        {verdict ? (
          <>
            <Text style={[ST.mono12, { color: color.ink }]}>{DRY.call(verdict.side, verdict.confidence)}</Text>
            <Text style={[small, styles.mt4]}>“{verdict.why}”</Text>
          </>
        ) : (
          <Text style={[ST.mono11, { color: t.ink(0.6) }]}>{DRY.noAnswer(failure ?? "")}</Text>
        )}
      </View>
      <View style={rule}>
        <Text style={[ST.micro, styles.mb4, { color: t.ink(0.4) }]}>{DRY.gate}</Text>
        <Text style={[ST.mono12, { color: gate.side ? color.accent : t.ink(0.7) }]}>{gate.side ? DRY.gateTrade(gate.side) : DRY.gateHold}</Text>
        <Text style={[small, styles.mt4]}>{gate.reason}</Text>
      </View>
      <Text numberOfLines={1} style={[ST.mono10, styles.mt12, { color: t.ink(0.4) }]}>
        {DRY.model(model)}
      </Text>
    </>
  );
}

/** web's features/strategies/DryReadPanel.tsx (`.strat-dry`): what one dry read saw and said, and the gate's ruling. */
export function DryReadPanel({ state }: { state: DryRead }) {
  const { t } = useStrat();
  if (state.status === "idle") return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, { borderColor: t.vermilionA(0.3), backgroundColor: t.vermilionA(0.04) }]}>
      <View style={styles.head}>
        <Text style={[ST.micro, { color: t.vermilion }]}>{DRY.eyebrow}</Text>
        {state.status === "reading" ? <Text style={[ST.mono10, { color: t.ink(0.4) }]}>{DRY.reading}</Text> : null}
      </View>
      {state.status === "error" ? <Text style={[ST.mono11, styles.mt8, { color: t.ink(0.7), lineHeight: 17.875 }]}>{state.error}</Text> : null}
      {state.status === "ok" ? <Result result={state.result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  grid: { flexDirection: "row", gap: 12, marginTop: 10 },
  stat: { flex: 1, minWidth: 0 },
  rule: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  small: { fontFamily: FONT.body, fontSize: 11.25, lineHeight: 15.47 },
  mb4: { marginBottom: 4 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
});
