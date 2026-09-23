import { TICKERS, TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";

/**
 * The landing's "Built on" figures (S25), pure over the index's `status/prints` rows (the `/status` print-source mix):
 * how many Windows closed on a PreStocks price and how many on a Pyth print, and on which names. Nothing is claimed that
 * the rows do not hold: the names are the rows' own, so a lane that stops settling on a source drops out of its line.
 */

/** 2026-09-11 00:00Z: the first day of the venue's price policies (`price-sources.json` `validFrom`); every Window since. */
export const BUILT_ON_FROM_SEC = 1_789_084_800;

/** The index's print codes (`idx_prints.which` / `.source`, agari-events `Source`). */
const CLOSE_PRINT = 1;
const SOURCE = { pyth: 1, attested: 4 } as const;

/** One `status/prints` row: a lane (`symbol`, `cadence_sec`), a print slot and its source, and how many Windows hold it. */
export interface MixRow {
  symbol: string | null;
  which: number | null;
  source: number | null;
  windows: number;
}

export interface SourceTally {
  /** Windows whose closing print came from this source. */
  windows: number;
  /** Listed names, registry order. */
  names: TickerSymbol[];
  /** Baskets among them (PreStocks only). */
  baskets: TickerSymbol[];
}

export interface BuiltOnTally {
  prestocks: SourceTally;
  pyth: SourceTally;
}

const isTicker = (symbol: string | null): symbol is TickerSymbol => symbol !== null && (TICKER_SYMBOLS as readonly string[]).includes(symbol);
const isPreStocks = (symbol: TickerSymbol): boolean => TICKERS[symbol].kind === "preIpo" || TICKERS[symbol].kind === "basket";

function tally(rows: readonly MixRow[], keep: (row: MixRow & { symbol: TickerSymbol }) => boolean): SourceTally {
  let windows = 0;
  const seen = new Set<TickerSymbol>();
  for (const row of rows) {
    if (row.which !== CLOSE_PRINT || !isTicker(row.symbol)) continue;
    const r = row as MixRow & { symbol: TickerSymbol };
    if (!keep(r)) continue;
    windows += row.windows;
    seen.add(r.symbol);
  }
  const ordered = TICKER_SYMBOLS.filter((s) => seen.has(s));
  return { windows, names: ordered.filter((s) => TICKERS[s].kind !== "basket"), baskets: ordered.filter((s) => TICKERS[s].kind === "basket") };
}

/** A PreStocks close is an attested print on a pre-IPO name or a basket; a Pyth close is a Pyth print on any name. */
export function builtOnTally(rows: readonly MixRow[]): BuiltOnTally {
  return {
    prestocks: tally(rows, (r) => r.source === SOURCE.attested && isPreStocks(r.symbol)),
    pyth: tally(rows, (r) => r.source === SOURCE.pyth),
  };
}

/** The source code a proof link's Window must have closed on. */
export const PROOF_SOURCE = { prestocks: SOURCE.attested, pyth: SOURCE.pyth } as const;

/** "OpenAI", "OpenAI and Anthropic", "TSLA, QQQ and VOO": a listed name by its ticker, a pre-IPO name by its company. */
export function namesLine(names: readonly TickerSymbol[]): string {
  const words = names.map((s) => (TICKERS[s].kind === "preIpo" ? TICKERS[s].name : s));
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
