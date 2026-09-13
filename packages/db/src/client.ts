import postgres from "postgres";

/**
 * The optional Postgres connection.
 *
 * "Optional" is the whole design. Chain truth is never stored here — this holds
 * social records only — so the app must run correctly with no database at all,
 * and every caller has to handle `null` rather than assume a connection. That is
 * what lets the Room ship, and say plainly that it is not connected, before a
 * `DATABASE_URL` exists.
 *
 * `postgres.js` speaks the ordinary wire protocol, so the same code runs against a
 * local Postgres and against Neon over its pooled connection string. The driver is
 * not swapped between environments.
 */
let client: postgres.Sql | null | undefined;

export type Db = postgres.Sql;

export function getDb(): Db | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    client = null;
    return null;
  }
  client = postgres(url, {
    // A Next route is short-lived and there may be many of them; keep the pool small.
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    // Neon and most hosted Postgres require TLS; a local socket does not offer it.
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
    onnotice: () => undefined,
  });
  return client;
}

/** True when a database is configured — the honest gate every social surface reads. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
