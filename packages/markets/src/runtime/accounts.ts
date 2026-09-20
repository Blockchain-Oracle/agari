/**
 * Chain reads of the venue's accounts for the browser and server (first-call.md §2.1; signatures frozen there).
 * Decoders are lifted from `ops/venue.ts`, `ops/settle/ledger.ts` and `deploy/cycle/accounts.ts`, which stay
 * server-only. Every read goes through the batching loader. Immutable facts are cached for the runtime's life:
 * registration parameters, the collateral mint and its decimals. Venue `mode` is re-read at most every 15 s. Reads
 * are whole accounts so they share batches; the Book (57 KB) is the only large one.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  findConfigPda,
  getGlobalConfigDecoder,
  getMarketDecoder,
  getSeriesDecoder,
  type Market,
} from "@agari/clients/agari-events";
import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Address as CoreAddress } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { loadAccount } from "./account-loader";
import { decodeBook, decodeLedgerHeader, findSeat, type BookState, type LedgerSeat } from "./decode";
import { peekClient } from "./read-runtime";
import { solanaGeneration } from "./solana";

export { decodeBook, SEAT_FLAG, type BookState, type LedgerSeat } from "./decode";

/** Callers hold either Kit or core addresses; both are the same base58 string. */
type AnyAddress = Address | CoreAddress;
const kit = (value: AnyAddress) => value as Address;

export interface VenueFacts {
  config: Address;
  collateralMint: Address;
  decimals: number;
  treasury: Address;
  /** `GlobalConfig.mode`: 0 Normal, 1 ReduceOnly, 2 Halted. */
  mode: 0 | 1 | 2;
  /**
   * The program seats the venue has registered (`GlobalConfig.program_authorities`, free slots dropped): the
   * Trading Balance vault's pooled seat, the maker vault's. They trade, and they are not people.
   */
  programSeats: Address[];
}

export interface SeriesFacts {
  address: Address;
  /** Null for a ticker outside the core registry (the drive-only Series 900). */
  symbol: TickerSymbol | null;
  basis: number;
  cadenceSec: number;
  lotBase: bigint;
  tickBase: bigint;
  cashUnit: bigint;
  minLots: bigint;
  seatBond: bigint;
  fillsCap: number;
  evictionsCap: number;
  minRestSlots: bigint;
  /** `Source` of each policy version's primary and check (0 none, 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested). */
  policySources: readonly { primary: number; check: number }[];
}

const VENUE_MODE_TTL_MS = 15_000;
/** SPL token account `amount` u64. */
const TOKEN_AMOUNT_OFFSET = 64;
const SYMBOL_BY_SERIES_ID = new Map<number, TickerSymbol>(TICKER_SYMBOLS.map((s) => [TICKERS[s].seriesId, s]));

let generation = -1;
let configPda: Promise<Address> | null = null;
let venue: { facts: VenueFacts; readAtMs: number } | null = null;
let venueRead: Promise<VenueFacts> | null = null;
const seriesByAddress = new Map<string, Promise<SeriesFacts>>();
/** ATA derivations (async hashing): cached so a repeat read joins the same turn's batch as its siblings. */
const ataByOwnerMint = new Map<string, Promise<Address>>();

/** Drops every cached fact when the read runtime is rebuilt onto other endpoints. */
function fresh(): void {
  const now = solanaGeneration();
  if (now === generation) return;
  generation = now;
  configPda = null;
  venue = null;
  venueRead = null;
  seriesByAddress.clear();
}

export function eventsProgramAddress(): Address {
  return (peekClient()?.eventsProgramId as Address | null | undefined) ?? AGARI_EVENTS_PROGRAM_ADDRESS;
}

/** The venue id: the program's one `GlobalConfig` PDA. */
export function configAddress(): Promise<Address> {
  fresh();
  configPda ??= findConfigPda({ programAddress: eventsProgramAddress() }).then(([pda]) => pda);
  return configPda;
}

/** An unused `program_authorities` slot is the default key. */
const FREE_AUTHORITY = "11111111111111111111111111111111";

