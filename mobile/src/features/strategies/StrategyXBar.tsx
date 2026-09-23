import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { X_LINK_STATUS } from "@/features/x/copy";
import { Button } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import { openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { useXLink } from "~/features/x/useXLink";

const DISCOVER_URL = `https://x.com/search?q=${encodeURIComponent("agari strategy copy")}&src=typed_query&f=live`;

/** web's features/strategies/StrategyXBar.tsx: the X account binding at a glance, managed on X recovery. */
export function StrategyXBar() {
  const { color } = useTheme();
  const link = useXLink();
  const binding = link.status?.binding ?? null;
  const available = link.status?.configured && link.status.storeConfigured;
  const manage = link.linked || link.walletMismatch;
  const subtitle = link.loading
    ? X_LINK_STATUS.checking
    : link.linked
      ? STRATEGIES.x.linked(binding?.handle ?? null)
      : link.walletMismatch
        ? STRATEGIES.x.walletMismatch
        : available
          ? STRATEGIES.x.sub
          : STRATEGIES.x.unavailable;
  return (
    <View style={[styles.bar, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: color.surface2 }]}>
          <Logo brand="x" size={16} />
        </View>
        <View style={styles.text}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{STRATEGIES.x.title}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={2} accessibilityLiveRegion="polite">
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {link.loading ? null : manage || available ? (
          <Button label={manage ? STRATEGIES.x.manage : STRATEGIES.x.connect} variant="secondary" size="sm" icon={{ ios: "link", android: "link" }} onPress={() => router.push("/claim")} style={styles.action} />
        ) : (
          <Button label={STRATEGIES.x.retry} variant="secondary" size="sm" onPress={() => void link.refresh()} style={styles.action} />
        )}
        <Button label={STRATEGIES.x.browse} variant="outline" size="sm" icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(DISCOVER_URL)} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
});
