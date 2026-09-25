import { invalidateAfterWrite } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { CLAIM } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ClaimFlow } from "~/features/recovery/ClaimFlow";
import { useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { activityTokens } from "~/theme/web/portfolio-activity";
import { usePullRefresh } from "~/components/kit/PullRefresh";

/** x-card.css `.xc-wash--v` / `--g`: the two fixed radial washes behind the page. */
function Washes({ v, g }: { v: string; g: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="xc-v" cx="80%" cy="30%" rx="58%" ry="44%">
          <Stop offset="0" {...stopPaint(v, 1)} />
          <Stop offset="0.68" {...stopPaint(v, 0)} />
        </RadialGradient>
        <RadialGradient id="xc-g" cx="14%" cy="90%" rx="46%" ry="40%">
          <Stop offset="0" {...stopPaint(g, 1)} />
          <Stop offset="0.72" {...stopPaint(g, 0)} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#xc-v)" />
      <Rect width="100%" height="100%" fill="url(#xc-g)" />
    </Svg>
  );
}

/**
 * `/claim` — web app/claim/page.tsx (`.xc`): the fixed 5 px vermilion rail down the left edge, the two washes, and the
 * container (104 px top, 18 px gutter) holding the ticket and the flow. Pull to refresh re-reads the X route and the vault.
 */
export default function ClaimScreen() {
  const { name, color } = useTheme();
  const t = activityTokens(name);
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const refreshControl = usePullRefresh(() =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ["agari", "x-status"] }), address ? invalidateAfterWrite(queryClient, { wallet: address }) : null]),
  );
  return (
    <View style={[styles.xc, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ title: CLAIM.title, headerShown: false }} />
      <Washes v={t.washV} g={t.washG} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.main}
        refreshControl={refreshControl}
      >
        <ClaimFlow />
      </ScrollView>
      <View style={[styles.rail, { backgroundColor: color.accent }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  xc: { flex: 1 },
  main: { paddingTop: 104, paddingHorizontal: 18, paddingBottom: 120 + CHROME.dockClearance },
  rail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 5 },
});
