/** Combines the model's timing answer, the gate and any developer override into what will actually happen (desk.md §6). */
import type { DeskGateResult } from "./gate";
import type { DeskTiming } from "./timing";

export const PLANNED_OUTCOMES = [
  "ACTED",
  "ACTED_IN_PART",
  "ACTED_BY_OVERRIDE",
  "WOULD_HAVE_ACTED",
  "ASKED",
  "WAITED",
  "DECLINED",
  "NOTHING_TO_DO",
  "NOT_EXECUTED",
  "BLOCKED_BY_LIMIT",
  "FAILED_NO_DECISION",
] as const;
export type PlannedOutcome = (typeof PLANNED_OUTCOMES)[number];

export const DESK_MODES = ["practice", "ask_first", "on_its_own"] as const;
export type DeskMode = (typeof DESK_MODES)[number];

/** The program's `Desk.mode` byte for each mode (desk.md §2). */
export const DESK_MODE_CODE: Record<DeskMode, number> = { practice: 0, ask_first: 1, on_its_own: 2 };

export function deskModeOf(code: number): DeskMode | null {
  return DESK_MODES.find((mode) => DESK_MODE_CODE[mode] === code) ?? null;
}

export interface Override {
  by: string;
  reason: string;
}

export type AskReason = "ask_first" | "large_action";

/** The share of the candidate the model asked for. The full size unless it said ACT_PART. */
export function sizedAmount(full: bigint, decision: DeskTiming | undefined, override: Override | null): bigint {
  if (override || decision?.option !== "ACT_PART" || !decision.partPercent) return full;
  return (full * BigInt(decision.partPercent)) / 100n;
}

export function wantsToAct(decision: DeskTiming | undefined): boolean {
  return decision?.option === "ACT_NOW" || decision?.option === "ACT_PART";
}

export interface PlanInput {
  decision: DeskTiming | undefined;
  gate: DeskGateResult;
  override: Override | null;
  isPart: boolean;
  mode: DeskMode;
  largeActionE6: bigint;
}

export interface PlannedAction {
  willAct: boolean;
  outcome: PlannedOutcome;
  ask: AskReason | null;
}

/**
 * "Blocked by a limit" means the desk WANTED to act and a limit stopped it. If the model said wait or decline, that is
 * the outcome, whatever the gate would have said. The gate is still last and final: neither the model nor a developer
 * override gets past it. Then the mode decides what wanting to act turns into: practice records "would have" and
 * spends nothing; ask first asks; on its own acts, but still asks at or above the owner's large-action size.
 */
export function planOutcome(p: PlanInput): PlannedAction {
  const no = (outcome: PlannedOutcome): PlannedAction => ({ willAct: false, outcome, ask: null });
  if (wantsToAct(p.decision) || p.override !== null) {
    if (p.gate.result === "deny") return no("BLOCKED_BY_LIMIT");
    if (p.mode === "practice") return no("WOULD_HAVE_ACTED");
    if (p.mode === "ask_first") return { willAct: false, outcome: "ASKED", ask: "ask_first" };
    if (p.gate.countedE6 >= p.largeActionE6) return { willAct: false, outcome: "ASKED", ask: "large_action" };
    const outcome: PlannedOutcome = p.override ? "ACTED_BY_OVERRIDE" : p.isPart ? "ACTED_IN_PART" : "ACTED";
    return { willAct: true, outcome, ask: null };
  }
  if (!p.decision) return no("FAILED_NO_DECISION");
  return no(p.decision.option === "DECLINE" ? "DECLINED" : "WAITED");
}

/** The record's outcome words mapped to the database column the record list filters on. */
export const OUTCOME_COLUMN = {
  ACTED: "acted",
  ACTED_IN_PART: "acted_in_part",
  ACTED_BY_OVERRIDE: "acted_by_override",
  WOULD_HAVE_ACTED: "would_have_acted",
  ASKED: "asked",
  NOTHING_TO_DO: "nothing_to_do",
  NOT_EXECUTED: "not_executed",
  WAITED: "waited",
  DECLINED: "declined",
  BLOCKED_BY_LIMIT: "blocked_by_limit",
  FAILED_NO_DECISION: "failed",
} as const satisfies Record<PlannedOutcome, string>;
export type OutcomeColumn = (typeof OUTCOME_COLUMN)[PlannedOutcome];

/** Outcomes that ring the owner (plan §5.8); a quiet check never does. */
export const NOTIFIED_OUTCOMES: ReadonlySet<PlannedOutcome> = new Set(["ACTED", "ACTED_IN_PART", "ACTED_BY_OVERRIDE", "WOULD_HAVE_ACTED", "ASKED", "BLOCKED_BY_LIMIT", "FAILED_NO_DECISION", "NOT_EXECUTED"]);

/** The quiet outcomes the record list folds into "6 quiet checks · 03:00–09:00". */
export const QUIET_OUTCOMES: ReadonlySet<PlannedOutcome> = new Set(["NOTHING_TO_DO", "WAITED"]);

const PLAIN_WORDS: Record<string, string> = { ACT_NOW: "act now", ACT_PART: "act in part", WAIT: "wait", DECLINE: "decline" };

/**
 * The one-line summary the owner sees. The model's headline, with any option code name it let slip turned into plain
 * words. Only this display copy is touched: the hashed record keeps the model's answer exactly as given.
 */
export function plainHeadline(decision: DeskTiming | undefined): string | undefined {
  if (!decision) return undefined;
  const text = decision.headline.replace(/\b(ACT_NOW|ACT_PART|WAIT|DECLINE)\b/g, (code) => PLAIN_WORDS[code] ?? code).trim();
  if (text === "") return decision.reasons[0]?.text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
