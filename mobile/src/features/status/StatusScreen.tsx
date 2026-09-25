import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { STATUS } from "@/features/status/copy";
import { STATUS_KEY, useStatus } from "@/features/status/useStatus";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { statusTokens } from "~/theme/web/explore/status";
import { StatusBanner, StatusTable } from "./StatusRows";

/**
 * `/status` — web StatusScreen.tsx: web's own `useStatus` (the `/api/status` probe, every 30 s), in its three states
 * — loading (the spinning refresh glyph), unreachable (the amber triangle) and the report: the verdict banner, the
 * pipeline table and the time it was checked.
 */
export function StatusScreen() {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  const client = useQueryClient();
  const reading = useStatus();
  const refresh = () => client.invalidateQueries({ queryKey: STATUS_KEY });

  return (
    <ExplorePage title={STATUS.title} onRefresh={refresh} style={styles.page}>
      <SectionHeader index={STATUS.section.index} title={STATUS.section.title} />

      {reading === null ? (
        <View style={styles.holding} accessibilityRole="progressbar" accessibilityLabel={STATUS.loading}>
          <Spinner ink={color.inkMuted} />
          <Text style={[styles.holdingText, { color: color.inkMuted }]}>{STATUS.loading}</Text>
        </View>
      ) : null}

      {reading !== null && !reading.ok ? (
        <View style={styles.holding} accessibilityRole="alert">
          <TriangleAlert size={32} color={t.amber} style={styles.holdingIcon} />
          <Text style={[styles.holdingText, { color: color.inkSecondary }]}>{STATUS.unreachable}</Text>
        </View>
      ) : null}

      {reading?.ok ? (
        <View style={styles.report}>
          <StatusBanner payload={reading.value} />
          <StatusTable pipelines={reading.value.pipelines} sessionLabel={reading.value.session?.label ?? null} />
          <Text style={[styles.checked, { color: color.inkDisabled }]}>{STATUS.lastChecked(new Date(reading.value.checkedAtMs).toLocaleTimeString())}</Text>
        </View>
      ) : null}
    </ExplorePage>
  );
}

/** `animate-spin` on the refresh glyph. */
function Spinner({ ink }: { ink: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={[styles.holdingIcon, { transform: [{ rotate }] }]}>
      <RefreshCw size={20} color={ink} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 48 + 112 },
  holding: { paddingVertical: 48, alignItems: "center" },
  holdingIcon: { marginBottom: 12 },
  holdingText: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  report: { gap: 24, marginTop: 24 },
  checked: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
});
