import { messageSignatureSchema, networkLine, SIGNED_MESSAGE_BRAND } from "@agari/core/auth";
import type { Cluster } from "@agari/core/constants";
import { DESK_MODES, deskMandateWireSchema, OUTCOME_COLUMN, type OutcomeColumn } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS } from "@agari/core/market";
import { addressSchema, hash32Schema } from "@agari/core/types";
import { z } from "zod";

/**
 * What the desk's routes answer and accept (S21 C5, D-126). Shared by the routes and the hooks so the two cannot
 * drift; validated on both sides because everything here crosses a browser. Money and token amounts travel as
 * integer strings (base units) or plain decimal strings (a record's own form); never a float, never a bigint.
 */
export const DESK_CLUSTER: Cluster = "mainnet-beta";
/** A signature is good for a few minutes, so a captured one cannot be replayed later (the X link's rule). */
export const DESK_SIGNATURE_TTL_MS = 5 * 60_000;
/** Six own practice checks and the record opened unlock Go live (desk.md §7). */
export const GO_LIVE_CHECKS = 6;
export const CHECK_EVERY_SEC = 3_600;
export const CHECK_NOW_EVERY_SEC = 600;
/** Past two hours without a check, the desk "has not checked in". */
export const LATE_AFTER_SEC = 2 * 3_600;
/** Under this a deposit is too small: the fixed fees of each trade take too large a share. */
export const MIN_DEPOSIT_E6 = 20_000_000n;
/** PreStocks' transfer fee on every move of a name (mainnet, 2026-09-22). */
export const TRANSFER_FEE_BPS = 100;

const digits = z.string().regex(/^\d+$/);
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/);
const symbol = z.enum(PRE_IPO_SYMBOLS);

export const DESK_STATES = ["active", "paused_by_owner", "stopped_by_loss_limit", "needs_attention", "practice", "closed"] as const;
export type DeskState = (typeof DESK_STATES)[number];
export const deskModeSchema = z.enum(DESK_MODES);
export const outcomeColumnSchema = z.enum(Object.values(OUTCOME_COLUMN) as [OutcomeColumn, ...OutcomeColumn[]]);

export const deskRowSchema = z.object({
  id: z.string(),
  address: z.string().nullable(),
  owner: z.string(),
  cluster: z.string(),
  mode: deskModeSchema,
  state: z.enum(DESK_STATES),
  stateReason: z.string().nullable(),
  chainSeq: z.number().int(),
  chainHead: z.string(),
  mandateVersion: z.number().int(),
  practiceChecks: z.number().int(),
  recordOpenedAtSec: z.number().int().nullable(),
  sharePublic: z.boolean(),
  createdAtSec: z.number().int(),
  updatedAtSec: z.number().int(),
});
export type DeskRowWire = z.infer<typeof deskRowSchema>;

export const mandateVersionSchema = z.object({ version: z.number().int(), body: deskMandateWireSchema, fingerprint: hash32Schema, appliedAtSec: z.number().int() });
export type MandateVersionWire = z.infer<typeof mandateVersionSchema>;

export const snapshotHoldingSchema = z.object({
  symbol,
  raw: digits,
  valueE6: digits.nullable(),
  weightBps: z.number().int(),
  targetBps: z.number().int(),
  driftBps: z.number().int(),
  premiumBps: z.number().int().nullable(),
  priceE8: digits.nullable(),
  priceAgeSec: z.number().int().nullable(),
  paused: z.boolean(),
  frozen: z.boolean(),
});
export const snapshotSchema = z.object({
  atSec: z.number().int(),
  totalE6: digits,
  cashE6: digits,
  baselineE6: digits.nullable(),
  holdings: z.array(snapshotHoldingSchema),
});
export type SnapshotWire = z.infer<typeof snapshotSchema>;
export type SnapshotHoldingWire = z.infer<typeof snapshotHoldingSchema>;

export const paperSchema = z.object({ cashE6: digits, positions: z.record(z.string(), digits) });

