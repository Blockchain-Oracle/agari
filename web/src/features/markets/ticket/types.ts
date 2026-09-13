import type { EventMarket } from "@masayume/core/types";
import type { MarketsSelection } from "../useMarketsSelection";

/** A selection with a resolved market — the only thing the Ticket renders from. */
export type TicketSelection = MarketsSelection & { market: EventMarket };
