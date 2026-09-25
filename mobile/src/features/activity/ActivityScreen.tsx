import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { activityKey } from "@/features/activity/protocol";
import { useInboxFeed, useMoneyUnits } from "@/features/activity/useActivity";
import { useWalletSession } from "@/lib/wallet-session";
import { Screen } from "~/components/kit";
import { usePushSettings } from "~/features/alerts/usePushSettings";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { activityTokens } from "~/theme/web/portfolio-activity";
import { ActivityList } from "./ActivityList";
import { LiveDot } from "./LiveDot";
import { PillButton } from "./PillButton";

/**
 * web `NotificationsControl`: whether lifecycle events reach the phone. On, it is a quiet `.lb-filter-meta` word; off,
 * an `.asset-tab` that opens the phone's notification settings (turning push on is a wallet signature there).
 */
function NotificationsControl() {
  const { name, color } = useTheme();
  const { state } = usePushSettings();
  if (state.phase === "loading") return null;
  if (state.phase === "on") return <Text style={[styles.meta, { color: activityTokens(name).gray600 }]}>{ACTIVITY.notifications.on}</Text>;
  return (
    <Pressable onPress={() => router.push("/notifications")} accessibilityRole="button" hitSlop={8}>
      <Text style={[styles.tab, { color: color.inkMuted }]}>{ACTIVITY.notifications.enable}</Text>
    </Pressable>
  );
}

/**
 * `/activity` — web features/activity/ActivityScreen.tsx in `/news`'s page frame (`.container.news-page`): the live
 * eyebrow, "Your Activity" with the Japanese line and one sentence, then the connect block or the Inbox tab over the
 * wire. The inbox shares its cache with the lifecycle watcher.
 */
export function ActivityScreen() {
  const { name, color } = useTheme();
  const client = useQueryClient();
  const { address } = useWalletSession();
  const units = useMoneyUnits();
  const inbox = useInboxFeed(address);
  const t = activityTokens(name);

  return (
    <Screen title={ACTIVITY.title} onRefresh={address ? () => client.invalidateQueries({ queryKey: activityKey(address) }) : undefined} contentStyle={styles.page}>
      <View style={styles.live}>
        <LiveDot />
        <Text style={[styles.liveLabel, { color: color.inkMuted }]}>{ACTIVITY.live}</Text>
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {ACTIVITY.heading} <Text style={{ color: color.accent }}>{ACTIVITY.headingAccent}</Text>
      </Text>
      <Text style={[styles.jp, { color: color.inkMuted }]}>{ACTIVITY.headingJp}</Text>
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{ACTIVITY.intro}</Text>

      {!address ? (
        <View style={styles.connect}>
          <Text style={[styles.connectTitle, { color: color.ink }]}>{ACTIVITY.connect.title}</Text>
          <Text style={[styles.intro, { color: color.inkSecondary }]}>{ACTIVITY.connect.body}</Text>
          <PillButton label={ACTIVITY.connect.cta} onPress={() => router.push("/connect")} />
        </View>
      ) : (
        <>
          <View style={[styles.tabs, { borderBottomColor: t.newsHairline }]}>
            <View style={[styles.tabOn, { borderBottomColor: color.accent }]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
              <Text style={[styles.tab, { color: color.ink }]}>{ACTIVITY.tabs.inbox}</Text>
            </View>
            <NotificationsControl />
          </View>
          <ActivityList feed={inbox.feed} failed={inbox.failed} units={units} showWho={false} empty={ACTIVITY.empty.inbox} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 96 + CHROME.dockClearance, gap: 0 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  liveLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9, marginBottom: 8 },
  jp: { fontFamily: FONT.stamp, fontSize: 15, lineHeight: 24, letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  connect: { alignItems: "flex-start", gap: 12, marginTop: 48 },
  connectTitle: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 32 },
  tabs: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 40, paddingBottom: 14, borderBottomWidth: 1 },
  tabOn: { paddingVertical: 4, borderBottomWidth: 1 },
  tab: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
});
