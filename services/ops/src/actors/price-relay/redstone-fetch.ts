/**
 * RedStone gateway fetches (no key). One historical request at T carries every feed (≈ 1.9 MB), so the relay fetches
 * a boundary once and cuts each feed's array out of the response text: the archive keeps those exact bytes, and values
 * are parsed from source text, never through a float.
 */
import { decimalToE8, packagesAt, parseGatewayJson, redstoneHistoricalUrl, redstoneMedianE8, type RedStonePackage } from "@agari/markets/ops/prints";

export interface GatewayResponse {
  text: string;
  fetchedAtMs: number;
  gateway: string;
}

const LATEST_PATH = "/data-packages/latest/redstone-primary-prod";

async function getFirst(urls: string[]): Promise<GatewayResponse> {
  let last = "no gateway configured";
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) return { text, fetchedAtMs: Date.now(), gateway: new URL(url).origin };
      last = `HTTP ${res.status} from ${new URL(url).origin}`;
    } catch (error) {
      last = `${new URL(url).origin}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  throw new Error(`RedStone gateways failed (${last})`);
}

export const fetchRedstoneAt = (tSec: number, gateways: string[]) => getFirst(gateways.map((g) => redstoneHistoricalUrl(tSec, g)));
export const fetchRedstoneLatest = (gateways: string[]) => getFirst(gateways.map((g) => `${g}${LATEST_PATH}`));

/** The exact source text of the top-level `"<feed>": [ … ]` array, or null when the feed is absent. */
export function feedJson(text: string, feed: string): string | null {
  const key = `"${feed}":[`;
  const at = text.indexOf(key);
  if (at === -1) return null;
  const start = at + key.length - 1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export interface FeedAtT {
  /** Exact gateway text of the feed's array. */
  json: string;
  /** Single-feed packages at exactly T, one per configured signer. */
  packages: RedStonePackage[];
  /** The SDK median of those values, × 10⁸; null when there are none. */
  medianE8: bigint | null;
}

/** Packages at T from configured signers only: one unknown signer would refuse the whole print (D-007). */
export function feedAt(text: string, feed: string, tSec: number, signers: ReadonlySet<string>): FeedAtT | null {
  const json = feedJson(text, feed);
  if (!json) return null;
  const parsed = parseGatewayJson(`{"f":${json}}`);
  const packages = packagesAt({ [feed]: parsed.f ?? [] }, feed, tSec).filter((p) => signers.has(p.signerAddress.toLowerCase()));
  const medianE8 = packages.length ? redstoneMedianE8(packages.map((p) => decimalToE8(String(p.dataPoints[0]!.value)))) : null;
  return { json, packages, medianE8 };
}

/** The newest timestamp's packages of a feed in a `latest` response, as a median × 10⁸. */
export function latestMedian(text: string, feed: string, signers: ReadonlySet<string>): { priceE8: bigint; publishTimeSec: number } | null {
  const json = feedJson(text, feed);
  if (!json) return null;
  const all = (parseGatewayJson(`{"f":${json}}`).f ?? []).filter((p) => p.dataPoints.length === 1 && signers.has(p.signerAddress.toLowerCase()));
  if (all.length === 0) return null;
  const newest = Math.max(...all.map((p) => p.timestampMilliseconds));
  const values = all.filter((p) => p.timestampMilliseconds === newest).map((p) => decimalToE8(String(p.dataPoints[0]!.value)));
  return { priceE8: redstoneMedianE8(values), publishTimeSec: Math.floor(newest / 1000) };
}