export const APPROVAL_STATUSES = ["open", "approved", "declined", "expired", "cancelled"] as const;
export const approvalSchema = z.object({
  id: z.string(),
  decisionSeq: z.number().int(),
  decisionHash: hash32Schema,
  summary: z.string(),
  reason: z.enum(["ask_first", "large_action"]),
  side: z.enum(["buy", "sell"]).nullable(),
  symbol: symbol.nullable(),
  amountIn: decimal.nullable(),
  expectedOut: decimal.nullable(),
  confidencePercent: z.number().int().nullable(),
  costBps: z.number().int().nullable(),
  turnedDown: z.string().nullable(),
  expiresAtSec: z.number().int(),
  status: z.enum(APPROVAL_STATUSES),
  answeredAtSec: z.number().int().nullable(),
  executionSeq: z.number().int().nullable(),
});
export type ApprovalWire = z.infer<typeof approvalSchema>;

export const recordSummarySchema = z.object({
  seq: z.number().int(),
  prevHash: hash32Schema,
  recordHash: hash32Schema,
  outcome: outcomeColumnSchema,
  summary: z.string(),
  mode: deskModeSchema,
  decidedAtSec: z.number().int(),
  sealedBySig: z.string().nullable(),
  sealedSeq: z.number().int().nullable(),
});
export type RecordSummaryWire = z.infer<typeof recordSummarySchema>;

export const gradeSchema = z.object({ seq: z.number().int(), verdict: z.enum(["better", "worse", "no_real_difference", "ungradable"]), differenceBps: z.number().int().nullable(), countsForTiming: z.boolean(), why: z.string() });
export type GradeWire = z.infer<typeof gradeSchema>;

export const chainStateSchema = z.object({
  address: z.string(),
  operator: z.string().nullable(),
  seq: digits,
  head: hash32Schema,
  perActionCapE6: digits,
  dailyCapE6: digits,
  spentInWindowE6: digits,
  remainingDailyCapE6: digits,
  maxPremiumBps: z.number().int(),
  mode: deskModeSchema,
  paused: z.boolean(),
  usdcRaw: digits,
  tokens: z.array(z.object({ symbol: symbol.nullable(), mint: z.string(), raw: digits, enabled: z.boolean(), frozen: z.boolean(), exists: z.boolean() })),
  slot: digits,
});
export type ChainStateWire = z.infer<typeof chainStateSchema>;

export const deskViewSchema = z.object({
  configured: z.literal(true),
  viewer: z.enum(["owner", "visitor"]),
  desk: deskRowSchema.nullable(),
  mandate: mandateVersionSchema.nullable(),
  snapshot: snapshotSchema.nullable(),
  paper: paperSchema.nullable(),
  approvals: z.array(approvalSchema),
  latest: recordSummarySchema.nullable(),
  recent: z.array(recordSummarySchema),
  timing: z.object({ bps: z.number().int(), graded: z.number().int() }),
  chain: chainStateSchema.nullable(),
  chainError: z.string().nullable(),
  /** The venue's desk-runner key, the operator every desk is opened with; null when this deployment has none. */
  operator: z.string().nullable(),
  nowSec: z.number().int(),
});
export type DeskViewWire = z.infer<typeof deskViewSchema>;

export const recordsPageSchema = z.object({ records: z.array(recordSummarySchema), nextBefore: z.number().int().nullable() });
export type RecordsPageWire = z.infer<typeof recordsPageSchema>;

export const actionSchema = z.object({
  leg: z.number().int(),
  kind: z.string(),
  status: z.string(),
  signature: z.string().nullable(),
  expectedOut: decimal.nullable(),
  actualOut: decimal.nullable(),
  failureCode: z.string().nullable(),
  failureDetail: z.string().nullable(),
});
export type ActionWire = z.infer<typeof actionSchema>;

/** How this record reaches the chain: its own transaction, a later record's, none yet, or never (a practice desk). */
export const proofSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("own"), signature: z.string(), deskAddress: z.string() }),
  z.object({ kind: z.literal("later"), signature: z.string(), deskAddress: z.string(), sealingSeq: z.number().int(), links: z.array(z.object({ seq: z.number().int(), body: z.unknown() })) }),
  z.object({ kind: z.literal("unsealed"), deskAddress: z.string() }),
  z.object({ kind: z.literal("practice") }),
]);
export type ProofWire = z.infer<typeof proofSchema>;

