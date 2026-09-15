/**
 * What the replay needs from storage (implemented by `@agari/db` `proofStore`, `packages/db/src/proofs.ts`). Rows are
 * JSON-safe: integers travel as decimal strings, so `@agari/db` never imports Kit or core.
 */

/** A recorded print (`idx_prints` joined to its Window's ticker). */
export interface StoredPrint {
  market: string;
  which: number;
  /** 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested. */
  source: number;
  symbol: string | null;
  /** Decimal integer, expo −8. */
  price: string;
  sourceTsSec: number;
  signature: string;
}

export type ProofState = "posting" | "verified" | "failed" | "closed";

export interface ProofClaim {
  boundarySec: number;
  /** Every feed in the posted update: one post serves all of them. */
  feeds: ReadonlyArray<{ feed: string; symbol: string }>;
  payer: string;
  nowMs: number;
  /** A `posting` row older than this is a crashed run and may be claimed again. */
  staleMs: number;
}

export interface VerifiedProofRow {
  feed: string;
  boundarySec: number;
  receiver: string;
  priceUpdate: string;
  verification: "full" | "partial";
  price: string;
  conf: string;
  expo: number;
  publishTimeSec: number;
  prevPublishTimeSec: number;
  postedSlot: string;
  postSignatures: string[];
  payer: string;
  postedAtMs: number;
}

export interface OpenProof {
  feed: string;
  boundarySec: number;
  priceUpdate: string;
  postedAtMs: number;
}

export interface ProofStore {
  print(market: string, which: number): Promise<StoredPrint | null>;
  /** The exact archived Hermes text for a Pyth feed at T. */
  archivedPyth(feed: string, boundarySec: number): Promise<string | null>;
  /** All-or-nothing per boundary: false with the blocking state when a live `posting` or `verified` row exists. */
  claim(claim: ProofClaim): Promise<{ claimed: true } | { claimed: false; state: ProofState }>;
  verified(rows: readonly VerifiedProofRow[]): Promise<void>;
  failed(feeds: readonly string[], boundarySec: number, error: string): Promise<void>;
  /** Verified rows whose accounts are still open. */
  openProofs(): Promise<OpenProof[]>;
  closed(rows: ReadonlyArray<{ feed: string; boundarySec: number }>, closeSignature: string, closedAtMs: number): Promise<void>;
  /** Boundaries claimed since `sinceMs` (the global replay quota), and whether any run is posting right now. */
  activity(sinceMs: number, staleMs: number, nowMs: number): Promise<{ boundaries: number; posting: number }>;
}
