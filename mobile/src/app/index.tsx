import { useLanes } from "@agari/markets/react";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { probeCrypto } from "@/lib/crypto-probe";
import { marketsEnv } from "@/lib/env";

type Probe = { state: "running" } | { state: "ok"; address: string } | { state: "failed"; message: string };

/** S26.0 foundations proof: live Windows through web's own read hooks, and Ed25519 WebCrypto in Hermes. */
export default function FoundationsProbe() {
  const lanes = useLanes(marketsEnv.venueId ?? null);
  const [probe, setProbe] = useState<Probe>({ state: "running" });

  useEffect(() => {
    probeCrypto().then(
      (address) => setProbe({ state: "ok", address }),
      (error: unknown) => setProbe({ state: "failed", message: String(error) }),
    );
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Agari · foundations</Text>
        <Text testID="crypto-probe" style={styles.line}>
          crypto: {probe.state === "ok" ? `ok ${probe.address}` : probe.state === "failed" ? `FAILED ${probe.message}` : "running"}
        </Text>
        {lanes === null ? (
          <Text style={styles.line}>lanes: loading</Text>
        ) : !lanes.ok ? (
          <Text style={styles.line}>lanes: FAILED {lanes.error.kind}</Text>
        ) : (
          lanes.value.lanes.map((lane) => (
            <View key={lane.label} style={styles.lane}>
              <Text style={styles.laneTitle}>{lane.label} · {lane.markets.length} live</Text>
              {lane.markets.slice(0, 6).map((m) => (
                <Text key={m.marketId} style={styles.line}>{m.asset} · {m.question}</Text>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  body: { padding: 16, gap: 12 },
  title: { color: "#F4EEE3", fontSize: 22, fontWeight: "700" },
  lane: { gap: 4 },
  laneTitle: { color: "#E04D26", fontSize: 15, fontWeight: "600" },
  line: { color: "#F4EEE3", fontSize: 13 },
});
