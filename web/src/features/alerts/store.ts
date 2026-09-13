/**
 * Stored price-alert rules — ported from `reference/yosuku/lib/priceAlerts.ts`.
 *
 * Device-local, as the reference's are: a rule is a whole-dollar target on one asset,
 * kept in localStorage, and marked triggered once the live price crosses it. Targets are
 * display dollars, not money — nothing here is ever staked or paid — so the reference's
 * float is kept rather than a base-unit bigint.
 *
 * What is added: a subscription. The reference's store has no listeners, which is fine
 * for a component that reads it on mount, but the evaluator (`AlertsWatcher`) has to learn
 * about a rule the moment the button saves it, without a reload.
 */
const STORAGE_KEY = "masayume.priceAlerts";

export type AlertDirection = "above" | "below";

export interface PriceAlert {
  id: string;
  asset: string;
  /** Whole dollars on the oracle's display scale. */
  targetPrice: number;
  direction: AlertDirection;
  createdAtMs: number;
  triggered: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Fires after every local write, and on a `storage` event from another tab. */
export function subscribeAlerts(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function isAlert(value: unknown): value is PriceAlert {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.asset === "string" &&
    typeof a.targetPrice === "number" &&
    (a.direction === "above" || a.direction === "below") &&
    typeof a.createdAtMs === "number" &&
    typeof a.triggered === "boolean"
  );
}

export function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isAlert) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // storage unavailable — the rule lives for this render only
  }
  emit();
}

export function addAlert(asset: string, targetPrice: number, direction: AlertDirection): PriceAlert[] {
  const alerts = loadAlerts();
  alerts.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    asset,
    targetPrice,
    direction,
    createdAtMs: Date.now(),
    triggered: false,
  });
  saveAlerts(alerts);
  return alerts;
}

export function removeAlert(id: string): PriceAlert[] {
  const alerts = loadAlerts().filter((alert) => alert.id !== id);
  saveAlerts(alerts);
  return alerts;
}

/** The rules still waiting on a price, per asset — what the evaluator watches. */
export function pendingAssets(alerts: PriceAlert[]): string[] {
  return [...new Set(alerts.filter((alert) => !alert.triggered).map((alert) => alert.asset))].sort();
}

/**
 * The reference's rule, kept: `above` fires at or over the target, `below` at or under it.
 * Returns the rules that fired and marks them, so one crossing is one notification.
 */
export function checkAlerts(currentPrices: Record<string, number>): PriceAlert[] {
  const alerts = loadAlerts();
  const triggered: PriceAlert[] = [];
  const updated = alerts.map((alert) => {
    if (alert.triggered) return alert;
    const price = currentPrices[alert.asset];
    if (!price) return alert;
    const crossed = alert.direction === "above" ? price >= alert.targetPrice : price <= alert.targetPrice;
    if (!crossed) return alert;
    triggered.push(alert);
    return { ...alert, triggered: true };
  });
  if (triggered.length > 0) saveAlerts(updated);
  return triggered;
}

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
