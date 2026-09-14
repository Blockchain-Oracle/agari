import { calendarFromAlpaca, type SessionCalendar } from "@agari/core/market";

/** Alpaca `GET /v2/calendar` for `[fromDate, toDate]` (ET dates). Server-only keys; throws on HTTP or shape errors. */
export async function fetchAlpacaCalendar(fromDate: string, toDate: string, env: NodeJS.ProcessEnv = process.env): Promise<SessionCalendar> {
  const { ALPACA_KEY_ID, ALPACA_SECRET_KEY } = env;
  if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) throw new Error("ALPACA_KEY_ID / ALPACA_SECRET_KEY are not set");
  const base = (env.ALPACA_ENDPOINT || "https://paper-api.alpaca.markets/v2").replace(/\/+$/, "");
  const res = await fetch(`${base}/calendar?start=${fromDate}&end=${toDate}`, {
    headers: { "APCA-API-KEY-ID": ALPACA_KEY_ID, "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Alpaca calendar HTTP ${res.status}`);
  return calendarFromAlpaca(await res.json(), fromDate, toDate);
}
