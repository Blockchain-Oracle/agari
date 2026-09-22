/**
 * What the model returns when asked the desk's one question: WHEN, never WHAT (desk.md §8). Strict: every field
 * required, nullable instead of optional, no defaults, so a shape the model invents is a parse failure, and a parse
 * failure holds. `checkDeskTiming` then checks what a schema cannot: cited ids exist, the part size matches the
 * option, and no hard banned word appears. A banned word throws the whole answer away (fail closed).
 */
import { z } from "zod";
import { findHardBannedWords, findStyleWords } from "./banned-words";

export const TIMING_OPTIONS = ["ACT_NOW", "ACT_PART", "WAIT", "DECLINE"] as const;
export const timingOptionSchema = z.enum(TIMING_OPTIONS);
export type TimingOption = z.infer<typeof timingOptionSchema>;

export const PART_PERCENTS = [25, 50, 75] as const;
export type PartPercent = (typeof PART_PERCENTS)[number];

export const deskTimingSchema = z.strictObject({
  option: timingOptionSchema,
  /** Only for ACT_PART. A closed set, so the model cannot invent a size. */
  partPercent: z.union([z.literal(25), z.literal(50), z.literal(75)]).nullable(),
  /** One plain sentence that stands alone: what was decided and the main reason. Shown as the record's summary. */
  headline: z.string().min(1).max(300),
  /** 0 to 100. How sure it is that this is the right timing call. It is not a forecast of price. */
  confidencePercent: z.number().int().min(0).max(100),
  /** Plain-language reasons. Each must point at evidence ids that were actually supplied. */
  reasons: z.array(z.strictObject({ text: z.string().min(1).max(500), evidenceIds: z.array(z.string().max(8)).max(8) })).max(8),
  /** Every option it did not choose, and why not. */
  rejected: z.array(z.strictObject({ option: timingOptionSchema, reason: z.string().min(1).max(300) })).max(3),
  /** How it read the premium: "rich" above the ceiling's neighbourhood, "fair" near the mark, "cheap" below it. */
  premiumRead: z.enum(["rich", "fair", "cheap", "unknown"]),
  /** For WAIT: what it waits for, in one phrase. Advisory: the deferral rules decide when the wait really ends. */
  waitFor: z.string().max(200).nullable(),
  warnings: z.array(z.string().max(300)).max(6),
  /** Ids of the owner's rules that applied. Ids, never rule text. */
  ruleIds: z.array(z.string().max(4)).max(10),
});
export type DeskTiming = z.infer<typeof deskTimingSchema>;

/** Everything the model wrote in its own words. The banned-word rule applies to all of it. */
function prose(d: DeskTiming): string[] {
  return [d.headline, ...d.reasons.map((r) => r.text), ...d.rejected.map((r) => r.reason), ...d.warnings, ...(d.waitFor ? [d.waitFor] : [])];
}

/** Words from the product's voice list the model used anyway. Noted in the record, never a veto. */
export function styleWordsUsed(d: DeskTiming): string[] {
  return [...new Set(prose(d).flatMap(findStyleWords))];
}

/** Checks a decision against what it was shown. Empty means it stands. */
export function checkDeskTiming(d: DeskTiming, knownEvidenceIds: readonly string[], knownRuleIds: readonly string[]): string[] {
  const problems: string[] = [];
  const evidence = new Set(knownEvidenceIds);
  const rules = new Set(knownRuleIds);
  if (d.option === "ACT_PART" && d.partPercent === null) problems.push("ACT_PART without a part size");
  if (d.option !== "ACT_PART" && d.partPercent !== null) problems.push(`part size given for ${d.option}`);
  if (d.option === "WAIT" && (d.waitFor === null || d.waitFor.trim() === "")) problems.push("WAIT without saying what it waits for");
  if (d.reasons.length === 0) problems.push("no reasons given");
  for (const r of d.reasons) {
    if (r.evidenceIds.length === 0) problems.push("a reason cites no evidence");
    for (const id of r.evidenceIds) if (!evidence.has(id)) problems.push(`cites unknown evidence id "${id}"`);
  }
  for (const id of d.ruleIds) if (!rules.has(id)) problems.push(`cites unknown rule id "${id}"`);
  if (d.rejected.some((r) => r.option === d.option)) problems.push("the chosen option also appears as rejected");
  // The product never promises gain and never calls a PreStocks token a share. A model that writes one of those words
  // gives no usable decision, so the desk does nothing. That is the safe direction to fail.
  const banned = [...new Set(prose(d).flatMap(findHardBannedWords))];
  if (banned.length > 0) problems.push(`uses words we never use: ${banned.join(", ")}`);
  return problems;
}

/**
 * A run of this many characters from the owner's notes, found in the model's prose, is a quotation. The public record
 * may not carry the notes (they are the owner's alone), so an answer that repeats them is refused.
 */
const QUOTE_WINDOW = 24;

export function quotesPrivateText(d: DeskTiming, privateTexts: readonly string[]): boolean {
  const text = prose(d).join("\n").toLowerCase();
  for (const raw of privateTexts) {
    const needle = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (needle.length < QUOTE_WINDOW) {
      if (needle.length >= 12 && text.includes(needle)) return true;
      continue;
    }
    for (let i = 0; i + QUOTE_WINDOW <= needle.length; i++) if (text.includes(needle.slice(i, i + QUOTE_WINDOW))) return true;
  }
  return false;
}
