/**
 * `@agari/markets/ops/indexer`: read-only chain access and event decode for the S3 indexer (venue-ops.md §9).
 * Server-only. Rows leave JSON-safe (bigints as decimal strings), so `services/ops` and `@agari/db` never touch Kit.
 */
export { decodeTransactionEvents, EVENT_IX_TAG, type DecodedEvent, type DecodedTransaction, type RawTransaction } from "./decode";
export { EVENT_NAMES, toJsonSafe, type EventName, type JsonSafe } from "./events";
export { AGARI_EVENTS_PROGRAM_ID, createIndexerRpc, eventAuthorityOf, walkSignatures, type IndexerRpc, type IndexerRpcConfig, type SeriesInfo, type SignatureInfo } from "./rpc";
