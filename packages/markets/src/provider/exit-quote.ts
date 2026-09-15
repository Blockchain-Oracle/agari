/**
 * The plain cash-out's exit quote (L-35, tap-trading.md §1.4): a watch-free Book walk of the side being sold. The S7
 * foundation froze the port; lane 7b fills in the walk (`exitWalk`, the padded sell limit), so until then it answers
 * with the honest not-deployed reading (D-015, D-067).
 */
import type { QuoteTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { ExitQuote, Side } from "@agari/core/types";
import { notDeployedReading } from "../stub/not-deployed";

export async function freshExitQuote(_target: QuoteTarget, _side: Side, _contractsRaw: bigint): Promise<Reading<ExitQuote | null>> {
  return notDeployedReading("plain cash-out arrives with the S7 adapter");
}
