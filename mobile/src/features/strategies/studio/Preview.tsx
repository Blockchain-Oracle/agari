import { PRESETS, type PresetKey } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { FONT } from "~/theme";
import { AgentPortrait } from "../AgentPortrait";
import { ST, useStrat } from "../ui";
import { Body } from "./parts";

/** web CreatorStudio's aside (`.strat-preview.agent-builder-preview`): the agent as it will appear, and its limits. */
export function Preview({ seed, name, preset, maxPerTrade, maxDaily, symbol, testRead }: {
  seed: string; name: string; preset: PresetKey; maxPerTrade: string; maxDaily: string; symbol: string; testRead: string;
}) {
  const { t, color } = useStrat();
  const facts: [string, string][] = [
    ["Most per trade", `${maxPerTrade || "—"} ${symbol}`],
    ["Most per day", `${maxDaily || "—"} ${symbol}`],
    ["Market scope", "Every live lane, 24/7 included"],
    ["Test read", testRead],
  ];
  return (
    <View style={[styles.aside, { borderColor: t.ink(0.1), backgroundColor: color.ground }]}>
      <Text style={[ST.micro, { color: color.inkMuted }]}>Your agent</Text>
      <View style={styles.who}>
        <AgentPortrait seed={seed} name={name} />
        <View style={styles.whoText}>
          <Text style={[ST.choiceTitle, { color: color.ink }]}>{name}</Text>
          <Text style={[ST.mono11, styles.mt4, { color: color.inkMuted }]}>{PRESETS[preset].name}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        {facts.map(([dt, dd]) => (
          <View key={dt} style={[styles.fact, { borderTopColor: color.hairline }]}>
            <Text style={[styles.factText, { color: color.inkMuted }]}>{dt}</Text>
            <Text style={[styles.factText, styles.dd, { color: color.ink }]}>{dd}</Text>
          </View>
        ))}
      </View>
      <Body style={styles.mt8}>Your name and portrait stay with the published strategy across the desk, cards and copy settings.</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  aside: { borderRadius: 12, borderWidth: 1, padding: 20, overflow: "hidden" },
  who: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  whoText: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  facts: { marginVertical: 22.5 },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderTopWidth: 1, paddingVertical: 12 },
  factText: { fontFamily: FONT.body, fontSize: 11.25, lineHeight: 18 },
  dd: { textAlign: "right", flexShrink: 1 },
});
