"use client";

import { useEffect, useState } from "react";
import { notificationState, requestNotificationPermission, type NotificationState } from "@/features/alerts/notifications";
import { useWalletSession } from "@/lib/wallet-session";
import { ActivityList } from "./ActivityList";
import { ACTIVITY } from "./copy";
import { useInboxFeed, useMoneyUnits } from "./useActivity";

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
 * `/activity` — the signed-in inbox (spec §1.6), in `/news`'s page frame: live eyebrow, two-tone headline, the
 * Japanese line, one sentence, then the wire. The inbox shares its cache entry with `LifecycleWatcher`, so opening
 * this page adds no poll.
 */
export function ActivityScreen() {
  const { address, connect } = useWalletSession();
  const units = useMoneyUnits();
  const inbox = useInboxFeed(address);

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
              <div className="asset-tabs">
                <span className="asset-tab active">{ACTIVITY.tabs.inbox}</span>
              </div>
              <NotificationsControl />
            </div>
            <ActivityList feed={inbox.feed} failed={inbox.failed} units={units} showWho={false} empty={ACTIVITY.empty.inbox} />
          </>
        )}
      </div>
    </div>
  );
}
