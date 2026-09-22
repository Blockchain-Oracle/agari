import { TICKERS } from "@agari/core/market";
import { addressSchema } from "@agari/core/types";
import { proofRows } from "@agari/db";
import { BadRequest, type IndexQuery } from "./queries";

/** Ticker → Pyth feed hex (no `0x`), the `print_archive.feed` of a Pyth print: the trial feed, or a valuation lane's index (S20); `@agari/db` does not import core. */
const PYTH_FEEDS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(TICKERS).flatMap((t) => {
    const feed = t.pythFeedId ?? (t.kind === "valuation" ? t.pythIndexFeedId : null);
    return feed ? [[t.symbol, feed.replace(/^0x/, "").toLowerCase()]] : [];
  }),
);

/** No print is admitted later than 900 s after its boundary (the missing-print void deadline); past it the set is final. */
const PRINT_ADMISSION_SEC = 900;
const PROVEN_CACHE = "public, s-maxage=60, stale-while-revalidate=240";

/** Every print that can arrive has, and every Pyth print's replay is verified (or verified, then closed). */
function proven(rows: readonly Record<string, unknown>[], nowSec: number): boolean {
  if (!rows.some((r) => r.which === 1)) return false;
  const lastBoundarySec = Math.max(...rows.map((r) => Number(r.source_ts_sec)));
  if (nowSec - lastBoundarySec <= PRINT_ADMISSION_SEC) return false;
  return rows.every((r) => r.source !== 1 || r.proof_state === "verified" || r.proof_state === "closed");
}

/**
 * Lane 5d: `proofs/:market` (proof-analytics.md §1): each recorded print with its archive evidence and stored replay.
 * Rows answer with the 2 s public cache until the Window is proven, then `s-maxage=60` (§3); `run` sets it, and the
 * route reads `cacheControl` after `run` resolves.
 */
export function resolveProofQuery(path: readonly string[], _query: Record<string, string>): IndexQuery | null {
  const [head, market, ...rest] = path;
  if (head !== "proofs") return null;
  if (market === undefined || rest.length > 0) return null;
  const parsed = addressSchema.safeParse(market);
  if (!parsed.success) throw new BadRequest(`market: ${parsed.error.issues[0]?.message ?? "not an address"}`);
  const id = parsed.data;
  const query: IndexQuery = {
    scope: "public",
    run: async (_reader, db) => {
      const rows = await proofRows(db, id, PYTH_FEEDS);
      if (proven(rows, Math.floor(Date.now() / 1000))) query.cacheControl = PROVEN_CACHE;
      return rows;
    },
  };
  return query;
}
