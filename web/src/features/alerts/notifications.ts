/**
 * System notifications — the alerts store's own helpers (Masayume `store.ts:125-150`), in their own module so a
 * watcher that only notifies (13d's `LifecycleWatcher`) imports no rule store and no UI. Frozen for S13 (spec §5).
 */
export type NotificationState = "unsupported" | "granted" | "denied" | "default";

export function notificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (notificationState() === "unsupported") return false;
  if (Notification.permission === "granted") return true;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** A system notification when permitted; the caller pairs it with an in-app toast either way. */
export function sendNotification(title: string, body: string): void {
  if (notificationState() !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // some embedded browsers expose the API and then refuse the constructor
  }
}
