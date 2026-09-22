import type { SessionService } from "../calendar/session-service";
import type { SpotFeed } from "../prices/spot";
import type { Log } from "./actor";
import type { OpsEnv } from "./env";
import type { PythEntitlementStore } from "./pyth-entitlement";
import type { HaltBoardStore } from "./halt-board";
import type { SessionEvents } from "./session-events";

/** What `main.ts` hands every venue actor (venue-ops.md §2.5, session-lanes.md §6): one calendar, spot feed, halt board and events reader per process. */
export interface VenueDeps {
  env: OpsEnv;
  log: Log;
  sessions: SessionService;
  /** Null until price-relay's feed is running (or in a dev runner that doesn't start it). */
  spot: SpotFeed | null;
  /** Written only by `halt-watch`; read by the roller, the maker and `/session` (session-lanes.md §3.1). */
  halts: HaltBoardStore;
  /** Corporate skips and multipliers (`corporate-actions.json`) and the earnings calendar (session-lanes.md §3.3–3.4). */
  events: SessionEvents;
  /** Whether the Pyth key may read each valuation index (S20, D-125); written by `pyth-entitlement`, read by the relay, the roller, the maker and `/session`. */
  pythIndex: PythEntitlementStore;
}
