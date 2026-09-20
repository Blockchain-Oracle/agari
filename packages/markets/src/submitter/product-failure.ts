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
import { AGARI_MAKER_PROGRAM_ADDRESS, getAgariMakerErrorMessage } from "@agari/clients/agari-maker";
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

const MAKER: ProductTable = { name: "agari-maker", message: getAgariMakerErrorMessage as (code: never) => string, kinds: new Map() };

const TABLES = new Map<string, ProductTable>([
  [AGARI_PARLAY_PROGRAM_ADDRESS, PARLAY],
  [AGARI_RANGE_PROGRAM_ADDRESS, RANGE],
  [AGARI_MAKER_PROGRAM_ADDRESS, MAKER],
]);

const FAILED = /^Program (\w{32,44}) failed/;

/** The product program that refused, from the first `Program <id> failed` line; null when it was the engine or none. */
export function failingProduct(logs: readonly string[]): ProductTable | null {
  for (const line of logs) {
    const id = FAILED.exec(line)?.[1];
    if (id) return TABLES.get(id) ?? null;
  }
  return null;
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
