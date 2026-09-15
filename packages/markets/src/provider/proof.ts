/**
 * The proof page's read (proof-analytics.md §1 `proofs/:market`, §2.6): every recorded print of a Window with its
 * archived evidence and the stored Pyth replay, mapped to integers. Browser-safe: the replay itself lives in the
 * server-only `@agari/markets/proof`.
 */
import type { Reading } from "@agari/core/schemas";
import type { MarketId, PrintSource } from "@agari/core/types";
import { big, bigOrNull, indexRows, sec, type Dec } from "./index-api";
import { withReading } from "./reading";
import { sourceName } from "./rows";

/** `proofs/:market` as the API sends it (`packages/db/src/proofs.ts` `proofRows`). */
export interface ProofRowWire {
  market: string;
  which: number;
  source: number;
  price: Dec;
  expo: number;
  source_ts_sec: Dec;
  signers: number;
  copied: boolean;
  recorded_ts_sec: Dec;
  signature: string;
  symbol: string | null;
  archive_feed: string | null;
  archive_signers: number | null;
  archive_fetched_at_ms: Dec | null;
  archive_archived_at_ms: Dec | null;
  archive_payload_bytes: number | null;
  archive_payload_sha256: string | null;
  archive_signer_addresses: string[] | null;
  archive_package_ts_ms: Dec | null;
  proof_state: ReplayState | null;
  proof_receiver: string | null;
  proof_price_update: string | null;
  proof_verification: "full" | "partial" | null;
  proof_price: Dec | null;
  proof_conf: Dec | null;
  proof_expo: number | null;
  proof_publish_time_sec: Dec | null;
  proof_prev_publish_time_sec: Dec | null;
  proof_posted_slot: Dec | null;
  proof_post_signatures: string[] | null;
  proof_close_signature: string | null;
  proof_payer: string | null;
  proof_error: string | null;
  proof_posted_at_ms: Dec | null;
  proof_closed_at_ms: Dec | null;
}

export type ReplayState = "posting" | "verified" | "failed" | "closed";
/** 0 open, 1 close, 2 check open, 3 check close. */
export type PrintWhich = 0 | 1 | 2 | 3;

export interface PrintArchiveEvidence {
  feed: string;
  signers: number;
  fetchedAtMs: number;
  archivedAtMs: number;
  payloadBytes: number;
  payloadSha256: string;
  /** RedStone: the distinct signer addresses in the archived packages. */
  signerAddresses: string[] | null;
  /** RedStone: the packages' own timestamp. */
  packageTsMs: number | null;
}

export interface PythReplay {
  state: ReplayState;
  receiver: string | null;
  priceUpdate: string | null;
  verification: "full" | "partial" | null;
  price: bigint | null;
  conf: bigint | null;
  expo: number | null;
  publishTimeSec: number | null;
  prevPublishTimeSec: number | null;
  postedSlot: bigint | null;
  postSignatures: string[];
  closeSignatures: string[];
  payer: string | null;
  error: string | null;
  postedAtMs: number | null;
  closedAtMs: number | null;
}

export interface PrintProof {
  market: string;
  which: PrintWhich;
  source: PrintSource | null;
  /** Normalized to expo −8. */
  priceE8: bigint;
  boundarySec: number;
  signers: number;
  copied: boolean;
  recordedSec: number;
  recordSignature: string;
  symbol: string | null;
  archive: PrintArchiveEvidence | null;
  replay: PythReplay | null;
}

const numOrNull = (value: Dec | number | null): number | null => (value === null ? null : Number(value));

export function toPrintProof(row: ProofRowWire): PrintProof {
  return {
    market: row.market,
    which: row.which as PrintWhich,
    source: sourceName(row.source),
    priceE8: big(row.price),
    boundarySec: sec(row.source_ts_sec),
    signers: row.signers,
    copied: row.copied,
    recordedSec: sec(row.recorded_ts_sec),
    recordSignature: row.signature,
    symbol: row.symbol,
    archive:
      row.archive_feed === null
        ? null
        : {
            feed: row.archive_feed,
            signers: row.archive_signers ?? 0,
            fetchedAtMs: sec(row.archive_fetched_at_ms),
            archivedAtMs: sec(row.archive_archived_at_ms),
            payloadBytes: row.archive_payload_bytes ?? 0,
            payloadSha256: row.archive_payload_sha256 ?? "",
            signerAddresses: row.archive_signer_addresses,
            packageTsMs: numOrNull(row.archive_package_ts_ms),
          },
    replay:
      row.proof_state === null
        ? null
        : {
            state: row.proof_state,
            receiver: row.proof_receiver,
            priceUpdate: row.proof_price_update,
            verification: row.proof_verification,
            price: bigOrNull(row.proof_price),
            conf: bigOrNull(row.proof_conf),
            expo: row.proof_expo,
            publishTimeSec: numOrNull(row.proof_publish_time_sec),
            prevPublishTimeSec: numOrNull(row.proof_prev_publish_time_sec),
            postedSlot: bigOrNull(row.proof_posted_slot),
            postSignatures: row.proof_post_signatures ?? [],
            closeSignatures: row.proof_close_signature ? row.proof_close_signature.split(",") : [],
            payer: row.proof_payer,
            error: row.proof_error,
            postedAtMs: numOrNull(row.proof_posted_at_ms),
            closedAtMs: numOrNull(row.proof_closed_at_ms),
          },
  };
}

/** Every recorded print of a Window, in `which` order; empty before its opening print. */
export async function getMarketProof(marketId: MarketId): Promise<Reading<PrintProof[]>> {
  return withReading(`proof:${marketId}`, async () => (await indexRows<ProofRowWire>(`proofs/${marketId}`)).map(toPrintProof));
}
