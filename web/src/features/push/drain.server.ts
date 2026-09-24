import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { listPushDevices, recordPushSent, retirePushTokens, sentPushIds, type PushDevice } from "@agari/db";
import { loadCollateral } from "@agari/markets";
import { LATE_SEC, selectAnnouncements } from "@/features/activity/announce";
import { LIFECYCLE } from "@/features/activity/copy";
import { notificationOf, type MoneyUnits } from "@/features/activity/describe";
import { inboxFeed } from "@/features/activity/feed.server";
import type { ActivityItem } from "@/features/activity/protocol";
import { collectDeadFromReceipts, sendExpo, type ExpoMessage } from "./expo.server";
import { PUSH_KIND_OF, type PushData } from "./protocol";

/**
 * One push drain (S26.4): for every registered phone, the inbox events that are new to it, worded exactly as the
 * in-tab lifecycle notifications word them (`selectAnnouncements` + `notificationOf`), sent through Expo and
 * journalled so the next drain never repeats one. Ops calls this on a clock; nothing here runs on its own.
 */

/** One drain's reach: enough devices for the whole beta; the oldest registrations are served first. */
const DEVICES_MAX = 1_000;
/** Inbox reads run this many wallets at a time. */
const READ_CONCURRENCY = 4;
/** Nothing older than this is read, whatever a device's cursor says (a device off for a week is not flooded). */
const LOOKBACK_SEC = 3_600;

export interface DrainReport {
  configured: boolean;
  devices: number;
  wallets: number;
  sent: number;
  failed: number;
  retired: number;
  firstError: string | null;
}

const EMPTY: DrainReport = { configured: false, devices: 0, wallets: 0, sent: 0, failed: 0, retired: 0, firstError: null };

/** Where a tap lands in the app: the Window, or Portfolio for money waiting to be claimed. */
function pathOf(item: ActivityItem): string {
  if (item.kind === "claimable" || !item.marketId) return "/portfolio";
  return `/markets/${item.marketId}`;
}

async function inPool<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/** The messages one device is owed, and every item id they account for (overflow included, so none come back). */
function messagesFor(device: PushDevice, items: readonly ActivityItem[], sent: ReadonlySet<string>, units: MoneyUnits): { token: string; messages: ExpoMessage[]; ids: string[] } {
  const wanted = items.filter((item) => {
    const kind = PUSH_KIND_OF[item.kind];
    return kind !== null && device.kinds.includes(kind);
  });
  const { announce, overflow } = selectAnnouncements(wanted, { mountSec: device.sinceSec, baselined: true, seen: new Set() }, sent, new Set());
  const channelId = device.platform === "android" ? "activity" : undefined;
  const messages: ExpoMessage[] = [];
  for (const { item, claimBase } of announce) {
    const words = notificationOf(item, units, claimBase);
    if (!words) continue;
    const data: PushData = { path: claimBase !== null ? "/portfolio" : pathOf(item), kind: item.kind, itemId: item.id };
    messages.push({
      to: device.expoToken,
      title: words.title,
      body: words.body,
      data: { ...data },
      sound: "default",
      threadId: item.marketId ?? undefined,
      channelId,
      priority: item.kind === "fill" || item.kind === "resting-filled" ? "default" : "high",
    });
  }
  if (overflow > 0) {
    const words = LIFECYCLE.more(overflow);
    messages.push({ to: device.expoToken, title: words.title, body: words.body, data: { path: "/activity", kind: "more", itemId: "" }, sound: "default", channelId, priority: "default" });
  }
  // Everything this device was eligible to hear is now accounted for: announced, folded into a win, or summarised.
  const floor = device.sinceSec - LATE_SEC;
  const ids = wanted.filter((item) => item.atSec >= floor && !sent.has(item.id)).map((item) => item.id);
  return { token: device.expoToken, messages, ids };
}

export async function drainPush(nowMs: number): Promise<DrainReport> {
  const devices = await listPushDevices(DEVICES_MAX);
  if (devices === null) return EMPTY;
  const report: DrainReport = { ...EMPTY, configured: true, devices: devices.length };

  const receiptsDead = await collectDeadFromReceipts(nowMs).catch(() => []);
  if (devices.length === 0) {
    await retirePushTokens(receiptsDead, nowMs);
    report.retired = receiptsDead.length;
    return report;
  }

  const collateral = await loadCollateral();
  const units: MoneyUnits = isOk(collateral) ? { decimals: collateral.value.decimals, symbol: collateral.value.symbol } : { decimals: null, symbol: "tUSDC" };
  const sentByToken = (await sentPushIds(devices.map((d) => d.expoToken))) ?? new Map<string, Set<string>>();

  const byWallet = new Map<string, PushDevice[]>();
  for (const device of devices) byWallet.set(device.wallet, [...(byWallet.get(device.wallet) ?? []), device]);
  report.wallets = byWallet.size;
  const nowSec = Math.floor(nowMs / 1000);

  const perWallet = await inPool([...byWallet.entries()], READ_CONCURRENCY, async ([wallet, owned]) => {
    const oldest = Math.min(...owned.map((d) => d.sinceSec));
    const feed = await inboxFeed(wallet as Address, Math.max(oldest - LATE_SEC, nowSec - LOOKBACK_SEC));
    return owned.map((device) => messagesFor(device, feed.items, sentByToken.get(device.expoToken) ?? new Set(), units));
  });

  const plans = perWallet.flat();
  const messages = plans.flatMap((p) => p.messages);
  const outcome = messages.length > 0 ? await sendExpo(messages, nowMs) : { sent: 0, failed: 0, dead: [], firstError: null };
  // Journalled after Expo took the batch: a failed POST throws above and the next drain tries the same items again.
  await recordPushSent(plans.flatMap((p) => p.ids.map((itemId) => ({ expoToken: p.token, itemId }))), nowMs);
  const dead = [...new Set([...outcome.dead, ...receiptsDead])];
  await retirePushTokens(dead, nowMs);
  return { ...report, sent: outcome.sent, failed: outcome.failed, retired: dead.length, firstError: outcome.firstError };
}
