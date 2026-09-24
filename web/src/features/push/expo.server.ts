/**
 * Expo's push service, spoken directly (no SDK: two POSTs). Expo forwards to APNs and FCM with the credentials EAS
 * holds for the app. A ticket error or a later receipt of `DeviceNotRegistered` means the install is gone: the caller
 * retires the token. `EXPO_ACCESS_TOKEN` is sent when set (needed once the project enables enhanced push security).
 */

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo's documented batch limits. */
const SEND_BATCH = 100;
const RECEIPT_BATCH = 300;
/** Expo asks for receipts to be read no sooner than this after sending (and keeps them a day). */
const RECEIPT_AFTER_MS = 15 * 60_000;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  /** iOS groups by thread; one Window's news stacks together. */
  threadId?: string;
  channelId?: string;
  priority: "high" | "default";
}

interface Ticket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface SendOutcome {
  sent: number;
  failed: number;
  /** Tokens Expo says no longer exist. */
  dead: string[];
  /** The first error Expo gave, for the drain's reply. */
  firstError: string | null;
}

/** Tickets waiting for their receipt: id → token. Per process; a restart loses only the dead-token hint. */
const pending = new Map<string, { token: string; sentAtMs: number }>();

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`expo push ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: T }).data;
}

export async function sendExpo(messages: readonly ExpoMessage[], nowMs: number): Promise<SendOutcome> {
  const out: SendOutcome = { sent: 0, failed: 0, dead: [], firstError: null };
  for (let i = 0; i < messages.length; i += SEND_BATCH) {
    const batch = messages.slice(i, i + SEND_BATCH);
    const tickets = await post<Ticket[]>(SEND_URL, batch);
    tickets.forEach((ticket, j) => {
      const token = batch[j]!.to;
      if (ticket.status === "ok") {
        out.sent += 1;
        if (ticket.id) pending.set(ticket.id, { token, sentAtMs: nowMs });
        return;
      }
      out.failed += 1;
      out.firstError ??= ticket.details?.error ?? ticket.message ?? "error";
      if (ticket.details?.error === "DeviceNotRegistered") out.dead.push(token);
    });
  }
  return out;
}

/** Reads the receipts that are due and returns the tokens they report dead. */
export async function collectDeadFromReceipts(nowMs: number): Promise<string[]> {
  const due = [...pending.entries()].filter(([, p]) => nowMs - p.sentAtMs >= RECEIPT_AFTER_MS).map(([id]) => id);
  const dead: string[] = [];
  for (let i = 0; i < due.length; i += RECEIPT_BATCH) {
    const ids = due.slice(i, i + RECEIPT_BATCH);
    const receipts = await post<Record<string, Ticket>>(RECEIPTS_URL, { ids });
    for (const id of ids) {
      const receipt = receipts[id];
      const token = pending.get(id)?.token;
      pending.delete(id);
      if (token && receipt?.status === "error" && receipt.details?.error === "DeviceNotRegistered") dead.push(token);
    }
  }
  return dead;
}