export const decisionSchema = z.object({
  record: recordSummarySchema.extend({ body: z.unknown() }),
  actions: z.array(actionSchema),
  grade: gradeSchema.nullable(),
  approval: approvalSchema.nullable(),
  proof: proofSchema,
  viewer: z.enum(["owner", "visitor"]),
});
export type DecisionWire = z.infer<typeof decisionSchema>;

export const feedItemSchema = z.object({ kind: z.enum(["record", "money"]), seq: z.number().int(), outcome: outcomeColumnSchema.nullable(), summary: z.string(), atSec: z.number().int() });
export const feedSchema = z.object({ items: z.array(feedItemSchema), latestSeq: z.number().int() });
export type FeedItemWire = z.infer<typeof feedItemSchema>;

/* ---- what the owner sends (each carries the wallet's signature over one of the desk's texts) ---- */

const signed = { owner: addressSchema, signature: messageSignatureSchema, signedAtIso: z.iso.datetime() };

export const mandateRequestSchema = z.object({
  ...signed,
  mandate: deskMandateWireSchema,
  version: z.number().int().positive(),
  /** `test_read` also asks the desk to check now, so the studio's first decision card appears. */
  trigger: z.enum(["create", "test_read", "edit"]).default("edit"),
  practiceCashE6: digits.optional(),
});
export const approvalRequestSchema = z.object({ owner: addressSchema, signature: messageSignatureSchema, approvalId: z.string(), answer: z.enum(["approve", "decline"]) });
export const checkNowRequestSchema = z.object({ owner: addressSchema, signature: messageSignatureSchema, requestedAtIso: z.iso.datetime() });
export const shareRequestSchema = z.object({ ...signed, on: z.boolean() });
export const modeRequestSchema = z.object({ ...signed, mode: deskModeSchema, attach: z.object({ address: addressSchema, operator: addressSchema }).optional() });
export const ownerActionRequestSchema = z.object({ ...signed, kind: z.enum(["sell_all", "close"]) });
export type OwnerActionKind = z.infer<typeof ownerActionRequestSchema>["kind"];

/* ---- the three texts core does not carry: sharing, the mode, and the two owner requests to the desk ---- */

export function deskShareText(i: { owner: string; on: boolean; signedAtIso: string }): string {
  return [
    `${SIGNED_MESSAGE_BRAND} desk sharing`,
    "",
    i.on ? "Anyone with the link may read my desk's holdings and record. Never my notes. This moves no money." : "Only I may read my desk from now on. This moves no money.",
    "",
    `Owner: ${i.owner}`,
    `Signed at: ${i.signedAtIso}`,
    networkLine(DESK_CLUSTER),
  ].join("\n");
}

export const MODE_WORDS = { practice: "practice", ask_first: "ask me first", on_its_own: "on its own" } as const;

export function deskModeText(i: { owner: string; mode: (typeof DESK_MODES)[number]; signedAtIso: string; attach?: { address: string; operator: string } | undefined }): string {
  return [
    `${SIGNED_MESSAGE_BRAND} desk mode`,
    "",
    i.attach ? `My desk on Solana mainnet is ${i.attach.address}, with ${i.attach.operator} as its operator. Its mode is: ${MODE_WORDS[i.mode]}.` : `Set my desk's mode to: ${MODE_WORDS[i.mode]}.`,
    "This does not approve any single trade and does not move any money.",
    "",
    `Owner: ${i.owner}`,
    `Signed at: ${i.signedAtIso}`,
    networkLine(DESK_CLUSTER),
  ].join("\n");
}

export function deskOwnerActionText(i: { owner: string; kind: OwnerActionKind; signedAtIso: string }): string {
  const ask = i.kind === "sell_all" ? "Sell every holding in my desk to USDC at its next check. Nothing leaves my desk's account." : "Close my desk: sell every holding, send everything to my own wallet, and stop the checks. The record stays readable.";
  return [`${SIGNED_MESSAGE_BRAND} desk request`, "", ask, "", `Owner: ${i.owner}`, `Signed at: ${i.signedAtIso}`, networkLine(DESK_CLUSTER)].join("\n");
}
