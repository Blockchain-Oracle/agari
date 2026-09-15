import { statusReader } from "@agari/db";
import { z } from "zod";
import { BadRequest, type IndexQuery } from "./queries";

/**
 * Lane 5c: `status/prints?from=` and `status/cross-checks?from=` (proof-analytics.md §1) over Windows with
 * `trading_start_sec ≥ from`. `/status` itself reads the same queries straight from the database; these paths serve them
 * to anyone else. Bare `status` stays the base table's freshness row.
 */
const fromQuery = z.object({ from: z.coerce.number().int().nonnegative() });

export function resolveStatusQuery(path: readonly string[], query: Record<string, string>, _programId: string): IndexQuery | null {
  const [head, resource, ...rest] = path;
  if (head !== "status" || rest.length > 0 || (resource !== "prints" && resource !== "cross-checks")) return null;
  const parsed = fromQuery.safeParse(query);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  const { from } = parsed.data;
  return {
    scope: "public",
    run: (_reader, db) => (resource === "prints" ? statusReader(db).printMix(from) : statusReader(db).crossChecks(from)),
  };
}
