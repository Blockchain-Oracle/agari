import { TICKER_SYMBOLS } from "@agari/core/market";
import { addressSchema } from "@agari/core/types";
import type { Db, IdxRow, IndexReader } from "@agari/db";
import { z } from "zod";
import { resolveArchiveQuery } from "./queries-archive";
import { resolveProofQuery } from "./queries-proof";
import { resolveStatusQuery } from "./queries-status";
import { resolveTapeQuery } from "./queries-tape";

/**
 * The `/api/index/*` path table (first-call.md §5): each entry validates its path segments and query, then runs one
 * `idx/read.ts` query. Integers stay the decimal strings Postgres returns; limits are clamped by the reader (≤ 1,000).
 */
export interface IndexQuery {
  /** `wallet/*` answers are private to the wallet and never cached by a CDN. */
  scope: "public" | "wallet";
  /** Overrides the public 2 s cache for immutable rows (e.g. a verified proof: `public, s-maxage=60`). Wallet scope ignores it. */
  cacheControl?: string;
  /** `db` is for lane readers with their own SQL (`idx/read-{tape,status}.ts`, `proofs.ts`; proof-analytics.md §1). */
  run(reader: IndexReader, db: Db): Promise<IdxRow[]>;
}

export class BadRequest extends Error {}

const int = z.coerce.number().int().nonnegative();
const optionalInt = int.optional();
const flag = z.enum(["0", "1"]).optional().transform((v) => v === "1");
const address = addressSchema;
const symbol = z.enum(TICKER_SYMBOLS);
const ids = z
  .string()
  .transform((raw) => raw.split(",").filter(Boolean))
  .pipe(z.array(address).max(200))
  .optional();

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  return parsed.data;
}

const marketsQuery = z.object({
  state: z.enum(["open", "resolved", "voided"]).optional(),
  symbol: symbol.optional(),
  series: address.optional(),
  expiryFrom: optionalInt,
  expiryTo: optionalInt,
  limit: optionalInt,
  settled: flag,
  ids,
});
const fillsQuery = z.object({ market: address.optional(), book: address.optional(), since: optionalInt, limit: optionalInt, offset: optionalInt });
const pageQuery = z.object({ limit: optionalInt, offset: optionalInt });
const rangeQuery = z.object({ from: int, to: int, limit: optionalInt });

function walletQuery(wallet: string, resource: string | undefined, query: Record<string, string>): IndexQuery | null {
  const owner = parse(address, wallet);
  switch (resource) {
    case "fills": {
      const q = parse(fillsQuery, query);
      return { scope: "wallet", run: (r) => r.walletFills(owner, { market: q.market, book: q.book, sinceSec: q.since, limit: q.limit, offset: q.offset }) };
    }
    case "positions": {
      const q = parse(z.object({ unredeemed: flag, limit: optionalInt }), query);
      return { scope: "wallet", run: (r) => r.positions(owner, { unredeemedOnly: q.unredeemed, limit: q.limit }) };
    }
    case "actions": {
      const q = parse(pageQuery, query);
      return { scope: "wallet", run: (r) => r.walletActions(owner, q) };
    }
    case "orders": {
      const q = parse(z.object({ market: address.optional(), open: flag, limit: optionalInt }), query);
      return { scope: "wallet", run: (r) => r.orders({ owner, market: q.market, openOnly: q.open, limit: q.limit }) };
    }
    default:
      return null;
  }
}

/** Null when the path names nothing; throws `BadRequest` when it does but a parameter is malformed. */
export function resolveIndexQuery(path: readonly string[], query: Record<string, string>, programId: string): IndexQuery | null {
  // S5 lane paths (`tape/*` 5b, `status/*` sub-paths 5c, `proofs/*` 5d) resolve in their own files first.
  const lane = resolveTapeQuery(path, query) ?? resolveStatusQuery(path, query, programId) ?? resolveProofQuery(path, query) ?? resolveArchiveQuery(path, query);
  if (lane) return lane;
  const [head, second, third, ...rest] = path;
  if (rest.length > 0) return null;
  switch (head) {
    case "markets": {
      if (third !== undefined) return null;
      if (second !== undefined) {
        const market = parse(address, second);
        return { scope: "public", run: (r) => r.markets({ market, limit: 1 }) };
      }
      const q = parse(marketsQuery, query);
      if (q.ids) {
        const list = q.ids;
        return { scope: "public", run: (r) => r.marketsByIds(list) };
      }
      return {
        scope: "public",
        run: (r) => r.markets({ state: q.state, symbol: q.symbol, series: q.series, settled: q.settled, expiryFromSec: q.expiryFrom, expiryToSec: q.expiryTo, limit: q.limit }),
      };
    }
    case "wallet":
      return second === undefined ? null : walletQuery(second, third, query);
    case "fills": {
      if (second !== undefined) return null;
      const q = parse(fillsQuery, query);
      if (!q.market && !q.book) throw new BadRequest("fills needs market or book");
      return { scope: "public", run: (r) => r.fills({ market: q.market, book: q.book, sinceSec: q.since, limit: q.limit, offset: q.offset }) };
    }
    case "prints": {
      if (second === undefined || third !== undefined) return null;
      const ticker = parse(symbol, second);
      const q = parse(rangeQuery, query);
      return { scope: "public", run: (r) => r.printHistory(ticker, q.from, q.to, q.limit) };
    }
    case "candles": {
      if (second === undefined || third !== undefined) return null;
      const market = parse(address, second);
      const q = parse(rangeQuery, query);
      return { scope: "public", run: (r) => r.candles(market, q.from, q.to) };
    }
    case "status":
      return second === undefined ? { scope: "public", run: async (r) => [await r.status(programId)] } : null;
    default:
      return null;
  }
}
