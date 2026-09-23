import { StyleSheet, Text, View } from "react-native";
import type { XStatus } from "@/features/x/protocol";
import { relayStageLabel } from "@/features/x/relay-health";
import { Row, Rows } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

/** web's features/x/XRelayStatus.tsx: polling, execution and reply delivery are separate facts, each with its age. */
export function RelayStatus({ health }: { health: XStatus["relay"] }) {
  const { color } = useTheme();
  const now = Date.now();
  const stage = (s: Parameters<typeof relayStageLabel>[0]) => relayStageLabel(s, now);
  const tone = (label: string) => (label === "Last check passed" || label === "Standing by" ? "profit" : label === "Needs attention" ? "loss" : "muted");
  const lines = [
    ["Mentions", stage(health?.polling)],
    ["Orders", stage(health?.execution)],
    ["Replies", stage(health?.delivery)],
  ] as const;
  return (
    <View style={styles.wrap} accessibilityLabel="X service status" accessibilityLiveRegion="polite">
      <Rows>
        {lines.map(([label, value]) => (
          <Row key={label} label={label} value={value} tone={tone(value)} />
        ))}
      </Rows>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {health?.delivery?.imagesEnabled === false
          ? "Image replies are disabled."
          : health?.lastImageReplyAtMs
            ? `An image reply was last acknowledged ${new Date(health.lastImageReplyAtMs).toLocaleString()}.`
            : "Image delivery has not been verified."}
      </Text>
      {health?.unresolvedExecutions || health?.deliveryNeedsInspection ? (
        <Text style={[TYPE.caption, { color: color.warning }]}>
          {health.unresolvedExecutions ?? 0} order(s) and {health.deliveryNeedsInspection ?? 0} reply(s) need inspection. Check your receipt before another instruction.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
});
