import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { activityKey } from "@/features/activity/protocol";
import { useInboxFeed, useMoneyUnits } from "@/features/activity/useActivity";
import { LEADERBOARD_KEY } from "@/features/leaderboard/useLeaderboard";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Screen, Segmented } from "~/components/kit";
import { ActivityList } from "~/features/social/ActivityList";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { InboxSummary } from "./InboxSummary";
import { LiveDot } from "./LiveDot";

/**
 * `/activity` — web's ActivityScreen (features/activity/ActivityScreen.tsx): the live eyebrow, "Your Activity" with the
 * Japanese line, then the wallet's inbox (fills, verdicts, payouts). The inbox is the same 15-second cache the
 * lifecycle watcher reads.
 */
export function ActivityScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const { address } = useWalletSession();
  const units = useMoneyUnits();
  const inbox = useInboxFeed(address);
  const inboxCount = inbox.feed?.configured ? inbox.feed.items.length : null;

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: activityKey(address) }),
      client.invalidateQueries({ queryKey: LEADERBOARD_KEY }),
    ]);

  return (
    <Screen title={ACTIVITY.title} onRefresh={address ? refresh : undefined}>
      <View style={styles.hero}>
        <View style={styles.live}>
          <LiveDot />
          <Text style={[styles.liveText, { color: color.accent }]}>{ACTIVITY.live.toUpperCase()}</Text>
        </View>
        <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
          {ACTIVITY.heading} <Text style={{ color: color.accent }}>{ACTIVITY.headingAccent}</Text>
        </Text>
        <Text style={[TYPE.stamp, styles.jp, { color: color.inkMuted }]}>{ACTIVITY.headingJp}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ACTIVITY.intro}</Text>
      </View>

      {!address ? (
        <View style={[styles.connect, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{ACTIVITY.connect.title}</Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ACTIVITY.connect.body}</Text>
          <Button label={ACTIVITY.connect.cta} onPress={() => router.push("/connect")} />
        </View>
      ) : (
        <>
          <Segmented label={ACTIVITY.tabs.inbox} value="inbox" onChange={() => undefined} options={[{ value: "inbox", label: ACTIVITY.tabs.inbox, count: inboxCount }]} />
          {inbox.feed?.configured ? <InboxSummary items={inbox.feed.items} units={units} /> : null}
          <ActivityList feed={inbox.feed} failed={inbox.failed} units={units} showWho={false} empty={ACTIVITY.empty.inbox} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  live: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  jp: { fontSize: 18, lineHeight: 24 },
  connect: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
});
