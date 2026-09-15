/** Indexer store (schema-index.ts; venue-ops.md §9). Owned by S3 lane 3d. */
export { applyEvent } from "./idx/apply";
export { indexReader, type IdxFillQuery, type IdxRow, type IndexReader } from "./idx/read";
export type { IdxCommitment, IdxCursor, IdxEvent, IdxSeries, IdxTransaction } from "./idx/types";
export { indexWriter, type IndexWriter, type WriteResult } from "./idx/write";
export { tapeActions, tapeFills, tapeMarkets, type TapeMarketsQuery, type TapeRangeQuery } from "./idx/read-tape";
