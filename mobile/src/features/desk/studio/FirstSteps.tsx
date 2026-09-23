import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { DESK } from "@/features/desk/copy";
import { GO_LIVE } from "@/features/desk/copy-controls";
import { GO_LIVE_CHECKS } from "@/features/desk/protocol";
import { Button, haptic, Screen } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Eyebrow, IconTile } from "../kit";

const F = DESK.studio.firstSteps;

/**
 * After creation (web's CreateStep.tsx `FirstSteps`): the badge, then money in, the Go live rule and how the desk
 * speaks. The phone app has no system notifications, so the third card says where the desk tells you: in the app.
 */
export function FirstSteps({ isLive }: { isLive: boolean }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  useEffect(() => haptic.success(), []);
  const card = (i: number) => (reduce ? undefined : FadeInDown.duration(300).delay(250 + i * 80));
  const cards = [
    { level: "careful" as const, icon: { ios: "wallet.bifold", android: "account_balance_wallet" }, title: F.money.title, body: isLive ? F.money.body : GO_LIVE.fees },
    { level: "balanced" as const, icon: { ios: "paperplane", android: "rocket_launch" }, title: F.goLive.title, body: F.goLive.body(GO_LIVE_CHECKS) },
    { level: "loose" as const, icon: { ios: "bell", android: "notifications" }, title: F.notify.title, body: `${F.notify.body} It tells you on your desk in this app.` },
  ];
  return (
    <Screen title={F.kicker}>
      <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(18)} style={[styles.badge, { backgroundColor: color.profitWash }]}>
        <SymbolView name={{ ios: "checkmark.circle.fill", android: "check_circle" }} size={44} tintColor={color.profit} />
      </Animated.View>
      <View style={styles.head} accessibilityLiveRegion="polite">
        <Eyebrow text={F.kicker.toUpperCase()} live={isLive} />
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
          {F.title}
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{F.body}</Text>
      </View>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{F.steps}</Text>
      {cards.map((c, i) => (
        <Animated.View key={c.title} entering={card(i)} style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <IconTile level={c.level} icon={c.icon} />
          <View style={styles.text}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{c.title}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{c.body}</Text>
          </View>
        </Animated.View>
      ))}
      <Button label={F.open.replace(" →", "")} size="lg" trailing="→" onPress={() => router.replace("/desk")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginTop: 8 },
  head: { gap: 8 },
  card: { flexDirection: "row", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14 },
  text: { flex: 1, gap: 4 },
});
