/**
 * Whether the venue's Pyth key may read each valuation index (S20, D-125). Entitlement is per key and per group:
 * the trial key reads `Equity.US.TSLA/USD` (200) and is refused `Equity.Index.OPENAI/USD` and `…ANTHROPIC/USD`
 * (403 `requires group pyth-indices`). One 401/403 on the trial path latches `BoundaryCache.pythAuthFailed` and stops
 * TSLA/QQQ/VOO settlement and the spot stream, so an index feed is never fetched anywhere until this store says
 * `entitled`, and a refusal met on an index feed is recorded here rather than latched.
 *
 * The probe is one `GET /v2/updates/price/latest` per feed per hour with the Bearer key, alone in its request. A 200
 * makes the feed entitled and measures its publish spacing and `conf / price`; a 401/403 makes it denied; anything
 * else (a timeout, a 5xx) keeps the state it had, because a transient error is not an answer about entitlement and
 * flipping a live lane to "unknown" would void its Window. Without a key every feed is `unknown` and nothing probes.
 * The state switches on with no deploy: the next hourly probe after a key with `pyth-indices` lands answers 200.
 */
import { PRE_IPO_TICKERS, TICKERS, type PreIpoSymbol } from "@agari/core/market";
import { errorText, redact } from "./env";

export const HERMES_LATEST_URL = "https://hermes.pyth.network/v2/updates/price/latest";
export const PROBE_EVERY_MS = 60 * 60_000;
/** A probe that answered nothing definitive is retried sooner than the hour. */
export const PROBE_RETRY_MS = 5 * 60_000;
const PROBE_TIMEOUT_MS = 15_000;

export type EntitlementState = "entitled" | "denied" | "unknown";

/** A valuation index the registry knows: the pre-IPO name it prices and its Hermes id (lower-case hex, no `0x`). */
export interface IndexFeed {
  symbol: PreIpoSymbol;
  feedIdHex: string;
}

export interface FeedEntitlement extends IndexFeed {
  state: EntitlementState;
  /** The last definitive HTTP status (200, 401, 403); null before the first answer. */
  status: number | null;
  checkedAtSec: number | null;
  /** The group Hermes named on a refusal (`pyth-indices`), or its words; `no PYTH_API_KEY` without a key. */
  reason: string | null;
  /** Measured on a 200: `publish_time − prev_publish_time` (null when Hermes gave no previous time). */
  publishSpacingSec: number | null;
  /** Measured on a 200: `conf × 10⁴ / price`, truncated. */
  confBps: number | null;
  publishTimeSec: number | null;
  /** The last probe that answered nothing definitive; the state above was kept. */
  lastError: string | null;
}

export interface PythEntitlementStore {
  /** True when a `PYTH_API_KEY` is set: without one nothing probes and every feed stays `unknown`. */
  readonly hasKey: boolean;
  feeds(): readonly FeedEntitlement[];
  feed(feedIdHex: string): FeedEntitlement | null;
  state(feedIdHex: string): EntitlementState;
  /** Whether a Pyth print policy naming this feed may be fetched: any feed that is not a valuation index, or an index that is entitled. */
  usable(feedIdHex: string): boolean;
  entitled(): readonly FeedEntitlement[];
  /** Feeds due a probe now: never probed, an hour since the last answer, or five minutes since a failed one. Empty without a key. */
  due(nowMs?: number): readonly FeedEntitlement[];
  /** One Hermes request for one feed, alone; records the answer. Never throws. */
  probe(feedIdHex: string, nowMs?: number): Promise<FeedEntitlement>;
  /** A consumer that met a 401/403 on this feed alone (the relay, the spot poll) records it here; nothing is latched. */
  markDenied(feedIdHex: string, status: number, reason?: string | null): void;
  /** JSON-safe, keyed by the pre-IPO name: the heartbeat detail and `/session.sources.pythIndex`. */
  snapshot(): Record<string, Omit<FeedEntitlement, "symbol" | "feedIdHex"> & { feedIdHex: string }>;
}

const bare = (hex: string) => hex.replace(/^0x/i, "").toLowerCase();

/** Every valuation index the registry carries, from `Ticker.pythIndexFeedId` on the pre-IPO names. */
export function pythIndexFeeds(): IndexFeed[] {
  return PRE_IPO_TICKERS.flatMap((symbol) => {
    const id = TICKERS[symbol].pythIndexFeedId;
    return id ? [{ symbol: symbol as PreIpoSymbol, feedIdHex: bare(id) }] : [];
  });
}

const INDEX_FEED_IDS: ReadonlySet<string> = new Set(pythIndexFeeds().map((f) => f.feedIdHex));

/** Whether a Pyth feed id is one of the valuation indices (gated), as opposed to a trial feed. */
export const isPythIndexFeed = (feedIdHex: string): boolean => INDEX_FEED_IDS.has(bare(feedIdHex));

