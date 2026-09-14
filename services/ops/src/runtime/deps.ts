import type { SessionService } from "../calendar/session-service";
import type { SpotFeed } from "../prices/spot";
import type { Log } from "./actor";
import type { OpsEnv } from "./env";

/** What `main.ts` hands every S3 venue actor (venue-ops.md §2.5): one calendar and one spot feed for the process. */
export interface VenueDeps {
  env: OpsEnv;
  log: Log;
  sessions: SessionService;
  /** Null until price-relay's feed is running (or in a dev runner that doesn't start it). */
  spot: SpotFeed | null;
}
