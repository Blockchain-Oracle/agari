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
import { HueAvatar } from "~/features/social/HueAvatar";
import { openExternal } from "~/lib/external";
import { FONT, useTheme, type Palette } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

/** Relative times only need to turn over by the minute (web's CLOCK_TICK_MS). */
const CLOCK_TICK_MS = 30_000;

function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** news.css `.news-tone[data-tone]`: profit, loss, gray-500. */
function toneInk(tone: Tone, color: Palette): string {
  return tone === "positive" ? color.profit : tone === "negative" ? color.loss : color.inkMuted;
}

/** Where web's row link goes, natively: the transaction out to Explorer, a Window to its screen, Portfolio in place. */
function follow(item: ActivityItem, href: string | null, external: boolean) {
  if (href === null) return;
  haptic.tap();
  if (external) void openExternal(href);
  else if (item.marketId && href.startsWith("/markets")) router.push(`/markets/${item.marketId}`);
  else router.push(href as "/portfolio");
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
 * web `ActivityRow` → `NewsRow` under 640 px (news-wire.css): index and mark columns, the headline across the row,
 * then time · wallet in 10 px mono, the kind as the tone's word and the arrow; a 2 px edge in the tone's ink.
 */
const ActivityRow = memo(function ActivityRow({ index, item, take, units, showWho, nowMs }: RowProps) {
  const { name, color } = useTheme();
  const t = activityTokens(name);
  const view = describeItem(item, units, take);
  const ink = toneInk(view.tone, color);
  return (
    <View style={[styles.row, { borderLeftColor: view.tone === "neutral" ? t.newsHairline : ink, borderBottomColor: t.newsRule }]}>
      <Text style={[styles.index, { color: t.gray600 }]}>{String(index + 1).padStart(2, "0")}</Text>
      <View style={styles.mark}>
        <View style={[styles.ring, { borderColor: color.ground }]}>
          <HueAvatar address={item.wallet} size={16} />
        </View>
      </View>
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: t.gray200 }]}
          onPress={view.href === null ? undefined : () => follow(item, view.href, view.external)}
          accessibilityRole={view.href === null ? "text" : "link"}
          accessibilityLabel={`${ACTIVITY.tag[item.kind]}: ${view.title}`}
        >
          {view.title}
        </Text>
        <View style={styles.foot}>
          <View style={styles.meta}>
            <Text style={[styles.metaText, { color: t.gray600 }]}>{timeAgo(item.atSec * 1000, nowMs)}</Text>
            {showWho ? (
              <Pressable onPress={() => router.push(`/u/${item.wallet}`)} accessibilityRole="link" hitSlop={10}>
                <Text style={[styles.metaText, { color: color.inkMuted }]}>· {shortHex(item.wallet)}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.tone}>
            <View style={[styles.toneDot, { backgroundColor: ink }]} />
            <Text style={[styles.toneWord, { color: ink }]}>{ACTIVITY.tag[item.kind]}</Text>
          </View>
          <Text style={[styles.arrow, { color: t.gray700 }]}>{view.external ? "↗" : "→"}</Text>
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

/** web `ActivityList`: reading, not configured, failed with nothing to show, empty (each a `.news-quiet` line), and the wire. */
export function ActivityList({ feed, failed, units, showWho, empty, limit }: ActivityListProps) {
  const { name } = useTheme();
  const nowMs = useNowMs();
  const takes = useMemo(() => new Map((feed?.takes ?? []).map((take) => [take.id, take])), [feed]);
  const quiet = (text: string, alert = false) => (
    <Text style={[styles.quiet, { color: activityTokens(name).gray600 }]} accessibilityRole={alert ? "alert" : "text"}>
      {text}
    </Text>
  );
  if (!feed) return quiet(failed ? ACTIVITY.failed : ACTIVITY.loading, failed);
  if (!feed.configured) return quiet(ACTIVITY.unavailable);
  const items = limit === undefined ? feed.items : feed.items.slice(0, limit);
  if (items.length === 0) return quiet(empty);
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <ActivityRow key={item.id} index={index} item={item} take={item.takeId ? takes.get(item.takeId) : undefined} units={units} showWho={showWho} nowMs={nowMs} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 24 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 16, paddingLeft: 12, borderLeftWidth: 2, borderBottomWidth: 1 },
  index: { width: 24, paddingTop: 6, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  mark: { width: 16, paddingTop: 3 },
  ring: { borderWidth: 1.5, borderRadius: 16, margin: -1.5 },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 22 },
  foot: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  meta: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 6 },
  metaText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  tone: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 3 },
  toneDot: { width: 6, height: 6, borderRadius: 3 },
  toneWord: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26, textTransform: "uppercase" },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, marginTop: 6 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
