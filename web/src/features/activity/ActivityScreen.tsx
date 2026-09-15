"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { notificationState, requestNotificationPermission, type NotificationState } from "@/features/alerts/notifications";
import { FriendsBoard } from "@/features/social/FriendsBoard";
import { useFollows } from "@/features/social/useFollows";
import { useWalletSession } from "@/lib/wallet-session";
import { ActivityList } from "./ActivityList";
import { ACTIVITY } from "./copy";
import { useFollowingFeed, useInboxFeed, useMoneyUnits } from "./useActivity";

type Tab = "inbox" | "following";

/** Whether lifecycle events reach the system tray; a toast shows in the tab either way. */
function NotificationsControl() {
  const [state, setState] = useState<NotificationState>("unsupported");
  useEffect(() => setState(notificationState()), []);
  const words = ACTIVITY.notifications;
  if (state === "unsupported") return null;
  if (state !== "default") return <span className="lb-filter-meta">{state === "granted" ? words.on : words.blocked}</span>;
  return (
    <button type="button" className="asset-tab" onClick={() => void requestNotificationPermission().then(() => setState(notificationState()))} data-cursor="hover">
      {words.enable}
    </button>
  );
}

/**
 * `/activity` — the signed-in inbox and the following feed (spec §1.6), in `/news`'s page frame: live eyebrow,
 * two-tone headline, the Japanese line, one sentence, then the wire. The tabs are the leaderboard's asset tabs. The
 * inbox shares its cache entry with `LifecycleWatcher`, so opening this page adds no poll; the following feed (with
 * the Friends board over it) only polls while its tab is showing.
 */
export function ActivityScreen() {
  const { address, connect } = useWalletSession();
  const [tab, setTab] = useState<Tab>("inbox");
  const units = useMoneyUnits();
  const inbox = useInboxFeed(address);
  const following = useFollowingFeed(address, tab === "following");
  const follows = useFollows(address);
  const followsNobody = follows.data !== null && follows.data.following.length === 0;

  return (
    <div className="container news-page">
      <div className="news-inner">
        <div className="news-live">
          <span className="news-live-dot" aria-hidden />
          <span className="news-live-label">{ACTIVITY.live}</span>
        </div>
        <h1 className="news-title">
          {ACTIVITY.heading} <span className="vermilion">{ACTIVITY.headingAccent}</span>
        </h1>
        <div className="page-title-jp" lang="ja">
          {ACTIVITY.headingJp}
        </div>
        <p className="news-intro">{ACTIVITY.intro}</p>

        {!address ? (
          <div className="act-connect">
            <p className="act-connect-title">{ACTIVITY.connect.title}</p>
            <p className="act-connect-body">{ACTIVITY.connect.body}</p>
            <button type="button" className="btn btn-primary" onClick={connect} data-cursor="hover">
              {ACTIVITY.connect.cta}
            </button>
          </div>
        ) : (
          <>
            <div className="act-tabs">
              <div className="asset-tabs" role="tablist" aria-label={ACTIVITY.tabsLabel}>
                {(["inbox", "following"] as const).map((id) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "asset-tab active" : "asset-tab"} onClick={() => setTab(id)} data-cursor="hover">
                    {ACTIVITY.tabs[id]}
                  </button>
                ))}
              </div>
              <NotificationsControl />
            </div>
            {tab === "inbox" ? (
              <ActivityList feed={inbox.feed} failed={inbox.failed} units={units} showWho={false} empty={ACTIVITY.empty.inbox} />
            ) : (
              <div className="act-following">
                <section>
                  <SectionHeader index="01" title={ACTIVITY.friends.title} desc={ACTIVITY.friends.desc} eyebrow={ACTIVITY.friends.meta} className="lb-section-head" />
                  <FriendsBoard />
                </section>
                <section>
                  <SectionHeader index="02" title={ACTIVITY.calls.title} desc={ACTIVITY.calls.desc} className="lb-section-head" />
                  <ActivityList feed={following.feed} failed={following.failed} units={units} showWho empty={followsNobody ? ACTIVITY.empty.following : ACTIVITY.empty.followingQuiet} />
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
