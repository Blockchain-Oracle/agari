"use client";

import { marketsProvider } from "@agari/markets";
import { useEffect, useRef } from "react";
import { sendNotification } from "@/features/alerts/notifications";
import { localFillSignatures } from "@/features/room/record-bet";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { selectAnnouncements, type WatchState } from "./announce";
import { LIFECYCLE } from "./copy";
import { notificationOf } from "./describe";
import { readCursor, recordAnnounced } from "./lifecycle-cursor";
import { useInboxFeed, useMoneyUnits } from "./useActivity";

/**
 * In-tab lifecycle notifications (spec §1.6; Q-001, Masayume left them pending; Q-S13-5: no Web Push).
 *
 * Mounted once beside `AlertsWatcher`. While a wallet is connected it reads the inbox (the same 15 s query `/activity`
 * shows, paused while the tab is hidden) and, for each event that is new since this tab mounted, raises a toast and a
 * system notification: a fill this tab did not send, a win, a loss, a void, a payout waiting to be claimed, a payout
 * the settler made automatically, and a copied call once S9/S14 write them. Renders nothing.
 */
export function LifecycleWatcher() {
  const { address } = useWalletSession();
  const { feed } = useInboxFeed(address);
  const { decimals, symbol } = useMoneyUnits();
  const state = useRef<{ wallet: string; watch: WatchState } | null>(null);

  useEffect(() => {
    if (!address) {
      state.current = null;
      return;
    }
    // A new wallet starts its own cursor at this moment: nothing already in its inbox is announced.
    if (state.current?.wallet !== address) {
      state.current = { wallet: address, watch: { mountSec: Math.floor(marketsProvider.nowMs() / 1000), baselined: false, seen: new Set() } };
    }
  }, [address]);

  useEffect(() => {
    const current = state.current;
    if (!address || !feed?.configured || current?.wallet !== address) return;
    const { announce, overflow } = selectAnnouncements(feed.items, current.watch, new Set(readCursor(address).ids), localFillSignatures());
    const sent: { id: string; atSec: number }[] = [];
    for (const { item, claimBase, ids } of announce) {
      const words = notificationOf(item, { decimals, symbol }, claimBase);
      if (!words) continue;
      notify.neutral(words.title, words.body);
      sendNotification(words.title, words.body);
      sent.push(...ids.map((id) => ({ id, atSec: item.atSec })));
    }
    if (overflow > 0) {
      const words = LIFECYCLE.more(overflow);
      notify.neutral(words.title, words.body);
    }
    recordAnnounced(address, sent);
  }, [address, feed, decimals, symbol]);

  return null;
}
