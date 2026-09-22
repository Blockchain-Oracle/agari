"use client";

import { NOTIFIED_OUTCOMES, OUTCOME_COLUMN } from "@agari/core/desk";
import { isOk } from "@agari/core/schemas";
import { useEffect, useRef, useState } from "react";
import { sendNotification } from "@/features/alerts";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { RECORD } from "./copy-record";
import { useDeskFeed, useDeskView } from "./useDesk";

/** The feed is asked once a minute while Agari is open; the desk wakes hourly, so this only catches an event sooner. */
const FEED_POLL_MS = 60_000;
const NOTIFIED = new Set<string>([...NOTIFIED_OUTCOMES].map((o) => OUTCOME_COLUMN[o]));
const seenKey = (owner: string) => `agari.desk.seen:101:${owner}`;

function readSeen(owner: string): number | null {
  try {
    const raw = window.localStorage.getItem(seenKey(owner));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}
function writeSeen(owner: string, seq: number): void {
  try {
    window.localStorage.setItem(seenKey(owner), String(seq));
  } catch {
    // storage unavailable: this tab still remembers in state
  }
}

/**
 * The desk speaks only when it matters (plan §5.8): acted, asked, would have acted, blocked by a limit, stopped, failed,
 * money moved. Routine "nothing to do" never rings. The channel is the app's existing pair, an in-app toast plus a
 * system notification if allowed, exactly as the drop bell does. Mounted once beside the other watchers; it reads
 * nothing until a wallet with a desk is connected, and the first read only sets the mark, so old events never ring.
 */
export function DeskWatcher() {
  const { address } = useWalletSession();
  const view = useDeskView(address, address, address !== null);
  const desk = view && isOk(view) ? view.value.desk : null;
  const [since, setSince] = useState<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!address || !desk || armed.current) return;
    const latest = view && isOk(view) ? (view.value.latest?.seq ?? 0) : 0;
    const seen = readSeen(address);
    const mark = seen === null ? latest : Math.min(seen, latest) === seen ? seen : latest;
    writeSeen(address, mark);
    setSince(mark);
    armed.current = true;
  }, [address, desk, view]);

  const feed = useDeskFeed(desk?.id ?? null, address, since ?? 0, since !== null, FEED_POLL_MS);
  useEffect(() => {
    if (!address || since === null || !feed || !isOk(feed)) return;
    const fresh = feed.value.items.filter((item) => item.seq > since).sort((a, b) => a.seq - b.seq);
    if (fresh.length === 0) return;
    const practice = desk?.address === null;
    for (const item of fresh) {
      const rings = item.kind === "money" || (item.outcome !== null && NOTIFIED.has(item.outcome));
      if (!rings) continue;
      const title = item.kind === "money" ? RECORD.watcher.money : RECORD.watcher.title(RECORD.outcome[item.outcome as keyof typeof RECORD.outcome]);
      const body = `${item.summary} ${practice ? RECORD.watcher.practiceFoot : RECORD.watcher.foot}`;
      notify.neutral(title, body);
      sendNotification(title, body);
    }
    const last = fresh[fresh.length - 1]!.seq;
    writeSeen(address, last);
    setSince(last);
  }, [feed, since, address, desk]);

  return null;
}
