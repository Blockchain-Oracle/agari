import { TabScreen } from "~/components/shell/TabScreen";
import { useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TabIntro } from "~/components/ui/TabIntro";
import { marketsEnv } from "~/lib/env";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The live lanes through web's own read hook; S26.3 turns each row into the Window card. */
export default function MarketsScreen() {
  const { color } = useTheme();
  const lanes = useLanes(marketsEnv.venueId ?? null);
  return (
    <TabScreen>
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
                  <Pressable key={m.marketId} onPress={() => router.push({ pathname: "/markets/[id]", params: { id: m.marketId } })} accessibilityRole="link" style={styles.row}>
                    <AssetDisc asset={m.asset} size={22} />
                    <Text style={[TYPE.data, { color: color.ink }]}>{m.asset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingBottom: 120 },
  pad: { paddingHorizontal: SPACE.gutter },
  lane: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
});
