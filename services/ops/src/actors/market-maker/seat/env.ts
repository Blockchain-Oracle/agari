import { TICKERS, TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";

/** `MAKER_MODE=seat` knobs (venue-ops.md §8). Integers only; σ in annualized basis points. */
export interface SeatMakerEnv {
  /**
   * `MM_SYMBOLS=OPENAI,AILABS,PREALL` limits the maker to these registry symbols (a basket is one, S19); null = every
   * listed Series the maker may quote (`laneListable`).
   */
  symbols: TickerSymbol[] | null;
  cadencesSec: number[];
  sigmaBps: (symbol: TickerSymbol) => number;
  halfSpreadTicks: number;
  /** `MM_ORDER_TYPE`: `post-only` rests only (default, today's behaviour); `limit` also takes resting user calls (D-090). */
  orderType: "post-only" | "limit";
  quoteLots: bigint;
  quoteTtlSec: number;
  requoteTicks: number;
  minTick: number;
  /** Base units (6 dp): both sides' escrow on one Window. */
  maxCashPerWindow: bigint;
  /** Gap lane cap per Window, base units (`MM_GAP_MAX_CASH`, default 25 tUSDC; session-lanes.md §1.5). */
  gapMaxCash: bigint;
  /** Token lane cap per Window, base units (`MM_TOKEN_MAX_CASH_PER_WINDOW`, default 10 tUSDC; §2.4). */
  tokenMaxCashPerWindow: bigint;
  refreshMs: number;
  spotMaxAgeSec: number;
}

const num = (raw: string | undefined, fallback: number, min: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
};

/**
 * `MM_SIGMA_BPS=4500` or `MM_SIGMA_BPS=TSLA:6000,QQQ:1800,AILABS:3500`, annualized basis points. Defaults: 4,500 for a
 * stock and a pre-IPO name, 2,000 for an ETF, 3,000 for a basket (S19): an equal-weight group of 2–8 names moves less
 * than any one of them, and no basket has traded long enough to measure; override per symbol once it has.
 */
export const DEFAULT_SIGMA_BPS = { stock: 4_500, etf: 2_000, preIpo: 4_500, basket: 3_000 } as const;

function sigmaTable(raw: string | undefined): (symbol: TickerSymbol) => number {
  const perSymbol = new Map<string, number>();
  let all: number | null = null;
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split(":");
    if (b === undefined) all = num(a, 0, 1) || null;
    else perSymbol.set(a!.toUpperCase(), num(b, 0, 1));
  }
  return (symbol) => perSymbol.get(symbol) || all || DEFAULT_SIGMA_BPS[TICKERS[symbol].kind];
}

export function readSeatMakerEnv(env: NodeJS.ProcessEnv = process.env): SeatMakerEnv {
  const symbols = (env.MM_SYMBOLS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s): s is TickerSymbol => (TICKER_SYMBOLS as readonly string[]).includes(s));
  const cadences = (env.MM_CADENCES ?? "").split(",").map(Number).filter((n) => [300, 900, 3_600].includes(n));
  const tusdc = (raw: string | undefined, fallback: number) => BigInt(num(raw, fallback, 1)) * 1_000_000n;
  const cash = Number(env.MM_MAX_CASH_PER_WINDOW);
  return {
    symbols: symbols.length ? symbols : null,
    cadencesSec: cadences.length ? cadences : [300, 900, 3_600],
    sigmaBps: sigmaTable(env.MM_SIGMA_BPS),
    halfSpreadTicks: num(env.MM_HALF_SPREAD_TICKS, 30, 1),
    orderType: env.MM_ORDER_TYPE?.trim().toLowerCase() === "limit" ? "limit" : "post-only",
    quoteLots: BigInt(num(env.MM_QUOTE_LOTS, 5_000, 1)),
    quoteTtlSec: num(env.MM_QUOTE_TTL_SEC, 120, 30),
    requoteTicks: num(env.MM_REQUOTE_TICKS, 10, 1),
    minTick: num(env.MM_MIN_TICK, 20, 1),
    maxCashPerWindow: BigInt(Number.isInteger(cash) && cash > 0 ? cash : 50) * 1_000_000n,
    gapMaxCash: tusdc(env.MM_GAP_MAX_CASH, 25),
    tokenMaxCashPerWindow: tusdc(env.MM_TOKEN_MAX_CASH_PER_WINDOW, 10),
    refreshMs: num(env.MM_REFRESH_MS, 10_000, 2_000),
    spotMaxAgeSec: num(env.MM_SPOT_MAX_AGE_SEC, 30, 5),
  };
}
