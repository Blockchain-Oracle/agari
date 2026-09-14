/**
 * `@agari/markets/ops`: what every S3 venue actor shares (docs/plan/specs/venue-ops.md §3–4). Server-only: clients are
 * built from role keypair bytes. Not re-exported from the package root. Each lane's surface is its own subpath,
 * `@agari/markets/ops/<lane>` (`src/ops/<lane>/index.ts`), so lanes never edit this file or package.json.
 */
export { createOpsClient, type OpsClient, type OpsClientConfig } from "./client";
export { ENGINE_ERROR, engineErrorCode, OpsSendError, sendOps } from "./send";
export { fetchMarkets, fetchSeries, isTerminal, listMarketsOfSeries, listSeries, MARKET_FLAG, MARKET_STATE, marketStatus, type MarketStatus, type MarketView, type SeriesView } from "./venue";
export { chainNowSec, coveringVersion, eventAuthority, readSeats, windowAddresses, type Seat, type WindowAddresses } from "../deploy/cycle/accounts";
export { keypairSigner } from "../deploy/client";
