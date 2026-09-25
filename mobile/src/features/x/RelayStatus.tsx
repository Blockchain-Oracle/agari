import { StyleSheet, Text, View } from "react-native";
import type { XStatus } from "@/features/x/protocol";
import { relayStageLabel } from "@/features/x/relay-health";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";

/** web's XRelayStatus.tsx (`.xt-composer-note`): OAuth, polling, execution and reply delivery are different facts. */
export function RelayStatus({ health }: { health: XStatus["relay"] }) {
  const t = tradeXTokens(useTheme().name);
  const now = Date.now();
  const line = [styles.line, { color: t.gray500 }];
  return (
    <View style={styles.note} accessibilityLabel="X service status" accessibilityLiveRegion="polite">
      <Text style={line}>
        Mentions: {relayStageLabel(health?.polling, now)} · Orders: {relayStageLabel(health?.execution, now)} · Replies: {relayStageLabel(health?.delivery, now)}
      </Text>
      <Text style={line}>
        {health?.delivery?.imagesEnabled === false ? "Image replies are disabled." : health?.lastImageReplyAtMs
          ? `An image reply was last acknowledged ${new Date(health.lastImageReplyAtMs).toLocaleString()}.`
          : "Image delivery has not been verified."}
      </Text>
      {health?.unresolvedExecutions || health?.deliveryNeedsInspection ? (
        <Text style={line}>
          {health.unresolvedExecutions ?? 0} order(s) and {health.deliveryNeedsInspection ?? 0} reply(s) need inspection. Check your receipt before another instruction.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 12 },
  line: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
