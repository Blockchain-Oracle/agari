import { tapeActions, tapeFills, tapeMarkets } from "@agari/db";
import { z } from "zod";
import { BadRequest, type IndexQuery } from "./queries";

/** Lane 5b: `tape/markets`, `tape/fills`, `tape/actions` (proof-analytics.md §1): the venue-wide scans the board pages. */
const int = z.coerce.number().int().nonnegative();
const page = { limit: int.optional(), offset: int.optional() };
const marketsQuery = z.object({ from: int, to: int, lookback: int, ...page });
const rangeQuery = z.object({ since: int, until: int, ...page });

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  return parsed.data;
}

export function resolveTapeQuery(path: readonly string[], query: Record<string, string>): IndexQuery | null {
  const [head, resource, ...rest] = path;
  if (head !== "tape" || rest.length > 0) return null;
  switch (resource) {
    case "markets": {
      const q = parse(marketsQuery, query);
      return { scope: "public", run: (_r, db) => tapeMarkets(db, { fromSec: q.from, toSec: q.to, lookbackSec: q.lookback, limit: q.limit, offset: q.offset }) };
    }
    case "fills": {
      const q = parse(rangeQuery, query);
      return { scope: "public", run: (_r, db) => tapeFills(db, { sinceSec: q.since, untilSec: q.until, limit: q.limit, offset: q.offset }) };
    }
    case "actions": {
      const q = parse(rangeQuery, query);
      return { scope: "public", run: (_r, db) => tapeActions(db, { sinceSec: q.since, untilSec: q.until, limit: q.limit, offset: q.offset }) };
    }
    default:
      return null;
  }
}
