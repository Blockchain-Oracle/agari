import {
  AGARI_LEVERAGE_ERROR__BELOW_MIN_QUANTITY, AGARI_LEVERAGE_ERROR__INSUFFICIENT_LIQUIDITY, AGARI_LEVERAGE_ERROR__MARKET_NOT_SETTLED,
  AGARI_LEVERAGE_ERROR__NOTHING_FILLED, AGARI_LEVERAGE_ERROR__NOTHING_OWED, AGARI_LEVERAGE_ERROR__NOT_LIVE, AGARI_LEVERAGE_ERROR__OUTSIDE_BAND,
  AGARI_LEVERAGE_ERROR__OVER_EXPOSURE, AGARI_LEVERAGE_ERROR__OVER_POSITION_CAP, AGARI_LEVERAGE_ERROR__OVER_WINDOW_CAP,
  AGARI_LEVERAGE_ERROR__SLIPPAGE, AGARI_LEVERAGE_ERROR__STAKE_ABOVE_MAX, AGARI_LEVERAGE_ERROR__STILL_HEALTHY, AGARI_LEVERAGE_ERROR__THIN_BOOK,
  AGARI_LEVERAGE_ERROR__TOO_LATE, AGARI_LEVERAGE_ERROR__TOO_MANY_OPEN, AGARI_LEVERAGE_ERROR__UNDERPRICED, AGARI_LEVERAGE_ERROR__UNHEALTHY_AT_ENTRY,
  AGARI_LEVERAGE_ERROR__UNSETTLED_POSITION, AGARI_LEVERAGE_ERROR__WINDOW_NOT_TRADING, AGARI_LEVERAGE_ERROR__WINDOW_PREDATES_RESERVE,
  AGARI_LEVERAGE_PROGRAM_ADDRESS, getAgariLeverageErrorMessage,
} from "@agari/clients/agari-leverage";
import {
  AGARI_PARLAY_ERROR__INSUFFICIENT_LIQUIDITY, AGARI_PARLAY_ERROR__LEG_NOT_SETTLED, AGARI_PARLAY_ERROR__LEG_OUT_OF_ORDER,
  AGARI_PARLAY_ERROR__LONG_SHOT, AGARI_PARLAY_ERROR__NOTHING_TO_CLAIM, AGARI_PARLAY_ERROR__OVER_EXPIRY_CAP,
  AGARI_PARLAY_ERROR__OVER_EXPOSURE, AGARI_PARLAY_ERROR__OVER_PAYOUT_CAP, AGARI_PARLAY_ERROR__STAKE_ABOVE_MAX,
  AGARI_PARLAY_ERROR__THIN_BOOK, AGARI_PARLAY_ERROR__TICKET_NOT_SETTLED, AGARI_PARLAY_ERROR__TOO_LATE,
  AGARI_PARLAY_ERROR__TOO_MANY_EXPIRIES, AGARI_PARLAY_ERROR__WIDE_SPREAD, AGARI_PARLAY_ERROR__WINDOW_NOT_TRADING,
  AGARI_PARLAY_PROGRAM_ADDRESS, getAgariParlayErrorMessage,
} from "@agari/clients/agari-parlay";
import {
  AGARI_RANGE_ERROR__CENTER_OUT_OF_RANGE, AGARI_RANGE_ERROR__INSUFFICIENT_LIQUIDITY, AGARI_RANGE_ERROR__LONG_SHOT,
  AGARI_RANGE_ERROR__NEAR_CERTAIN, AGARI_RANGE_ERROR__NO_CLOSING_PRINT, AGARI_RANGE_ERROR__OVER_EXPIRY_CAP,
  AGARI_RANGE_ERROR__OVER_EXPOSURE, AGARI_RANGE_ERROR__OVER_PAYOUT_CAP, AGARI_RANGE_ERROR__ROUND_DID_NOT_WIN,
  AGARI_RANGE_ERROR__ROUND_NOT_SETTLED, AGARI_RANGE_ERROR__STAKE_ABOVE_MAX, AGARI_RANGE_ERROR__STALE_MARK,
  AGARI_RANGE_ERROR__TOO_LATE, AGARI_RANGE_ERROR__WINDOW_NOT_TRADING, AGARI_RANGE_PROGRAM_ADDRESS, getAgariRangeErrorMessage,
} from "@agari/clients/agari-range";
import { AGARI_EVENTS_PROGRAM_ADDRESS } from "@agari/clients/agari-events";
import { AGARI_MAKER_PROGRAM_ADDRESS, getAgariMakerErrorMessage } from "@agari/clients/agari-maker";
import {
  AGARI_STRATEGY_ERROR__CAPS_OUTSIDE_ENVELOPE, AGARI_STRATEGY_ERROR__FEE_ABOVE_MAX, AGARI_STRATEGY_ERROR__GRANT_NOT_LIVE,
  AGARI_STRATEGY_ERROR__NOT_GRANT_OWNER, AGARI_STRATEGY_ERROR__WRONG_ACTOR, AGARI_STRATEGY_ERROR__WRONG_GRANT_KIND,
  AGARI_STRATEGY_PROGRAM_ADDRESS, getAgariStrategyErrorMessage,
} from "@agari/clients/agari-strategy";
import type { DiagnosisKind } from "@agari/core/types";