/** `requires access to one of the following groups: ["pyth-indices"]` → `pyth-indices`; otherwise the first words. */
export function refusalReason(bodyText: string): string {
  const groups = /groups?:\s*\[([^\]]*)\]/i.exec(bodyText)?.[1];
  if (groups) return groups.replace(/["'\s]/g, "").split(",").filter(Boolean).join(",");
  const words = bodyText.replace(/\s+/g, " ").trim().slice(0, 80);
  return words || "refused";
}

type Parsed = { id: string; price: { price: string; conf: string; expo: number; publish_time: number }; metadata?: { prev_publish_time?: number | null } };

/** Integer `conf × 10⁴ / price`, or null when the price is not positive. */
export function confBpsOf(price: bigint, conf: bigint): number | null {
  return price > 0n ? Number((conf * 10_000n) / price) : null;
}

export function createPythEntitlementStore(input: {
  key: string | undefined;
  log: (why: string) => void;
  feeds?: readonly IndexFeed[];
  fetch?: typeof globalThis.fetch;
}): PythEntitlementStore {
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const hasKey = Boolean(input.key);
  const rows = new Map<string, FeedEntitlement & { nextProbeMs: number }>();
  for (const f of input.feeds ?? pythIndexFeeds()) {
    rows.set(f.feedIdHex, {
      ...f, state: "unknown", status: null, checkedAtSec: null, reason: hasKey ? null : "no PYTH_API_KEY",
      publishSpacingSec: null, confBps: null, publishTimeSec: null, lastError: null, nextProbeMs: 0,
    });
  }
  const describe = describeFeed;
  const strip = (f: FeedEntitlement & { nextProbeMs: number }): FeedEntitlement => {
    const { nextProbeMs: _next, ...rest } = f;
    return rest;
  };

  function settle(f: FeedEntitlement & { nextProbeMs: number }, next: Partial<FeedEntitlement>, nowMs: number, definitive: boolean): void {
    const before = describe(f);
    Object.assign(f, next);
    if (definitive) {
      f.checkedAtSec = Math.floor(nowMs / 1000);
      f.lastError = null;
    }
    f.nextProbeMs = nowMs + (definitive ? PROBE_EVERY_MS : PROBE_RETRY_MS);
    const after = describe(f);
    if (definitive && after !== before) input.log(`pyth-entitlement: ${after}`);
  }

  const store: PythEntitlementStore = {
    hasKey,
    feeds: () => [...rows.values()].map(strip),
    feed: (hex) => {
      const f = rows.get(bare(hex));
      return f ? strip(f) : null;
    },
    state: (hex) => rows.get(bare(hex))?.state ?? "unknown",
    usable: (hex) => !isPythIndexFeed(hex) || rows.get(bare(hex))?.state === "entitled",
    entitled: () => [...rows.values()].filter((f) => f.state === "entitled").map(strip),
    due: (nowMs = Date.now()) => (hasKey ? [...rows.values()].filter((f) => f.nextProbeMs <= nowMs).map(strip) : []),
    async probe(hex, nowMs = Date.now()) {
      const f = rows.get(bare(hex));
      if (!f) throw new Error(`pyth-entitlement: ${bare(hex)} is not a registry valuation index`);
      if (!input.key) {
        settle(f, { state: "unknown", reason: "no PYTH_API_KEY" }, nowMs, false);
        return strip(f);
      }
      try {
        const res = await fetchImpl(`${HERMES_LATEST_URL}?ids[]=${f.feedIdHex}&parsed=true`, { headers: { Authorization: `Bearer ${input.key}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        if (res.status === 401 || res.status === 403) {
          settle(f, { state: "denied", status: res.status, reason: refusalReason(redact(await res.text().catch(() => ""))) }, nowMs, true);
        } else if (res.ok) {
          const body = (await res.json()) as { parsed?: Parsed[] };
          const row = (body.parsed ?? []).find((p) => bare(p.id) === f.feedIdHex);
          if (!row) settle(f, { lastError: "200 without a parsed row for the feed" }, nowMs, false);
          else {
            const price = BigInt(row.price.price);
            const prev = row.metadata?.prev_publish_time ?? null;
            settle(f, {
              state: "entitled", status: 200, reason: null, publishTimeSec: row.price.publish_time,
              publishSpacingSec: prev === null ? null : row.price.publish_time - prev, confBps: confBpsOf(price, BigInt(row.price.conf)),
            }, nowMs, true);
          }
        } else settle(f, { lastError: `Hermes HTTP ${res.status}` }, nowMs, false);
      } catch (error) {
        settle(f, { lastError: errorText(error) }, nowMs, false);
      }
      return strip(f);
    },
    markDenied(hex, status, reason = null) {
      const f = rows.get(bare(hex));
      if (f) settle(f, { state: "denied", status, reason: reason ?? f.reason ?? "refused" }, Date.now(), true);
    },
    snapshot: () => Object.fromEntries([...rows.values()].map((f) => {
      const { symbol, nextProbeMs: _next, ...rest } = f;
      return [symbol, rest];
    })),
  };
  return store;
}

/** `OPENAI denied (403 pyth-indices)`, `OPENAI entitled (200, publishes every 1 s, conf 12 bps)`, `OPENAI unknown (no PYTH_API_KEY)`. */
export function describeFeed(f: FeedEntitlement): string {
  if (f.state === "denied") return `${f.symbol} denied (${f.status}${f.reason ? ` ${f.reason}` : ""})`;
  if (f.state === "entitled") return `${f.symbol} entitled (200${f.publishSpacingSec !== null ? `, publishes every ${f.publishSpacingSec} s` : ""}${f.confBps !== null ? `, conf ${f.confBps} bps` : ""})`;
  return `${f.symbol} unknown${f.reason ? ` (${f.reason})` : f.lastError ? ` (${f.lastError})` : ""}`;
}

/** Every feed's line, ` · `-joined: the actor's why-string. */
export function describeEntitlements(store: PythEntitlementStore): string {
  return store.feeds().map(describeFeed).join(" · ") || "no valuation index in the registry";
}
