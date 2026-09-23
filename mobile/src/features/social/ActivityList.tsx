import type { Signature } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { describeItem, type MoneyUnits, type Tone } from "@/features/activity/describe";
import type { ActivityFeed, ActivityItem } from "@/features/activity/protocol";
import { timeAgo } from "@/features/markets/history/time-ago";
import type { FeedTake } from "@/features/takes/protocol";
import { haptic } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";
import { HueAvatar } from "./HueAvatar";

/** Relative times only need to turn over by the minute (web's CLOCK_TICK_MS). */
const CLOCK_TICK_MS = 30_000;

function useNowMs(tickMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

/** Where a row goes natively: the fill's transaction on Explorer, the Window's screen, or Portfolio's claim. */
function openItem(item: ActivityItem): void {
  if (item.kind === "claimable") {
    router.push("/portfolio");
    return;
  }
  const txFirst = item.kind === "fill" || item.kind === "resting-filled" || item.kind === "paid-automatically" || item.kind === "copied";
  if (txFirst && item.signature) {
    void openExternal(explorerUrl("tx", item.signature as Signature));
    return;
  }
  if (item.marketId) router.push(`/markets/${item.marketId}`);
}

interface RowProps {
  index: number;
  item: ActivityItem;
  take: FeedTake | undefined;
  units: MoneyUnits;
  showWho: boolean;
  nowMs: number;
}

/**
 * One event as a wire row — web's `ActivityRow` (features/activity/ActivityList.tsx) in `/news`'s grammar: the
 * number, the wallet's hue avatar, the headline, then time · wallet in mono and the kind's word in its tone's ink.
 */
const ActivityRow = memo(function ActivityRow({ index, item, take, units, showWho, nowMs }: RowProps) {
  const { color } = useTheme();
  const view = describeItem(item, units, take);
  const toneInk: Record<Tone, string> = { positive: color.profit, negative: color.loss, neutral: color.inkSecondary };
  const when = timeAgo(item.atSec * 1000, nowMs);
  const tappable = item.kind === "claimable" || item.signature !== null || item.marketId !== null;
  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]}>
      <Text style={[styles.index, { color: color.inkMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
      <HueAvatar address={item.wallet} size={30} />
      <View style={styles.text}>
        <Pressable
          disabled={!tappable}
          onPress={() => {
            haptic.tap();
            openItem(item);
          }}
          accessibilityRole={tappable ? "link" : "text"}
          accessibilityLabel={`${ACTIVITY.tag[item.kind]}: ${view.title}`}
          hitSlop={6}
        >
          <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={3}>
            {view.title}
          </Text>
        </Pressable>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: color.inkMuted }]}>{when}</Text>
          {showWho ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push(`/u/${item.wallet}`);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open ${shortHex(item.wallet)}'s profile`}
              hitSlop={10}
            >
              <Text style={[styles.metaText, { color: color.inkSecondary }]}>· {shortHex(item.wallet)}</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.tag, { color: toneInk[view.tone] }]}>{ACTIVITY.tag[item.kind]}</Text>
        </View>
      </View>
    </View>
  );
});

interface ActivityListProps {
  feed: ActivityFeed | null;
  failed: boolean;
  units: MoneyUnits;
  showWho: boolean;
  empty: string;
  limit?: number;
}

/** web's `ActivityList`: reading, not configured, failed with nothing to show, empty, and the rows. */
export function ActivityList({ feed, failed, units, showWho, empty, limit }: ActivityListProps) {
  const { color } = useTheme();
  const nowMs = useNowMs(CLOCK_TICK_MS);
  const takes = useMemo(() => new Map((feed?.takes ?? []).map((take) => [take.id, take])), [feed]);
  const quiet = (text: string, role?: "alert") => (
    <Text style={[TYPE.body, styles.quiet, { color: color.inkSecondary }]} accessibilityRole={role}>
      {text}
    </Text>
  );
  if (!feed) return quiet(failed ? ACTIVITY.failed : ACTIVITY.loading, failed ? "alert" : undefined);
  if (!feed.configured) return quiet(ACTIVITY.unavailable);
  const items = limit === undefined ? feed.items : feed.items.slice(0, limit);
  if (items.length === 0) return quiet(empty);
  return (
    <View>
      {items.map((item, index) => (
        <ActivityRow
          key={item.id}
          index={index}
          item={item}
          take={item.takeId ? takes.get(item.takeId) : undefined}
          units={units}
          showWho={showWho}
          nowMs={nowMs}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  index: { fontFamily: FONT.data, fontSize: 11, width: 20, paddingTop: 8 },
  text: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  metaText: { fontFamily: FONT.data, fontSize: 12 },
  tag: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase", marginLeft: "auto" },
  quiet: { paddingVertical: 12 },
});
