import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { BellRing, CircleCheckBig, Rocket, Wallet, type LucideIcon } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion, withSpring, withTiming } from "react-native-reanimated";
import { DESK } from "@/features/desk/copy";
import { GO_LIVE } from "@/features/desk/copy-controls";
import { GO_LIVE_CHECKS } from "@/features/desk/protocol";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { IconTile, StBtn, StLabel, T, useDeskEntryTokens, type Level } from "./kit-bits";
import { slideIn } from "./kit-motion";

const F = DESK.studio.firstSteps;
type Permission = "granted" | "denied" | "default";

/** motion's `type: "spring", stiffness: 320, damping: 18` from `scale: 0.4, opacity: 0`. */
const pop = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.4 }] },
    animations: { opacity: withTiming(1, { duration: 200 }), transform: [{ scale: withSpring(1, { stiffness: 320, damping: 18 }) }] },
  };
};

/** The phone's notification permission in web's three words (`Notification.permission`). */
function usePermission(): [Permission, () => void] {
  const [state, setState] = useState<Permission>("default");
  const read = (p: Notifications.NotificationPermissionsStatus) => setState(p.granted ? "granted" : p.canAskAgain ? "default" : "denied");
  useEffect(() => {
    void Notifications.getPermissionsAsync().then(read).catch(() => undefined);
  }, []);
  const ask = () => void Notifications.requestPermissionsAsync().then(read).catch(() => undefined);
  return [state, ask];
}

function Card({ i, icon, level, title, children }: { i: number; icon: LucideIcon; level: Level; title: string; children: ReactNode }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : slideIn({ distance: 12, duration: 300, delay: 250 + i * 80 })} style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <IconTile icon={icon} level={level} />
      <Text style={[styles.cardTitle, { color: color.ink }]}>{title}</Text>
      {children}
    </Animated.View>
  );
}

/**
 * After creation (web's CreateStep.tsx `FirstSteps`): the badge, then money in, the Go live rule and notifications,
 * and the way to the desk. `onMoney` opens the money sheet on a live desk.
 */
export function FirstSteps({ isLive, onMoney }: { isLive: boolean; onMoney: (() => void) | null }) {
  const { color } = useTheme();
  const tk = useDeskEntryTokens();
  const reduce = useReducedMotion();
  const [notif, ask] = usePermission();
  return (
    <ExplorePage title={F.title} style={styles.page}>
      <View style={styles.created} accessibilityLiveRegion="polite">
        <Animated.View entering={reduce ? undefined : pop} style={[styles.ring, { backgroundColor: tk.createdRing }]}>
          <View style={[styles.badge, { backgroundColor: color.profitWash }]}>
            <CircleCheckBig size={36} color={color.profit} />
          </View>
        </Animated.View>
        <View style={styles.head}>
          <Text style={[T.eyebrow, { color: isLive ? color.accent : color.inkMuted }]}>{F.kicker}</Text>
          <Text style={[T.title, { color: color.ink }]} accessibilityRole="header">
            {F.title}
          </Text>
          <Text style={[T.body, { color: color.inkSecondary }]}>{F.body}</Text>
        </View>
        <StLabel>{F.steps}</StLabel>
        <View style={styles.grid}>
          <Card i={0} icon={Wallet} level="careful" title={F.money.title}>
            <Text style={[T.caption, { color: color.inkSecondary }]}>{isLive ? F.money.body : GO_LIVE.fees}</Text>
            {isLive && onMoney ? <StBtn label={F.money.title} onPress={onMoney} /> : null}
          </Card>
          <Card i={1} icon={Rocket} level="balanced" title={F.goLive.title}>
            <Text style={[T.caption, { color: color.inkSecondary }]}>{F.goLive.body(GO_LIVE_CHECKS)}</Text>
          </Card>
          <Card i={2} icon={BellRing} level="loose" title={F.notify.title}>
            <Text style={[T.caption, { color: color.inkSecondary }]}>{F.notify.body}</Text>
            {notif === "granted" ? (
              <Text style={[T.caption, { color: color.ink }]}>{F.notify.on}</Text>
            ) : notif === "denied" ? (
              <Text style={[T.caption, { color: color.warning }]}>{F.notify.denied}</Text>
            ) : (
              <StBtn label={F.notify.turnOn} onPress={ask} />
            )}
          </Card>
        </View>
        <StBtn label={F.open} primary lg onPress={() => router.push("/desk")} style={styles.open} />
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 64 + CHROME.dockClearance },
  created: { alignItems: "flex-start", gap: 20 },
  // box-shadow: 0 0 0 8px profit 8%: an 8 px ring outside the disc.
  ring: { width: 88, height: 88, margin: -8, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  head: { alignSelf: "stretch", gap: 8 },
  grid: { alignSelf: "stretch", gap: 12 },
  card: { alignItems: "flex-start", gap: 10, padding: 18, borderWidth: 1, borderRadius: 16 },
  cardTitle: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  open: { alignSelf: "flex-start" },
});
