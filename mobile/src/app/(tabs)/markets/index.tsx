import { useLanes } from "@agari/markets/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TabIntro } from "@/components/ui/TabIntro";
import { marketsEnv } from "@/lib/env";
import { RADIUS, SPACE, TYPE, useTheme } from "@/theme";

/** The live lanes through web's own read hook; S26.3 turns each row into the Window card. */
export default function MarketsScreen() {
  const { color } = useTheme();
  const lanes = useLanes(marketsEnv.venueId ?? null);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <TabIntro title="Markets" line="Trade live price windows." />
      {lanes === null ? null : !lanes.ok ? (
        <Text style={[TYPE.body, styles.pad, { color: color.loss }]}>Couldn't load the Windows ({lanes.error.kind}).</Text>
      ) : (
        lanes.value.lanes.map((lane) => (
          <View key={`${lane.basis}:${lane.intervalSec}`} style={[styles.pad, styles.lane]}>
            <Text style={[TYPE.labelMicro, { color: color.accent }]}>{lane.label} · {lane.markets.length} live</Text>
            <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
              {lane.markets.map((m) => (
                <Text key={m.marketId} style={[TYPE.data, { color: color.ink }]}>{m.asset}</Text>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingBottom: 120 },
  pad: { paddingHorizontal: SPACE.gutter },
  lane: { gap: 8 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
});
