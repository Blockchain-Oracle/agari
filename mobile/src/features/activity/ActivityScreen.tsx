import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { activityKey, followingKey } from "@/features/activity/protocol";
import { useFollowingFeed, useInboxFeed, useMoneyUnits } from "@/features/activity/useActivity";
import { LEADERBOARD_KEY } from "@/features/leaderboard/useLeaderboard";
import { useFollows } from "@/features/social/useFollows";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Screen, SectionHeader, Segmented } from "~/components/kit";
import { FriendsBoard } from "~/features/leaderboard/FriendsBoard";
import { ActivityList } from "~/features/social/ActivityList";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { InboxSummary } from "./InboxSummary";
import { LiveDot } from "./LiveDot";

type Tab = "inbox" | "following";

/**
 * `/activity` — web's ActivityScreen (features/activity/ActivityScreen.tsx): the live eyebrow, "Your Activity" with the
 * Japanese line, then the wallet's inbox (fills, verdicts, payouts) or the following feed with the Friends board over
 * the calls of everyone you follow. The inbox is the same 15-second cache the lifecycle watcher reads.
 */
export function ActivityScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const { address } = useWalletSession();
  const [tab, setTab] = useState<Tab>("inbox");
  const units = useMoneyUnits();
  const inbox = useInboxFeed(address);
  const following = useFollowingFeed(address, tab === "following");
  const follows = useFollows(address);
  const followsNobody = follows.data !== null && follows.data.following.length === 0;
  const inboxCount = inbox.feed?.configured ? inbox.feed.items.length : null;
  const followingCount = follows.data ? follows.data.following.length : null;

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: activityKey(address) }),
      client.invalidateQueries({ queryKey: followingKey(address) }),
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
          <Segmented
            label={ACTIVITY.tabsLabel}
            value={tab}
            onChange={setTab}
            options={[
              { value: "inbox", label: ACTIVITY.tabs.inbox, count: inboxCount },
              { value: "following", label: ACTIVITY.tabs.following, count: followingCount },
            ]}
          />
          {tab === "inbox" ? (
            <>
              {inbox.feed?.configured ? <InboxSummary items={inbox.feed.items} units={units} /> : null}
              <ActivityList feed={inbox.feed} failed={inbox.failed} units={units} showWho={false} empty={ACTIVITY.empty.inbox} />
            </>
          ) : (
            <>
              <View style={styles.section}>
                <SectionHeader index="01" title={ACTIVITY.friends.title} desc={ACTIVITY.friends.desc} aside={ACTIVITY.friends.meta} />
                <FriendsBoard />
              </View>
              <View style={styles.section}>
                <SectionHeader index="02" title={ACTIVITY.calls.title} desc={ACTIVITY.calls.desc} />
                <ActivityList
                  feed={following.feed}
                  failed={following.failed}
                  units={units}
                  showWho
                  empty={followsNobody ? ACTIVITY.empty.following : ACTIVITY.empty.followingQuiet}
                />
              </View>
            </>
          )}
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
  section: { gap: 10 },
});
