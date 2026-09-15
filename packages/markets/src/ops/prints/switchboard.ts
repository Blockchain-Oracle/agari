/**
 * Switchboard token-lane prints (session-lanes.md §2.4; prints.md §4.4–4.5): `[ed25519 quote, public_record_print_switchboard]`
 * per slot from one quote per T, and opens copied from the previous close. Lane 6b owns this file;
 * `ops/prints/index.ts` re-exports all of it.
 *
 * Spike (a) (D-053): the devnet gateway signs with at most 4 distinct oracles and sometimes returns one fewer than
 * asked, so a quote asks for 5, is refused below the on-chain minimum, and is cut to 4 signatures: a 4-feed quote with
 * 4 signatures plus Kit's compute-budget instructions stays under the 1,232 B legacy limit (LiteSVM: 1,173 B).
 */
import {
  AGARI_EVENTS_ERROR__DUPLICATE_ORACLE,
  AGARI_EVENTS_ERROR__PRINT_NOT_ADJACENT,
  AGARI_EVENTS_ERROR__PRINTS_MISSING,
  AGARI_EVENTS_ERROR__QUOTE_SLOT_STALE,
  AGARI_EVENTS_ERROR__SWITCHBOARD_FEED_MISMATCH,
  AGARI_EVENTS_ERROR__SWITCHBOARD_QUEUE_MISMATCH,
  AGARI_EVENTS_ERROR__TOO_FEW_ORACLES,
  AGARI_EVENTS_PROGRAM_ADDRESS,
  findConfigPda,
  getPublicCopyOpenFromPrevInstruction,
  getPublicRecordPrintSwitchboardInstructionAsync,
} from "@agari/clients/agari-events";
import { address, type Address, type Instruction } from "@solana/kit";
import { eventAuthority, windowAddresses } from "../../deploy/cycle/accounts";
import { ED25519_PROGRAM_ADDRESS } from "../../prices/attested";
import { fetchSurgeQuote, trimSwitchboardQuote, type SwitchboardQuote } from "../../prices/legacy/switchboard-quote";
import type { OpsClient } from "../client";
import { ENGINE_ERROR, OpsSendError, sendOps } from "../send";
import type { SlotOutcome } from "./record";
import type { PrintSlot } from "./slots";

export const SWITCHBOARD_REQUEST_SIGNATURES = 5;
export const SWITCHBOARD_MAX_SIGNATURES = 4;
const ZERO_ADDRESS = "11111111111111111111111111111111";

export const SWITCHBOARD_ERROR = {
  feedMismatch: AGARI_EVENTS_ERROR__SWITCHBOARD_FEED_MISMATCH,
  queueMismatch: AGARI_EVENTS_ERROR__SWITCHBOARD_QUEUE_MISMATCH,
  duplicateOracle: AGARI_EVENTS_ERROR__DUPLICATE_ORACLE,
  tooFewOracles: AGARI_EVENTS_ERROR__TOO_FEW_ORACLES,
  quoteSlotStale: AGARI_EVENTS_ERROR__QUOTE_SLOT_STALE,
  printNotAdjacent: AGARI_EVENTS_ERROR__PRINT_NOT_ADJACENT,
  printsMissing: AGARI_EVENTS_ERROR__PRINTS_MISSING,
} as const;

/** `config.switchboard_queue` and `switchboard_min_oracles`; `queue` null while the zero placeholder is set (D-026). */
export type SwitchboardVenue = { queue: string | null; minOracles: number };

export async function readSwitchboardVenue(client: OpsClient): Promise<SwitchboardVenue> {
  const [config] = await findConfigPda();
  const data = (await client.agariEvents.accounts.globalConfig.fetch(config as Address)).data;
  return { queue: data.switchboardQueue === ZERO_ADDRESS ? null : data.switchboardQueue, minOracles: data.switchboardMinOracles };
}

export class QuoteShortError extends Error {
  constructor(readonly distinct: number, readonly required: number) {
    super(`quote signed by ${distinct} distinct oracle(s), ${required} required`);
  }
}

