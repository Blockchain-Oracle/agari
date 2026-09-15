"use client";

import { shortHex } from "@agari/core/units";
import Link from "next/link";
import { memo, useMemo, type CSSProperties } from "react";
import { useNowMs } from "@/components/data";
import { timeAgo } from "@/features/markets/history/time-ago";
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
  /** Name the wallet on the row (following and ticker feeds); the inbox is all "you". */
  showWho: boolean;
  nowMs: number;
}

/**
 * One event as a wire row: `/news`'s numbered, ruled line (`NewsFeed.tsx`), with the kind as its labelled tag and the
 * wallet and time as mono metadata. The headline links to the transaction or the Window; the wallet to its profile.
 */
const ActivityRow = memo(function ActivityRow({ index, item, take, units, showWho, nowMs }: RowProps) {
  const view = describeItem(item, units, take);
  const title = <span className="news-row-title">{view.title}</span>;
  return (
    <li className="news-row act-row" data-kind={item.kind}>
      <span className="news-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="news-row-body">
        {view.href === null ? (
          title
        ) : view.external ? (
          <a href={view.href} target="_blank" rel="noopener noreferrer" data-cursor="hover">
            {title}
          </a>
        ) : (
          <Link href={view.href} data-cursor="hover">
            {title}
          </Link>
        )}
        <span className="news-row-meta">
          <span className="news-tag" data-tone={view.tone}>
            {ACTIVITY.tag[item.kind]}
          </span>
          <span className="news-meta">
            {nowMs > 0 ? timeAgo(item.atSec * 1000, nowMs) : ""}
            {showWho && (
              <>
                {nowMs > 0 ? " · " : ""}
                <Link href={`/u/${item.wallet}`} className="act-who" data-cursor="hover">
                  <span aria-hidden className="act-avatar" style={{ "--act-hue": addressHue(item.wallet) } as CSSProperties} />
                  {shortHex(item.wallet)}
                </Link>
              </>
            )}
          </span>
        </span>
      </span>
      <span className="news-row-arrow" aria-hidden>
        {view.external ? "↗" : "→"}
      </span>
    </li>
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
    <ol className="act-list">
      {items.map((item, index) => (
        <ActivityRow key={item.id} index={index} item={item} take={item.takeId ? takes.get(item.takeId) : undefined} units={units} showWho={showWho} nowMs={nowMs} />
      ))}
    </ol>
  );
}
