/**
 * The visitor's IP, as the deployment's own proxy vouches for it — or null, which callers treat as "cannot verify".
 *
 * Two surfaces meter by IP (the devnet faucet and the proof replay), and both had one rule: trust `x-forwarded-for`
 * on Vercel, invent "local-development" in development, refuse everyone else. Vercel is the platform that
 * overwrites that header at its edge; nothing else was named, so a deployment anywhere else — Coolify behind
 * Cloudflare, say — answered "The faucet could not verify this connection" to every visitor, with the keys set
 * and the budget funded.
 *
 * The operator names the proxy that fronts them, `TRUSTED_PROXY`, and only then is a header believed:
 *   - `cloudflare` → `cf-connecting-ip`, which Cloudflare sets and overwrites on every request it forwards;
 *   - `forwarded`  → the first `x-forwarded-for`, for a proxy that owns that header (Traefik with trusted IPs, nginx);
 *   - `vercel`     → the same header, and `VERCEL=1` (which Vercel itself sets) means the same thing.
 * Unnamed, production stays as it was: no header is trusted and the surface says it cannot verify the connection.
 * That is the honest failure, and it is loud enough that nobody ships without setting this.
 */
export function clientIp(request: Request): string | null {
  const proxy = (process.env.TRUSTED_PROXY ?? (process.env.VERCEL === "1" ? "vercel" : "")).trim().toLowerCase();
  const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim() || null;
  if (proxy === "cloudflare") return first("cf-connecting-ip") ?? first("x-forwarded-for");
  if (proxy === "forwarded" || proxy === "vercel") return first("x-forwarded-for");
  return process.env.NODE_ENV !== "production" ? "local-development" : null;
}

/**
 * The origin a browser sees for this request. Behind a proxy that ends TLS, `request.url` is the scheme the server
 * itself spoke — `http://useagari.xyz` inside the container — while the browser sent `Origin: https://useagari.xyz`,
 * and a same-origin check against `request.url` refused every claim with "Open the faucet from Agari." When a
 * proxy is named (`TRUSTED_PROXY`), its `x-forwarded-proto` is the scheme; otherwise the request's own.
 */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proxy = (process.env.TRUSTED_PROXY ?? (process.env.VERCEL === "1" ? "vercel" : "")).trim();
  const proto = proxy ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() : null;
  const host = (proxy ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() : null) || url.host;
  return `${proto || url.protocol.replace(":", "")}://${host}`;
}
