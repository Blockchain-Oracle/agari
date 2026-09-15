import { TICKERS } from "@agari/core/market";
import { addressSchema } from "@agari/core/types";
import { proofRows } from "@agari/db";
import { BadRequest, type IndexQuery } from "./queries";

/** Ticker → Pyth feed hex (no `0x`), the `print_archive.feed` of a Pyth print; `@agari/db` does not import core. */
const PYTH_FEEDS: Readonly<Record<string, string>> = Object.fromEntries(Object.values(TICKERS).map((t) => [t.symbol, t.pythFeedId.replace(/^0x/, "").toLowerCase()]));

/** Lane 5d: `proofs/:market` (proof-analytics.md §1): each recorded print with its archive evidence and stored replay. */
export function resolveProofQuery(path: readonly string[], _query: Record<string, string>): IndexQuery | null {
  const [head, market, ...rest] = path;
  if (head !== "proofs") return null;
  if (market === undefined || rest.length > 0) return null;
  const parsed = addressSchema.safeParse(market);
  if (!parsed.success) throw new BadRequest(`market: ${parsed.error.issues[0]?.message ?? "not an address"}`);
  const id = parsed.data;
  return { scope: "public", run: (_reader, db) => proofRows(db, id, PYTH_FEEDS) };
}