/** Whole accounts, not slices: a full read joins the same batch as every other read this turn (856 B here). */
async function readVenueFacts(): Promise<VenueFacts> {
  const config = await configAddress();
  const { bytes } = await loadAccount(config);
  if (!bytes) throw new Error(`GlobalConfig ${config} not found`);
  const data = getGlobalConfigDecoder().decode(bytes);
  const programSeats = data.programAuthorities.filter((seat) => (seat as string) !== FREE_AUTHORITY);
  return { config, collateralMint: data.collateralMint, decimals: data.collateralDecimals, treasury: data.treasury, mode: data.mode as VenueFacts["mode"], programSeats };
}

export async function readVenue(): Promise<VenueFacts> {
  fresh();
  if (venue && Date.now() - venue.readAtMs < VENUE_MODE_TTL_MS) return venue.facts;
  venueRead ??= readVenueFacts()
    .then((facts) => {
      venue = { facts, readAtMs: Date.now() };
      return facts;
    })
    .finally(() => {
      venueRead = null;
    });
  return venueRead;
}

/** The venue's immutable facts (mint, decimals, treasury) without a mode refresh: lists never pay for `mode`. */
export function readVenueStatic(): Promise<VenueFacts> {
  fresh();
  return venue ? Promise.resolve(venue.facts) : readVenue();
}

export function readSeries(series: AnyAddress): Promise<SeriesFacts> {
  fresh();
  const cached = seriesByAddress.get(series);
  if (cached) return cached;
  const read = loadAccount(kit(series)).then(({ bytes }) => {
    if (!bytes) throw new Error(`Series ${series} not found`);
    const data = getSeriesDecoder().decode(bytes);
    return {
      address: kit(series),
      symbol: SYMBOL_BY_SERIES_ID.get(data.ticker) ?? null,
      basis: data.basis,
      cadenceSec: data.cadenceSec,
      lotBase: data.lotBase,
      tickBase: data.tickBase,
      cashUnit: data.cashUnit,
      minLots: data.minLots,
      seatBond: data.seatBond,
      fillsCap: data.fillsCap,
      evictionsCap: data.evictionsCap,
      minRestSlots: BigInt(data.minRestSlots),
      policySources: data.policyVersions.slice(0, data.versionCount).map((v) => ({ primary: v.primary.source, check: v.check.source })),
    };
  });
  seriesByAddress.set(series, read);
  read.catch(() => seriesByAddress.delete(series));
  return read;
}

/** Null when the Market doesn't exist (not opened yet, or closed after retention). */
export async function readMarket(market: AnyAddress): Promise<{ address: Address; data: Market } | null> {
  const { bytes } = await loadAccount(kit(market));
  return bytes ? { address: kit(market), data: getMarketDecoder().decode(bytes) } : null;
}

/** Null = the Ledger is closed; `seat` null = the owner has no seat (its first order pays `seatBond`). */
export async function readSeat(ledger: AnyAddress, owner: AnyAddress): Promise<{ seat: LedgerSeat | null; seatBond: bigint } | null> {
  const { bytes } = await loadAccount(kit(ledger));
  if (!bytes) return null;
  return { seat: findSeat(bytes, kit(owner)), seatBond: decodeLedgerHeader(bytes).seatBond };
}

/** Null when the Book account doesn't exist. A free or recycled Book still decodes; callers compare `market`. */
export async function readBook(book: AnyAddress): Promise<BookState | null> {
  const { bytes, slot } = await loadAccount(kit(book));
  return bytes ? decodeBook(kit(book), bytes, slot) : null;
}

/** `amountBase` null = no associated token account yet. */
export async function readTokenBalance(owner: AnyAddress, mint: AnyAddress): Promise<{ ata: Address; amountBase: bigint | null }> {
  const key = `${owner}:${mint}`;
  let derived = ataByOwnerMint.get(key);
  if (!derived) {
    derived = findAssociatedTokenPda({ owner: kit(owner), mint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS }).then(([pda]) => pda);
    ataByOwnerMint.set(key, derived);
  }
  const ata = await derived;
  const { bytes } = await loadAccount(ata);
  if (!bytes || bytes.byteLength < TOKEN_AMOUNT_OFFSET + 8) return { ata, amountBase: null };
  return { ata, amountBase: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(TOKEN_AMOUNT_OFFSET, true) };
}
