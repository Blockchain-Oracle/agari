/**
 * `print_proofs` reads and writes (schema-proofs.ts; proof-analytics.md §1, §2.6; lane 5d). The replay's store
 * (`@agari/markets/proof` `ProofStore`, matched structurally: integers stay decimal strings) and the proof page's
 * `proofs/:market` rows. Only the replay writes here; `idx_*` and `print_archive` are read, never written.
 */
import type postgres from "postgres";
import { ensureSchema } from "./migrate";

type Sql = postgres.Sql;
type Row = Record<string, unknown>;

/** `pg_advisory_xact_lock(class, T)`: one claim per boundary at a time across processes. */
const PROOF_LOCK_CLASS = 5_004;

type ProofState = "posting" | "verified" | "failed" | "closed";

export interface ProofVerifiedInput {
  feed: string;
  boundarySec: number;
  receiver: string;
  priceUpdate: string;
  verification: "full" | "partial";
  price: string;
  conf: string;
  expo: number;
  publishTimeSec: number;
  prevPublishTimeSec: number;
  postedSlot: string;
  postSignatures: string[];
  payer: string;
  postedAtMs: number;
}

export function proofStore(sql: Sql) {
  return {
    async print(market: string, which: number) {
      await ensureSchema();
      const [row] = await sql<Array<{ source: number; symbol: string | null; price: string; source_ts_sec: string; signature: string }>>`
        SELECT p.source, m.symbol, p.price::text, p.source_ts_sec::text, p.signature
        FROM idx_prints p JOIN idx_markets m ON m.market = p.market WHERE p.market = ${market} AND p.which = ${which}`;
      return row ? { market, which, source: row.source, symbol: row.symbol, price: row.price, sourceTsSec: Number(row.source_ts_sec), signature: row.signature } : null;
    },

    async archivedPyth(feed: string, boundarySec: number): Promise<string | null> {
      await ensureSchema();
      const [row] = await sql<Array<{ payload: string }>>`SELECT payload FROM print_archive WHERE source = 'pyth' AND feed = ${feed} AND boundary_sec = ${boundarySec}`;
      return row?.payload ?? null;
    },

    async claim(claim: { boundarySec: number; feeds: ReadonlyArray<{ feed: string; symbol: string }>; payer: string; nowMs: number; staleMs: number }) {
      await ensureSchema();
      const feeds = claim.feeds.map((f) => f.feed);
      return sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(${PROOF_LOCK_CLASS}::int, ${claim.boundarySec}::int)`;
        const rows = await tx<Array<{ state: ProofState; posted_at_ms: string | null }>>`
          SELECT state, posted_at_ms::text FROM print_proofs WHERE boundary_sec = ${claim.boundarySec} AND feed = ANY(${feeds}::text[])`;
        const live = rows.find((r) => r.state === "verified" || (r.state === "posting" && Number(r.posted_at_ms ?? 0) > claim.nowMs - claim.staleMs));
        if (live) return { claimed: false as const, state: live.state };
        const values = claim.feeds.map((f) => ({ feed: f.feed, boundary_sec: claim.boundarySec, symbol: f.symbol, source: "pyth", state: "posting", payer: claim.payer, posted_at_ms: claim.nowMs }));
        await tx`
          INSERT INTO print_proofs ${tx(values, "feed", "boundary_sec", "symbol", "source", "state", "payer", "posted_at_ms")}
          ON CONFLICT (feed, boundary_sec) DO UPDATE SET state = 'posting', symbol = EXCLUDED.symbol, payer = EXCLUDED.payer,
            posted_at_ms = EXCLUDED.posted_at_ms, error = NULL, close_signature = NULL, closed_at_ms = NULL`;
        return { claimed: true as const };
      });
    },

    async verified(rows: readonly ProofVerifiedInput[]): Promise<void> {
      await ensureSchema();
      await sql.begin(async (tx) => {
        for (const r of rows) {
          await tx`
            UPDATE print_proofs SET state = 'verified', receiver = ${r.receiver}, price_update = ${r.priceUpdate}, verification = ${r.verification},
              price = ${r.price}, conf = ${r.conf}, expo = ${r.expo}, publish_time_sec = ${r.publishTimeSec}, prev_publish_time_sec = ${r.prevPublishTimeSec},
              posted_slot = ${r.postedSlot}, post_signatures = ${r.postSignatures}::text[], payer = ${r.payer}, error = NULL, posted_at_ms = ${r.postedAtMs},
              close_signature = NULL, closed_at_ms = NULL
            WHERE feed = ${r.feed} AND boundary_sec = ${r.boundarySec}`;
        }
      });
    },

    async failed(feeds: readonly string[], boundarySec: number, error: string): Promise<void> {
      await ensureSchema();
      await sql`UPDATE print_proofs SET state = 'failed', error = ${error} WHERE boundary_sec = ${boundarySec} AND feed = ANY(${feeds as string[]}::text[]) AND state = 'posting'`;
    },

    async openProofs() {
      await ensureSchema();
      const rows = await sql<Array<{ feed: string; boundary_sec: string; price_update: string; posted_at_ms: string }>>`
        SELECT feed, boundary_sec::text, price_update, posted_at_ms::text FROM print_proofs WHERE state = 'verified' AND price_update IS NOT NULL ORDER BY boundary_sec`;
      return rows.map((r) => ({ feed: r.feed, boundarySec: Number(r.boundary_sec), priceUpdate: r.price_update, postedAtMs: Number(r.posted_at_ms) }));
    },

    async closed(rows: ReadonlyArray<{ feed: string; boundarySec: number }>, closeSignature: string, closedAtMs: number): Promise<void> {
      await ensureSchema();
      await sql.begin(async (tx) => {
        for (const r of rows) {
          await tx`UPDATE print_proofs SET state = 'closed', close_signature = ${closeSignature}, closed_at_ms = ${closedAtMs} WHERE feed = ${r.feed} AND boundary_sec = ${r.boundarySec} AND state = 'verified'`;
        }
      });
    },

    async activity(sinceMs: number, staleMs: number, nowMs: number) {
      await ensureSchema();
      const [row] = await sql<Array<{ boundaries: number; posting: number }>>`
        SELECT count(DISTINCT boundary_sec) FILTER (WHERE posted_at_ms >= ${sinceMs})::int AS boundaries,
               count(DISTINCT boundary_sec) FILTER (WHERE state = 'posting' AND posted_at_ms > ${nowMs - staleMs})::int AS posting
        FROM print_proofs WHERE posted_at_ms >= ${Math.min(sinceMs, nowMs - staleMs)}`;
      return { boundaries: row?.boundaries ?? 0, posting: row?.posting ?? 0 };
    },
  };
}

export type ProofStoreDb = ReturnType<typeof proofStore>;

/**
 * `proofs/:market`: one row per recorded print of the Window, with its archived evidence and any stored replay.
 * `pythFeeds` maps a ticker to its Pyth feed hex (core's registry, passed in because `@agari/db` does not import core).
 * Archive and proof columns are prefixed (`archive_*`, `proof_*`) where they would shadow a print column.
 */
export async function proofRows(sql: Sql, market: string, pythFeeds: Readonly<Record<string, string>>): Promise<Row[]> {
  await ensureSchema();
  return sql`
    SELECT p.market, p.which, p.source, p.price::text, p.expo, p.source_ts_sec::text, p.signers, p.copied, p.recorded_ts_sec::text, p.signature,
      m.symbol, a.feed AS archive_feed, a.signers AS archive_signers, a.fetched_at_ms::text AS archive_fetched_at_ms,
      a.archived_at_ms::text AS archive_archived_at_ms, octet_length(a.payload) AS archive_payload_bytes,
      encode(sha256(convert_to(a.payload, 'UTF8')), 'hex') AS archive_payload_sha256,
      CASE WHEN a.source = 'redstone' THEN (SELECT array_agg(DISTINCT e->>'signerAddress') FROM json_array_elements(a.payload::json) e) END AS archive_signer_addresses,
      CASE WHEN a.source = 'redstone' THEN (SELECT max((e->>'timestampMilliseconds')::bigint) FROM json_array_elements(a.payload::json) e)::text END AS archive_package_ts_ms,
      pr.state AS proof_state, pr.receiver AS proof_receiver, pr.price_update AS proof_price_update, pr.verification AS proof_verification,
      pr.price::text AS proof_price, pr.conf::text AS proof_conf, pr.expo AS proof_expo, pr.publish_time_sec::text AS proof_publish_time_sec,
      pr.prev_publish_time_sec::text AS proof_prev_publish_time_sec, pr.posted_slot::text AS proof_posted_slot, pr.post_signatures AS proof_post_signatures,
      pr.close_signature AS proof_close_signature, pr.payer AS proof_payer, pr.error AS proof_error, pr.posted_at_ms::text AS proof_posted_at_ms,
      pr.closed_at_ms::text AS proof_closed_at_ms
    FROM idx_prints p
    JOIN idx_markets m ON m.market = p.market
    LEFT JOIN print_archive a ON a.boundary_sec = p.source_ts_sec AND (
      (p.source = 1 AND a.source = 'pyth' AND a.feed = (${sql.json({ ...pythFeeds })}::jsonb ->> m.symbol)) OR
      (p.source = 2 AND a.source = 'redstone' AND a.feed = m.symbol))
    LEFT JOIN print_proofs pr ON p.source = 1 AND pr.feed = a.feed AND pr.boundary_sec = p.source_ts_sec
    WHERE p.market = ${market}
    ORDER BY p.which`;
}
