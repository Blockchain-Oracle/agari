/**
 * The decision record, `desk.v1` (desk.md §6). Versions are APPEND ONLY. This is the body that gets hashed and fixed on
 * chain, so its shape is a public promise: anyone must be able to read an old record years from now. Every object is
 * strict, so an extra or missing field fails here, BEFORE the record is hashed or anything is sent. Widening (a new
 * enum value, a new nullable field) is allowed; narrowing, renaming or removing needs a new version.
 *
 * A field that does not apply is null, never absent, so its absence is visible. Amounts are decimal strings. Basis
 * points, counts and seconds are integers. There are no floats anywhere in a record.
 */
import { z } from "zod";
import { PRE_IPO_SYMBOLS } from "../market/tickers";
import { DESK_MODES, PLANNED_OUTCOMES } from "./plan";
import { BLOCKER_RULES } from "./pregate";
import { deskTimingSchema } from "./timing";

export const RECORD_SCHEMA_VERSION = "desk.v1";

const Hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const Decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "must be a plain decimal string");
const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
const Int = z.number().int();
const Side = z.enum(["buy", "sell"]);
const Symbol = z.enum(PRE_IPO_SYMBOLS);

const Session = z.strictObject({ id: z.string(), kind: z.literal("session"), market: z.literal("24/7"), at: Iso, trigger: z.string(), nextCheck: Iso });
const Price = z.strictObject({
  id: z.string(),
  kind: z.literal("price"),
  spot: Decimal,
  mean30m: Decimal,
  gapBps: Int,
  inLine: z.boolean(),
  mark: Decimal.nullable(),
  premiumBps: Int.nullable(),
  index: Decimal.nullable(),
  indexPremiumBps: Int.nullable(),
  referenceAgeSec: Int.nullable(),
  multiplier: Decimal,
});
const Cost = z.strictObject({ id: z.string(), kind: z.literal("cost"), costBps: Int.nullable(), transferFeeBps: Int, quoteOut: Decimal.nullable(), quoteOutUnit: z.string(), routeAccounts: Int.nullable() });
const Status = z.strictObject({ id: z.string(), kind: z.literal("status"), mintPaused: z.boolean().nullable(), accountFrozen: z.boolean().nullable(), deskPaused: z.boolean(), referenceFresh: z.boolean() });
const Limits = z.strictObject({ id: z.string(), kind: z.literal("limits"), perActionCap: Decimal, remainingToday: Decimal, deskCash: Decimal, deskHolds: Decimal, countsAgainstLimits: Decimal });
const Position = z.strictObject({ id: z.string(), kind: z.literal("position"), weightBps: Int, targetBps: Int, driftBps: Int, thresholdBps: Int });
const Recent = z.strictObject({
  id: z.string(),
  kind: z.literal("recent"),
  lastOnThisNameIso: Iso.nullable(),
  lastOutcome: z.string().nullable(),
  minutesSince: Int.nullable(),
  standingWait: z.strictObject({ seq: Int, decidedAtIso: Iso }).nullable(),
});
export const evidenceItemSchema = z.discriminatedUnion("kind", [Session, Price, Cost, Status, Limits, Position, Recent]);

export const recordValuationSchema = z.strictObject({
  priceSource: z.literal("prestocks_mean_30m"),
  total: Decimal,
  cash: Decimal,
  cashWeightBps: Int,
  cashTargetBps: Int,
  holdings: z.array(
    z.strictObject({ symbol: Symbol, mint: z.string(), balance: Decimal, price: Decimal, spot: Decimal.nullable(), mark: Decimal.nullable(), value: Decimal, weightBps: Int, targetBps: Int, driftBps: Int, premiumBps: Int.nullable(), paused: z.boolean(), frozen: z.boolean() }),
  ),
  unpriced: z.array(z.strictObject({ symbol: Symbol, mint: z.string(), balance: Decimal, why: z.string() })),
});

export const recordTimingSchema = z.strictObject({
  promptVersion: z.string(),
  model: z.string(),
  latencyMs: Int,
  totalTokens: Int.nullable(),
  finishReason: z.string().nullable(),
  error: z.string().nullable(),
  rejectedByOurChecks: z.array(z.string()),
  styleWordsUsed: z.array(z.string()),
  decision: deskTimingSchema.nullable(),
});

export const deskRecordSchema = z.strictObject({
  schemaVersion: z.literal(RECORD_SCHEMA_VERSION),
  kind: z.enum(["decision", "execution"]),
  chainId: Int,
  /** The owner's address: the desk PDA is derived from it, and a practice desk has no PDA. */
  desk: z.string(),
  seq: Int,
  prevHash: Hash,
  /** The program's counter and head as they stood when this was decided (zeros for a practice desk). */
  chain: z.strictObject({ seqBefore: Int, headBefore: Hash }),
  decidedAt: Iso,
  wake: z.strictObject({ scheduledFor: Iso, trigger: z.string() }),
  mode: z.enum(DESK_MODES),
  mandate: z.strictObject({ version: Int, fingerprint: Hash }).nullable(),
  valuation: recordValuationSchema.nullable(),
  need: z.strictObject({ driftBps: Int, thresholdBps: Int, limitedByPerActionLimit: z.boolean() }).nullable(),
  candidate: z.strictObject({ id: z.string(), side: Side, symbol: Symbol, mint: z.string(), amountIn: Decimal, amountInUnit: z.string(), why: z.string(), protective: z.boolean() }).nullable(),
  deferral: z.strictObject({ decisionSeq: Int, decidedAt: Iso, stillStanding: z.boolean(), endedBecause: z.string().nullable() }).nullable(),
  approvalOf: z.strictObject({ decisionSeq: Int, askedBecause: z.enum(["ask_first", "large_action", "owner_override"]), answeredAt: Iso, movedBps: Int }).nullable(),
  blockers: z.array(z.strictObject({ rule: z.enum(BLOCKER_RULES), text: z.string() })),
  evidence: z.array(evidenceItemSchema),
  timing: recordTimingSchema.nullable(),
  gate: z.strictObject({ result: z.enum(["allow", "deny"]), reasons: z.array(z.string()), counted: Decimal, oracleValue: Decimal, oracleFloor: Decimal, premiumOk: z.boolean() }).nullable(),
  override: z.strictObject({ by: z.string(), reason: z.string() }).nullable(),
  outcome: z.enum(PLANNED_OUTCOMES),
  ask: z.enum(["ask_first", "large_action"]).nullable(),
  preview: z.strictObject({ amountIn: Decimal, expectedOut: Decimal, minOut: Decimal, slippageBps: Int, deadlineSec: Int.nullable() }).nullable(),
  /** The practice ledger after this check, so a practice record is self-contained; null on a live desk. */
  paper: z.strictObject({ cash: Decimal, positions: z.partialRecord(Symbol, Decimal) }).nullable(),
});
export type DeskRecordBody = z.infer<typeof deskRecordSchema>;
export type RecordEvidenceItem = z.infer<typeof evidenceItemSchema>;
