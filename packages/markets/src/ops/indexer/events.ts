/**
 * The agari-events event registry: discriminator → name + Codama decoder, and the JSON-safe row form every
 * consumer stores (venue-ops.md §9). Admin events are emitted with `emit!` (logs, D-019) and never reach here.
 */
import {
  BOOK_RELEASED_EVENT_DISCRIMINATOR,
  COMPLETE_SET_EVENT_DISCRIMINATOR,
  CREDIT_WITHDRAWN_EVENT_DISCRIMINATOR,
  DEPENDENT_CHANGED_EVENT_DISCRIMINATOR,
  getBookReleasedEventDecoder,
  getCompleteSetEventDecoder,
  getCreditWithdrawnEventDecoder,
  getDependentChangedEventDecoder,
  getLedgerClosedEventDecoder,
  getLedgerGrownEventDecoder,
  getMarketClosedEventDecoder,
  getOrderExecutedEventDecoder,
  getOrderReducedEventDecoder,
  getOrdersCancelledEventDecoder,
  getPrintRecordedEventDecoder,
  getRedeemedEventDecoder,
  getWindowOpenedEventDecoder,
  getWindowResolvedEventDecoder,
  LEDGER_CLOSED_EVENT_DISCRIMINATOR,
  LEDGER_GROWN_EVENT_DISCRIMINATOR,
  MARKET_CLOSED_EVENT_DISCRIMINATOR,
  ORDER_EXECUTED_EVENT_DISCRIMINATOR,
  ORDER_REDUCED_EVENT_DISCRIMINATOR,
  ORDERS_CANCELLED_EVENT_DISCRIMINATOR,
  PRINT_RECORDED_EVENT_DISCRIMINATOR,
  REDEEMED_EVENT_DISCRIMINATOR,
  WINDOW_OPENED_EVENT_DISCRIMINATOR,
  WINDOW_RESOLVED_EVENT_DISCRIMINATOR,
} from "@agari/clients/agari-events";
import type { Decoder, ReadonlyUint8Array } from "@solana/kit";

/** Every Market-scoped event name; each carries `market` and a gapless `seq` (events-accounts.md §5). */
export const EVENT_NAMES = [
  "WindowOpened",
  "PrintRecorded",
  "OrderExecuted",
  "OrdersCancelled",
  "OrderReduced",
  "CompleteSet",
  "CreditWithdrawn",
  "WindowResolved",
  "Redeemed",
  "BookReleased",
  "LedgerGrown",
  "LedgerClosed",
  "DependentChanged",
  "MarketClosed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

type Entry = { name: EventName; discriminator: ReadonlyUint8Array; decoder: Decoder<object> };

const ENTRIES: Entry[] = [
  { name: "WindowOpened", discriminator: WINDOW_OPENED_EVENT_DISCRIMINATOR, decoder: getWindowOpenedEventDecoder() },
  { name: "PrintRecorded", discriminator: PRINT_RECORDED_EVENT_DISCRIMINATOR, decoder: getPrintRecordedEventDecoder() },
  { name: "OrderExecuted", discriminator: ORDER_EXECUTED_EVENT_DISCRIMINATOR, decoder: getOrderExecutedEventDecoder() },
  { name: "OrdersCancelled", discriminator: ORDERS_CANCELLED_EVENT_DISCRIMINATOR, decoder: getOrdersCancelledEventDecoder() },
  { name: "OrderReduced", discriminator: ORDER_REDUCED_EVENT_DISCRIMINATOR, decoder: getOrderReducedEventDecoder() },
  { name: "CompleteSet", discriminator: COMPLETE_SET_EVENT_DISCRIMINATOR, decoder: getCompleteSetEventDecoder() },
  { name: "CreditWithdrawn", discriminator: CREDIT_WITHDRAWN_EVENT_DISCRIMINATOR, decoder: getCreditWithdrawnEventDecoder() },
  { name: "WindowResolved", discriminator: WINDOW_RESOLVED_EVENT_DISCRIMINATOR, decoder: getWindowResolvedEventDecoder() },
  { name: "Redeemed", discriminator: REDEEMED_EVENT_DISCRIMINATOR, decoder: getRedeemedEventDecoder() },
  { name: "BookReleased", discriminator: BOOK_RELEASED_EVENT_DISCRIMINATOR, decoder: getBookReleasedEventDecoder() },
  { name: "LedgerGrown", discriminator: LEDGER_GROWN_EVENT_DISCRIMINATOR, decoder: getLedgerGrownEventDecoder() },
  { name: "LedgerClosed", discriminator: LEDGER_CLOSED_EVENT_DISCRIMINATOR, decoder: getLedgerClosedEventDecoder() },
  { name: "DependentChanged", discriminator: DEPENDENT_CHANGED_EVENT_DISCRIMINATOR, decoder: getDependentChangedEventDecoder() },
  { name: "MarketClosed", discriminator: MARKET_CLOSED_EVENT_DISCRIMINATOR, decoder: getMarketClosedEventDecoder() },
];

const hex = (bytes: ReadonlyUint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const BY_DISCRIMINATOR = new Map(ENTRIES.map((e) => [hex(e.discriminator), e]));

/** `discriminator ‖ Borsh` → `{ name, data }`, or null for an unknown discriminator. Throws on malformed Borsh. */
export function decodeEventPayload(payload: ReadonlyUint8Array): { name: EventName; data: object } | null {
  if (payload.length < 8) return null;
  const entry = BY_DISCRIMINATOR.get(hex(payload.subarray(0, 8)));
  if (!entry) return null;
  return { name: entry.name, data: entry.decoder.decode(payload) };
}

/** JSON-safe value: bigint → decimal string, bytes → hex; objects and arrays recursively. */
export type JsonSafe = string | number | boolean | null | JsonSafe[] | { [key: string]: JsonSafe };

export function toJsonSafe(value: unknown): JsonSafe {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return hex(value);
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}
