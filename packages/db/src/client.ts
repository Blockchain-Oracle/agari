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

/** Hosts that cannot hold a public certificate, so a server there will not be offering TLS. */
function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  // A Docker/Compose service name has no dot at all — `postgres`, or Coolify's `cxpo6uaqrvfcjbfyesyvkb6s`.
  if (!host.includes(".")) return true;
  if (/^127\./.test(host) || host === "::1" || host === "[::1]") return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

/**
 * Whether to demand TLS, decided from the connection string itself.
 *
 * `sslmode` in the URL wins, because it is the one place an operator can say what their server does;
 * postgres.js ignores it once `ssl` is passed, so it is read here. With nothing said, TLS is required
 * of any host that could hold a certificate and skipped for the ones that cannot — a container on a
 * private Docker network, a socket on this machine. Demanding it of those fails the connection with
 * "socket disconnected before secure TLS connection was established", which is what took the hosted
 * index down: every read answered `indexer query failed` while the rows sat in the database.
 */
export function sslFor(url: string): "require" | false {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1") ? false : "require";
  }
  const mode = parsed.searchParams.get("sslmode") ?? parsed.searchParams.get("ssl");
  if (mode) return ["disable", "false", "0", "off"].includes(mode.toLowerCase()) ? false : "require";
  return isPrivateHost(parsed.hostname) ? false : "require";
}

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
    // Neon and most hosted Postgres require TLS; a container on a private network does not offer it.
    ssl: sslFor(url),
    onnotice: () => undefined,
  });
  return client;
}

/** True when a database is configured — the honest gate every social surface reads. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
