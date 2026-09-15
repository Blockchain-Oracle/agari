/**
 * The plain cash-out lane (L-35, tap-trading.md §1.4): an IOC sell of a held side on the wallet, vault or grant route,
 * booked from `OrderExecuted` or the vault's `Executed`. The S7 foundation froze the port; lane 7b builds the lane, so
 * until then every request is refused before anything is journaled or signed (D-015, D-067).
 */
import type { CashOutOutcome, CashOutRequest, PhaseListener } from "@agari/core/ports";
import { notDeployed } from "../stub/not-deployed";
import type { OrderLaneContext } from "./order-lane";

export async function submitCashOut(_ctx: OrderLaneContext, _req: CashOutRequest, _onPhase?: PhaseListener): Promise<CashOutOutcome> {
  return { status: "refused", diagnosis: notDeployed("plain cash-out arrives with the S7 adapter") };
}
