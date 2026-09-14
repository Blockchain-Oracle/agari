import { TICKERS, TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";

/** `MAKER_MODE=seat` knobs (venue-ops.md §8). Integers only; σ in annualized basis points. */
export interface SeatMakerEnv {
  /** Null = every launch ticker whose Series has a covering version. */
  symbols: TickerSymbol[] | null;
  cadencesSec: number[];
  sigmaBps: (symbol: TickerSymbol) => number;
  halfSpreadTicks: number;
  quoteLots: bigint;
  quoteTtlSec: number;
  requoteTicks: number;
  minTick: number;
  /** Base units (6 dp): both sides' escrow on one Window. */
  maxCashPerWindow: bigint;
  refreshMs: number;
  spotMaxAgeSec: number;
}

const num = (raw: string | undefined, fallback: number, min: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
};

/** `MM_SIGMA_BPS=4500` or `MM_SIGMA_BPS=TSLA:6000,QQQ:1800`; defaults 4,500 for stocks and 2,000 for ETFs. */
function sigmaTable(raw: string | undefined): (symbol: TickerSymbol) => number {
  const perSymbol = new Map<string, number>();
  let all: number | null = null;
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split(":");
    if (b === undefined) all = num(a, 0, 1) || null;
    else perSymbol.set(a!.toUpperCase(), num(b, 0, 1));
  }
  return (symbol) => perSymbol.get(symbol) || all || (TICKERS[symbol].kind === "etf" ? 2_000 : 4_500);
}

export function readSeatMakerEnv(env: NodeJS.ProcessEnv = process.env): SeatMakerEnv {
  const symbols = (env.MM_SYMBOLS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s): s is TickerSymbol => (TICKER_SYMBOLS as readonly string[]).includes(s));
  const cadences = (env.MM_CADENCES ?? "").split(",").map(Number).filter((n) => [300, 900, 3_600].includes(n));
  const cash = Number(env.MM_MAX_CASH_PER_WINDOW);
  return {
    symbols: symbols.length ? symbols : null,
    cadencesSec: cadences.length ? cadences : [300, 900, 3_600],
    sigmaBps: sigmaTable(env.MM_SIGMA_BPS),
    halfSpreadTicks: num(env.MM_HALF_SPREAD_TICKS, 30, 1),
    quoteLots: BigInt(num(env.MM_QUOTE_LOTS, 5_000, 1)),
    quoteTtlSec: num(env.MM_QUOTE_TTL_SEC, 120, 30),
    requoteTicks: num(env.MM_REQUOTE_TICKS, 10, 1),
    minTick: num(env.MM_MIN_TICK, 20, 1),
    maxCashPerWindow: BigInt(Number.isInteger(cash) && cash > 0 ? cash : 50) * 1_000_000n,
    refreshMs: num(env.MM_REFRESH_MS, 10_000, 2_000),
    spotMaxAgeSec: num(env.MM_SPOT_MAX_AGE_SEC, 30, 5),
  };
}