/** One quote over `surgeSymbols` (≤ 8) with at least `minOracles` distinct oracles, cut to `SWITCHBOARD_MAX_SIGNATURES`. */
export async function fetchTokenQuote(input: { rpcUrl: string; surgeSymbols: readonly string[]; minOracles: number; queue: string }): Promise<SwitchboardQuote> {
  const quote = await fetchSurgeQuote({ rpcUrl: input.rpcUrl, symbols: input.surgeSymbols, numSignatures: SWITCHBOARD_REQUEST_SIGNATURES, queue: input.queue });
  const distinct = new Set(quote.oracleIdxs).size;
  const required = Math.max(1, input.minOracles);
  if (distinct < required || distinct !== quote.oracleIdxs.length) throw new QuoteShortError(distinct, required);
  return trimSwitchboardQuote(quote, SWITCHBOARD_MAX_SIGNATURES);
}

export const quoteHasFeed = (quote: SwitchboardQuote, feedIdHex: string) => quote.feeds.some((f) => f.feedHashHex === feedIdHex);

/** The ed25519 precompile instruction carrying the quote; it must sit immediately before the record. */
export const quoteInstruction = (quote: SwitchboardQuote): Instruction => ({ programAddress: ED25519_PROGRAM_ADDRESS, data: quote.data });

const label = (s: PrintSlot) => `switchboard ${s.slot} ${s.seriesKey} #${s.marketIndex}`;

function outcomeOf(slot: PrintSlot, error: unknown): SlotOutcome {
  const code = error instanceof OpsSendError ? error.code : null;
  const message = error instanceof Error ? error.message : String(error);
  if (code === ENGINE_ERROR.printAlreadyRecorded || code === ENGINE_ERROR.marketAlreadyTerminal) return { slot, status: "already", code };
  if (code === ENGINE_ERROR.printTooEarly) return { slot, status: "early", code, error: message };
  if (code === ENGINE_ERROR.printTooLate) return { slot, status: "late", code, error: message };
  return { slot, status: "failed", code, error: message };
}

async function sendSlot(client: OpsClient, slot: PrintSlot, what: string, build: () => Promise<Instruction[]>): Promise<SlotOutcome> {
  try {
    const { signature } = await sendOps(client, await build(), `${label(slot)} ${what}`);
    return { slot, status: "recorded", signature };
  } catch (error) {
    return outcomeOf(slot, error);
  }
}

/** `[quote, public_record_print_switchboard]` for one slot whose feed the quote carries. */
export function recordSwitchboardSlot(client: OpsClient, slot: PrintSlot, quote: SwitchboardQuote, queue: string): Promise<SlotOutcome> {
  if (slot.source !== "switchboard") return Promise.resolve({ slot, status: "failed", error: "not a Switchboard slot" });
  if (!quoteHasFeed(quote, slot.feedIdHex)) return Promise.resolve({ slot, status: "failed", error: `quote has no feed ${slot.feedIdHex.slice(0, 8)}…` });
  return sendSlot(client, slot, "print", async () => [
    quoteInstruction(quote),
    await getPublicRecordPrintSwitchboardInstructionAsync({
      series: address(slot.series), market: address(slot.market), queue: address(queue), eventAuthority: await eventAuthority(),
      program: AGARI_EVENTS_PROGRAM_ADDRESS, which: slot.which,
    }),
  ]);
}

/**
 * `public_copy_open_from_prev` from Window `index − 1` (prints.md §4.5). A non-adjacent previous Window
 * (`PrintNotAdjacent`) or one without its close yet (`PrintsMissing`) comes back as `failed` with that code.
 */
export async function copyOpenSlot(client: OpsClient, slot: PrintSlot): Promise<SlotOutcome> {
  if (slot.slot !== "open" || slot.marketIndex === 0n) return { slot, status: "failed", code: SWITCHBOARD_ERROR.printNotAdjacent, error: "no previous Window" };
  const prev = await windowAddresses(address(slot.series), slot.marketIndex - 1n);
  return sendSlot(client, slot, "copy open", async () => [
    getPublicCopyOpenFromPrevInstruction({
      series: address(slot.series), market: address(slot.market), prevMarket: prev.market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS,
    }),
  ]);
}
