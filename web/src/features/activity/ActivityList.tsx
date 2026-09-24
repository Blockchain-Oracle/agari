"use client";

import { shortHex } from "@agari/core/units";
import Link from "next/link";
import { memo, useMemo, type CSSProperties } from "react";
import { useNowMs } from "@/components/data";
import { timeAgo } from "@/features/markets/history/time-ago";
import { NewsRow } from "@/features/news/NewsRow";
import { profileHref } from "@/features/takes/cashtags";
import type { FeedTake } from "@/features/takes/protocol";
import { addressHue } from "@/lib/address-hue";
import { ACTIVITY } from "./copy";
import { describeItem, type MoneyUnits } from "./describe";
import type { ActivityFeed, ActivityItem } from "./protocol";
import "./activity.css";

/** Relative times only need to turn over by the minute. */
const CLOCK_TICK_MS = 30_000;

interface RowProps {
  index: number;
  item: ActivityItem;
  take: FeedTake | undefined;
  units: MoneyUnits;
  /** Name the wallet on the row (ticker feeds); the inbox is all "you". */
  showWho: boolean;
  nowMs: number;
}

/**
 * One event as a wire row — `/news`'s grammar (`NewsRow`, D-082): the wallet's hue avatar in the mark slot, the kind
 * as the tone's word in the kind's ink, the time (and, on a ticker feed, the wallet) as mono metadata.
 * The headline links to the transaction or the Window; the wallet to its profile.
 */
const ActivityRow = memo(function ActivityRow({ index, item, take, units, showWho, nowMs }: RowProps) {
  const view = describeItem(item, units, take);
  return (
    <NewsRow
      index={index + 1}
      title={view.title}
      href={view.href}
      external={view.external}
      kind={item.kind}
      mark={<span aria-hidden className="news-mark act-avatar" style={{ "--act-hue": addressHue(item.wallet) } as CSSProperties} />}
      meta={
        <span className="news-meta">
          {nowMs > 0 ? timeAgo(item.atSec * 1000, nowMs) : ""}
          {showWho && (
            <>
              {nowMs > 0 ? " · " : ""}
              <Link href={profileHref(item.wallet)} className="act-who" data-cursor="hover">
                {shortHex(item.wallet)}
              </Link>
            </>
          )}
        </span>
      }
      tone={view.tone}
      toneWord={ACTIVITY.tag[item.kind]}
    />
  );
});

interface ActivityListProps {
  feed: ActivityFeed | null;
  failed: boolean;
  units: MoneyUnits;
  showWho: boolean;
  empty: string;
  /** Rows shown; the feed carries up to 50. */
  limit?: number;
}

/** The feed's every state: reading, not configured, failed with nothing to show, empty, and the rows. */
export function ActivityList({ feed, failed, units, showWho, empty, limit }: ActivityListProps) {
  const nowMs = useNowMs(undefined, CLOCK_TICK_MS);
  const takes = useMemo(() => new Map((feed?.takes ?? []).map((take) => [take.id, take])), [feed]);
  if (!feed) {
    return (
      <p className="news-quiet" role={failed ? "alert" : "status"} aria-busy={!failed}>
        {failed ? ACTIVITY.failed : ACTIVITY.loading}
      </p>
    );
  }
  if (!feed.configured) return <p className="news-quiet">{ACTIVITY.unavailable}</p>;
  const items = limit === undefined ? feed.items : feed.items.slice(0, limit);
  if (items.length === 0) return <p className="news-quiet">{empty}</p>;
  return (
    <ol className="news-wire act-list">
      {items.map((item, index) => (
        <ActivityRow key={item.id} index={index} item={item} take={item.takeId ? takes.get(item.takeId) : undefined} units={units} showWho={showWho} nowMs={nowMs} />
      ))}
    </ol>
  );
}
