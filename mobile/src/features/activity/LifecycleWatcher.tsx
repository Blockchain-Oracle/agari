import { marketsProvider } from "@agari/markets";
import { useEffect, useRef } from "react";
import { selectAnnouncements, type WatchState } from "@/features/activity/announce";
import { LIFECYCLE } from "@/features/activity/copy";
import { notificationOf } from "@/features/activity/describe";
import { useInboxFeed, useMoneyUnits } from "@/features/activity/useActivity";
import { localFillSignatures } from "@/features/room/record-bet";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { readCursor, recordAnnounced } from "./lifecycle-cursor";

/**
 * web `LifecycleWatcher`, mounted once at the root: while a wallet is connected it reads the inbox (the same query
 * /activity shows) and, for each event new since it mounted, raises an in-app toast — a fill this app did not send, a
 * win, a loss, a void, a payout waiting or paid automatically. Web also raises a browser notification because it has
 * no Web Push; the phone's system notifications come from the server's push instead, so they are never sent twice.
 * Renders nothing.
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
