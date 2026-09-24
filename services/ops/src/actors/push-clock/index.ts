/**
 * push-clock (S26.4): the phone push drain's clock. Every tick it asks web's `/api/push/drain` to send whatever the
 * registered phones are owed; the choosing and the words live in web beside the in-tab notifications, so a push and
 * an in-app alert can never disagree. Heartbeat detail = the last drain's report (devices, sent, failed, retired).
 *
 * Env: `PUSH_DRAIN_SECRET` (shared with web; without it the actor idles and says why), `PUSH_DRAIN_URL` (default
 * `<NEXT_PUBLIC_SITE_URL>/api/push/drain`), `PUSH_CLOCK_MS` (default 15 s, the inbox's own poll).
 */
import { runActor, type Log } from "../../runtime/actor";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://useagari.xyz").replace(/\/+$/, "");
const EVERY_MS = Number(process.env.PUSH_CLOCK_MS) || 15_000;
/** Idle re-check when the secret is missing: nothing to do until someone sets it and restarts. */
const UNCONFIGURED_MS = 10 * 60_000;

interface DrainReport {
  configured: boolean;
  devices: number;
  wallets: number;
  sent: number;
  failed: number;
  retired: number;
  firstError: string | null;
}

export async function startPushClock(log: Log): Promise<{ stop: () => void }> {
  const secret = process.env.PUSH_DRAIN_SECRET?.trim() ?? "";
  const url = process.env.PUSH_DRAIN_URL?.trim() || `${SITE_URL}/api/push/drain`;
  const { stop } = runActor({
    name: "push-clock",
    log,
    dryRun: false,
    everyMs: EVERY_MS,
    pass: async () => {
      if (!secret) return { why: "PUSH_DRAIN_SECRET not set: no phone push is sent", nextDelayMs: UNCONFIGURED_MS };
      const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60_000) });
      if (res.status === 409) return { why: "previous drain still running" };
      if (!res.ok) throw new Error(`drain ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const report = (await res.json()) as DrainReport;
      if (!report.configured) return { why: "web has no database: no phone push is sent", detail: { ...report }, nextDelayMs: UNCONFIGURED_MS };
      const error = report.firstError ? ` · first error ${report.firstError}` : "";
      return {
        why: `${report.devices} phones on ${report.wallets} wallets · sent ${report.sent}, failed ${report.failed}, retired ${report.retired}${error}`,
        detail: { ...report, url },
      };
    },
  });
  return { stop };
}
