/** Hermes (Pyth trial) fetches. `PYTH_API_KEY` is sent as a Bearer header only: never logged, never in a URL. */
import { toE8 } from "@agari/markets/ops/prints";

export const HERMES = "https://hermes.pyth.network";

export interface PythParsed {
  feedIdHex: string;
  price: bigint;
  conf: bigint;
  expo: number;
  publishTimeSec: number;
  prevPublishTimeSec: number | null;
  priceE8: bigint;
}

export interface PythBoundary {
  tSec: number;
  /** Exact response text (the archive payload). */
  text: string;
  fetchedAtMs: number;
  updatesBase64: string[];
  parsed: PythParsed[];
}

export type PythFetch = { ok: true; boundary: PythBoundary } | { ok: false; status: number; authFailed: boolean };

type RawParsed = { id: string; price: { price: string; conf: string; expo: number; publish_time: number }; metadata?: { prev_publish_time?: number } };

export function parsePythEntries(entries: RawParsed[]): PythParsed[] {
  return entries.map((p) => {
    const price = BigInt(p.price.price);
    return {
      feedIdHex: p.id.replace(/^0x/, "").toLowerCase(),
      price,
      conf: BigInt(p.price.conf),
      expo: p.price.expo,
      publishTimeSec: p.price.publish_time,
      prevPublishTimeSec: p.metadata?.prev_publish_time ?? null,
      priceE8: toE8(price, p.price.expo),
    };
  });
}

/** `GET /v2/updates/price/{T}` for `feedIds` (lower-case hex). Not-yet-available and HTTP errors come back as `ok: false`. */
export async function fetchPythAt(tSec: number, feedIds: readonly string[], key: string): Promise<PythFetch> {
  const ids = feedIds.map((id) => `ids[]=${id}`).join("&");
  try {
    const res = await fetch(`${HERMES}/v2/updates/price/${tSec}?${ids}&encoding=base64&parsed=true`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, status: res.status, authFailed: res.status === 401 || res.status === 403 };
    const text = await res.text();
    const body = JSON.parse(text) as { binary: { data: string[] }; parsed: RawParsed[] };
    return { ok: true, boundary: { tSec, text, fetchedAtMs: Date.now(), updatesBase64: body.binary.data, parsed: parsePythEntries(body.parsed ?? []) } };
  } catch {
    return { ok: false, status: 0, authFailed: false };
  }
}