/**
 * A refusal by one of the product programs, named and classified from that program's own table.
 *
 * Every Anchor program numbers its errors from 6000, so a code alone says nothing about whose it is: read as an
 * engine code, the parlay's `ThinBook` (6010) or the range's `StaleMark` (6005) names some unrelated engine rule.
 * The runtime logs `Program <id> failed` for every frame a failure unwinds through, innermost first, so the first
 * such line is the program that refused.
 */
interface ProductTable {
  name: string;
  message: (code: never) => string;
  kinds: ReadonlyMap<number, DiagnosisKind>;
}

const PARLAY: ProductTable = {
  name: "agari-parlay",
  message: getAgariParlayErrorMessage as (code: never) => string,
  kinds: new Map<number, DiagnosisKind>([
    [AGARI_PARLAY_ERROR__THIN_BOOK, "thin-book"],
    [AGARI_PARLAY_ERROR__WIDE_SPREAD, "thin-book"],
    // The books moved past the buyer's cap between the quote and the send: a fresh quote is the whole remedy.
    [AGARI_PARLAY_ERROR__STAKE_ABOVE_MAX, "requote"],
    [AGARI_PARLAY_ERROR__WINDOW_NOT_TRADING, "market-not-trading"],
    [AGARI_PARLAY_ERROR__TOO_LATE, "market-not-trading"],
    [AGARI_PARLAY_ERROR__LONG_SHOT, "reserve-cap"],
    [AGARI_PARLAY_ERROR__OVER_PAYOUT_CAP, "reserve-cap"],
    [AGARI_PARLAY_ERROR__INSUFFICIENT_LIQUIDITY, "reserve-cap"],
    [AGARI_PARLAY_ERROR__OVER_EXPOSURE, "reserve-cap"],
    [AGARI_PARLAY_ERROR__OVER_EXPIRY_CAP, "reserve-cap"],
    [AGARI_PARLAY_ERROR__TOO_MANY_EXPIRIES, "reserve-cap"],
    [AGARI_PARLAY_ERROR__LEG_NOT_SETTLED, "not-settled"],
    [AGARI_PARLAY_ERROR__LEG_OUT_OF_ORDER, "not-settled"],
    [AGARI_PARLAY_ERROR__TICKET_NOT_SETTLED, "not-settled"],
    [AGARI_PARLAY_ERROR__NOTHING_TO_CLAIM, "already-claimed"],
  ]),
};

const RANGE: ProductTable = {
  name: "agari-range",
  message: getAgariRangeErrorMessage as (code: never) => string,
  kinds: new Map<number, DiagnosisKind>([
    // No trade, or one too old, to price against: the venue's book, not the reserve's capital.
    [AGARI_RANGE_ERROR__STALE_MARK, "thin-book"],
    [AGARI_RANGE_ERROR__STAKE_ABOVE_MAX, "requote"],
    [AGARI_RANGE_ERROR__WINDOW_NOT_TRADING, "market-not-trading"],
    [AGARI_RANGE_ERROR__TOO_LATE, "market-not-trading"],
    [AGARI_RANGE_ERROR__CENTER_OUT_OF_RANGE, "outside-band"],
    [AGARI_RANGE_ERROR__LONG_SHOT, "outside-band"],
    [AGARI_RANGE_ERROR__NEAR_CERTAIN, "outside-band"],
    [AGARI_RANGE_ERROR__OVER_PAYOUT_CAP, "reserve-cap"],
    [AGARI_RANGE_ERROR__INSUFFICIENT_LIQUIDITY, "reserve-cap"],
    [AGARI_RANGE_ERROR__OVER_EXPOSURE, "reserve-cap"],
    [AGARI_RANGE_ERROR__OVER_EXPIRY_CAP, "reserve-cap"],
    [AGARI_RANGE_ERROR__NO_CLOSING_PRINT, "not-settled"],
    [AGARI_RANGE_ERROR__ROUND_NOT_SETTLED, "not-settled"],
    [AGARI_RANGE_ERROR__ROUND_DID_NOT_WIN, "already-claimed"],
  ]),
};

const STRATEGY: ProductTable = {
  name: "agari-strategy",
  message: getAgariStrategyErrorMessage as (code: never) => string,
  kinds: new Map<number, DiagnosisKind>([
    // The creator changed the fee after the subscriber read it: reading it again is the whole remedy.
    [AGARI_STRATEGY_ERROR__FEE_ABOVE_MAX, "requote"],
    [AGARI_STRATEGY_ERROR__CAPS_OUTSIDE_ENVELOPE, "grant-refused"],
    [AGARI_STRATEGY_ERROR__GRANT_NOT_LIVE, "grant-refused"],
    [AGARI_STRATEGY_ERROR__NOT_GRANT_OWNER, "grant-refused"],
    [AGARI_STRATEGY_ERROR__WRONG_ACTOR, "grant-refused"],
    [AGARI_STRATEGY_ERROR__WRONG_GRANT_KIND, "grant-refused"],
  ]),
};

