import {
  AGARI_EVENTS_ERROR__BELOW_MIN_LOTS,
  AGARI_EVENTS_ERROR__EXPIRY_AFTER_LOCK,
  AGARI_EVENTS_ERROR__IMMEDIATE_OR_CANCEL_NO_FILL,
  AGARI_EVENTS_ERROR__INVALID_MODE,
  AGARI_EVENTS_ERROR__INVALID_PRICE,
  AGARI_EVENTS_ERROR__MARKET_NOT_TERMINAL,
  AGARI_EVENTS_ERROR__MARKET_NOT_TRADING,
  AGARI_EVENTS_ERROR__ORDER_ALREADY_EXPIRED,
  AGARI_EVENTS_ERROR__POST_ONLY_WOULD_CROSS,
  AGARI_EVENTS_ERROR__PRE_OPEN_TAKER_REFUSED,
  AGARI_EVENTS_ERROR__SEAT_MISMATCH,
  AGARI_EVENTS_ERROR__TOO_MANY_OPEN_ORDERS,
} from "@agari/clients/agari-events";
import { diagnosis, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import {
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND,
  SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE,
  SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT,
} from "@solana/kit";
import { describeChainFailure, type ChainFailure } from "./errors";
import { failingProduct, productRefusal } from "./product-failure";

/** The engine codes the write lanes branch on (events-accounts.md §4). */
export const ENGINE_CODE = {
  invalidMode: AGARI_EVENTS_ERROR__INVALID_MODE,
  marketNotTrading: AGARI_EVENTS_ERROR__MARKET_NOT_TRADING,
  marketNotTerminal: AGARI_EVENTS_ERROR__MARKET_NOT_TERMINAL,
  invalidPrice: AGARI_EVENTS_ERROR__INVALID_PRICE,
  belowMinLots: AGARI_EVENTS_ERROR__BELOW_MIN_LOTS,
  orderAlreadyExpired: AGARI_EVENTS_ERROR__ORDER_ALREADY_EXPIRED,
  expiryAfterLock: AGARI_EVENTS_ERROR__EXPIRY_AFTER_LOCK,
  iocNoFill: AGARI_EVENTS_ERROR__IMMEDIATE_OR_CANCEL_NO_FILL,
  seatMismatch: AGARI_EVENTS_ERROR__SEAT_MISMATCH,
  // D-088 pre-open calls: a post-only that would cross (6109), a seat at its 16 (6114), a taker on a Listed Window (6121).
  postOnlyWouldCross: AGARI_EVENTS_ERROR__POST_ONLY_WOULD_CROSS,
  tooManyOpenOrders: AGARI_EVENTS_ERROR__TOO_MANY_OPEN_ORDERS,
  preOpenTakerRefused: AGARI_EVENTS_ERROR__PRE_OPEN_TAKER_REFUSED,
} as const;

const ENGINE_RANGE = { min: 6000, max: 6399 };
/** SPL Token `InsufficientFunds`, surfaced through the engine's `transfer_checked` CPI. */
const TOKEN_INSUFFICIENT_FUNDS = 1;
const TOKEN_PROGRAM_FAILED = /Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed/;
const FEE_PAYER_ERRORS = new Set(["InsufficientFundsForFee", "InsufficientFundsForRent", "AccountNotFound", "InvalidAccountForFee"]);

/** The simulation table of first-call.md §3.1 (6110 and 6115 are branched on by the lane before it gets here). */
const KIND_BY_CODE = new Map<number, DiagnosisKind>([
  [ENGINE_CODE.marketNotTrading, "market-not-trading"],
  [ENGINE_CODE.invalidMode, "market-not-trading"],
  [ENGINE_CODE.orderAlreadyExpired, "order-expired"],
  [ENGINE_CODE.expiryAfterLock, "order-expired"],
  [ENGINE_CODE.belowMinLots, "below-min-quantity"],
  [ENGINE_CODE.invalidPrice, "invalid-price"],
  [ENGINE_CODE.iocNoFill, "no-liquidity"],
  [ENGINE_CODE.marketNotTerminal, "not-settled"],
  [ENGINE_CODE.postOnlyWouldCross, "post-only-would-cross"],
  [ENGINE_CODE.tooManyOpenOrders, "too-many-resting"],
  [ENGINE_CODE.preOpenTakerRefused, "pre-open-taker"],
]);

/** The `Custom(code)` of an `InstructionError`, or null. */
export function customCode(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("InstructionError" in err)) return null;
  const inner = (err as { InstructionError: readonly [unknown, unknown] }).InstructionError[1];
  if (typeof inner !== "object" || inner === null || !("Custom" in inner)) return null;
  const code = Number((inner as { Custom: number | bigint }).Custom);
  return Number.isSafeInteger(code) ? code : null;
}

/** Normalises an RPC `TransactionError` and its logs. */
export function chainFailure(err: unknown, logs: readonly string[] | null | undefined): ChainFailure {
  const code = customCode(err);
  // A product program's refusal shares the engine's number range but not its table (`product-failure.ts`).
  const ours = failingProduct(logs ?? []) === null;
  const engineCode = ours && code !== null && code >= ENGINE_RANGE.min && code <= ENGINE_RANGE.max ? code : null;
  return { engineCode, err, logs: logs ?? [] };
}

const FEE_PAYER_ERROR_BY_KIT_CODE = new Map<number, string>([
  [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE, "InsufficientFundsForFee"],
  [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT, "InsufficientFundsForRent"],
  [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND, "AccountNotFound"],
]);

/**
 * A `sendTransaction` preflight refusal as a `ChainFailure`, or null for any other error. Kit turns the RPC's `err` into
 * a SolanaError cause chain, so the plain `TransactionError` shape is rebuilt from it.
 */
export function preflightFailure(error: unknown): ChainFailure | null {
  if (!isSolanaError(error, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) return null;
  const logs = Array.isArray(error.context.logs) ? error.context.logs.map(String) : [];
  let err: unknown = error.message;
  for (let e: unknown = error.cause, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    if (isSolanaError(e, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
      err = { InstructionError: [e.context.index, { Custom: e.context.code }] };
      break;
    }
    const name = isSolanaError(e) ? FEE_PAYER_ERROR_BY_KIT_CODE.get(e.context.__code) : undefined;
    if (name) {
      err = name;
      break;
    }
  }
  return chainFailure(err, logs);
}

/** Why a transaction that never landed was refused, as the typed diagnosis every surface renders. */
export function failureDiagnosis(failure: ChainFailure): Diagnosis {
  const technical = describeChainFailure(failure);
  const product = productRefusal(failure.logs, customCode(failure.err));
  if (product) return diagnosis(product.kind, `${product.label} | ${technical}`);
  if (failure.engineCode !== null) return diagnosis(KIND_BY_CODE.get(failure.engineCode) ?? "contract-revert", technical);
  if (typeof failure.err === "string" && FEE_PAYER_ERRORS.has(failure.err)) return diagnosis("out-of-gas", technical);
  if (customCode(failure.err) === TOKEN_INSUFFICIENT_FUNDS && failure.logs.some((line) => TOKEN_PROGRAM_FAILED.test(line))) {
    return diagnosis("insufficient-collateral", technical);
  }
  if (failure.logs.some((line) => /insufficient lamports/i.test(line))) return diagnosis("out-of-gas", technical);
  return diagnosis("contract-revert", technical);
}
