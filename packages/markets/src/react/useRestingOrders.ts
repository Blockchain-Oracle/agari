import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { RestingOrderView } from "@agari/core/projection";
import type { Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { listRestingOrders } from "../provider/orders";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

/** The wallet's resting calls (D-088), keyed under its positions so a confirmed write refreshes both at once. */
export function useRestingOrders(wallet: Address | null, pollMs: number | false = MARKETS_POLL_MS): Reading<RestingOrderView[]> | null {
  return useReadingQuery(keys.restingOrders(wallet), () => listRestingOrders(wallet as Address), { enabled: wallet !== null, pollMs: pollMs || undefined });
}