const LEVERAGE: ProductTable = {
  name: "agari-leverage",
  message: getAgariLeverageErrorMessage as (code: never) => string,
  kinds: new Map<number, DiagnosisKind>([
    // The venue's book: too little on offer, too little rested to sell back into, or a spread that births the position under its line.
    [AGARI_LEVERAGE_ERROR__THIN_BOOK, "thin-book"],
    [AGARI_LEVERAGE_ERROR__UNHEALTHY_AT_ENTRY, "thin-book"],
    [AGARI_LEVERAGE_ERROR__NOTHING_FILLED, "thin-book"],
    // The book moved past the owner's own guard between the quote and the send: a fresh quote is the whole remedy.
    [AGARI_LEVERAGE_ERROR__BELOW_MIN_QUANTITY, "requote"],
    [AGARI_LEVERAGE_ERROR__STAKE_ABOVE_MAX, "requote"],
    [AGARI_LEVERAGE_ERROR__SLIPPAGE, "requote"],
    [AGARI_LEVERAGE_ERROR__WINDOW_NOT_TRADING, "market-not-trading"],
    [AGARI_LEVERAGE_ERROR__TOO_LATE, "market-not-trading"],
    // A Window opened before the reserve had its seat carries no seat for it, so nothing can be boosted there.
    [AGARI_LEVERAGE_ERROR__WINDOW_PREDATES_RESERVE, "market-not-trading"],
    [AGARI_LEVERAGE_ERROR__OUTSIDE_BAND, "outside-band"],
    [AGARI_LEVERAGE_ERROR__UNDERPRICED, "outside-band"],
    [AGARI_LEVERAGE_ERROR__OVER_POSITION_CAP, "reserve-cap"],
    [AGARI_LEVERAGE_ERROR__OVER_WINDOW_CAP, "reserve-cap"],
    [AGARI_LEVERAGE_ERROR__OVER_EXPOSURE, "reserve-cap"],
    [AGARI_LEVERAGE_ERROR__TOO_MANY_OPEN, "reserve-cap"],
    [AGARI_LEVERAGE_ERROR__INSUFFICIENT_LIQUIDITY, "reserve-cap"],
    [AGARI_LEVERAGE_ERROR__MARKET_NOT_SETTLED, "not-settled"],
    [AGARI_LEVERAGE_ERROR__UNSETTLED_POSITION, "not-settled"],
    [AGARI_LEVERAGE_ERROR__STILL_HEALTHY, "not-settled"],
    [AGARI_LEVERAGE_ERROR__NOT_LIVE, "already-claimed"],
    [AGARI_LEVERAGE_ERROR__NOTHING_OWED, "already-claimed"],
  ]),
};

const MAKER: ProductTable = { name: "agari-maker", message: getAgariMakerErrorMessage as (code: never) => string, kinds: new Map() };

const TABLES = new Map<string, ProductTable>([
  [AGARI_PARLAY_PROGRAM_ADDRESS, PARLAY],
  [AGARI_RANGE_PROGRAM_ADDRESS, RANGE],
  [AGARI_LEVERAGE_PROGRAM_ADDRESS, LEVERAGE],
  [AGARI_MAKER_PROGRAM_ADDRESS, MAKER],
  [AGARI_STRATEGY_PROGRAM_ADDRESS, STRATEGY],
]);

const FAILED = /^Program (\w{32,44}) failed/;

/** The program that refused: the first `Program <id> failed` line, which is the innermost frame. Null with no such line. */
export function failingProgramId(logs: readonly string[]): string | null {
  for (const line of logs) {
    const id = FAILED.exec(line)?.[1];
    if (id) return id;
  }
  return null;
}

/**
 * Whether a custom code may be read as the engine's: only when the engine is the program that refused, or the logs
 * name nobody. It is the question asked this way round on purpose. Asking "is it one of the products we listed?"
 * called `agari-strategy`'s refusals `agari-events 6013` the day it was deployed, because nobody had listed it yet.
 */
export function refusedByEngine(logs: readonly string[]): boolean {
  const id = failingProgramId(logs);
  return id === null || id === AGARI_EVENTS_PROGRAM_ADDRESS;
}

/** The product program that refused, when it is one with a table here. */
export function failingProduct(logs: readonly string[]): ProductTable | null {
  const id = failingProgramId(logs);
  return id === null ? null : (TABLES.get(id) ?? null);
}

export interface ProductRefusal {
  kind: DiagnosisKind;
  /** `agari-parlay 6010: the venue's book is too thin to price that leg`. */
  label: string;
}

export function productRefusal(logs: readonly string[], code: number | null): ProductRefusal | null {
  const table = failingProduct(logs);
  if (!table || code === null) return null;
  let message = "";
  try {
    message = table.message(code as never);
  } catch {
    message = "";
  }
  return { kind: table.kinds.get(code) ?? "contract-revert", label: `${table.name} ${code}${message ? `: ${message}` : ""}` };
}
