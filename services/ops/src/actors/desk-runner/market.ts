/**
 * What the market looks like for one candidate, right now (core `market.ts`): a real Jupiter quote at the exact
 * size, the venue's spot and mark from the feed, the spot against its own half-hour mean, the mint's flags, and how
 * old the reference is. For a live desk the reference age is the on-chain `DeskRef`'s (the program measures against
 * that one); for a practice desk it is the feed's own. Jupiter is paced: lite-api allows two seconds between calls.
 */
import { costBpsFor, gapOf, type DeskCandidate, type DeskMarketRead } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { DESK_MINTS, quoteSwap, USDC_MAINNET, type JupiterQuote } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import type { DeskStanding, RunnerContext } from "./types";
import { multiplierOf, pausedOf, priceView } from "./value";

const KEYLESS_GAP_MS = 2_100;
const KEYED_GAP_MS = 250;
/**
 * A posted reference older than this is re-posted before an action, so the program never sees one near its 900 s
 * limit; and a live desk whose reference the runner CAN refresh is read against the feed's latest values, because
 * that is what will be on chain when the action is sent (a never-posted `DeskRef` is all zeros: the gate would deny
 * every trade of a fresh desk otherwise, and nothing would ever post the first reference).
 */
export const REFERENCE_REFRESH_SEC = 300;
/**
 * The slippage every quote is asked for and every send carries as its own floor (the program's 8 % band floor is
 * the outer one, the gate's `MAX_COST_BPS` 250 bounds the whole cost). Measured on the C6 fork: OpenAI's route is
 * a thin Manifest book (169–203 bps of price impact on $100–$400), and at 50 bps Jupiter itself refused the fill
 * (6001, slippage) while 200 bps filled; Anthropic's Meteora route filled at 50.
 */
export const SLIPPAGE_BPS = 200;
let lastQuoteMs = 0;
let queue: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One Jupiter quote at a time, spaced for the endpoint in use; a failed quote is a null quote, never a thrown check. */
export function pacedQuote(ctx: RunnerContext, side: "buy" | "sell", symbol: PreIpoSymbol, amountIn: bigint): Promise<JupiterQuote | null> {
  const run = async () => {
    const gap = ctx.env.jupiterApiKey ? KEYED_GAP_MS : KEYLESS_GAP_MS;
    const wait = lastQuoteMs + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastQuoteMs = Date.now();
    const mint = DESK_MINTS[symbol];
    try {
      return await quoteSwap({ inputMint: side === "buy" ? USDC_MAINNET : mint, outputMint: side === "buy" ? mint : USDC_MAINNET, amount: amountIn, slippageBps: SLIPPAGE_BPS, ...(ctx.env.jupiterApiKey ? { apiKey: ctx.env.jupiterApiKey } : {}) });
    } catch (error) {
      ctx.log(`quote ${side} ${symbol} failed: ${errorText(error)}`);
      return null;
    }
  };
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

export interface MarketRead {
  market: DeskMarketRead;
  quote: JupiterQuote | null;
  /** The venue reference the program will measure against: the on-chain one for a live desk, the feed's for practice. */
  reference: { tokenPriceE8: bigint; markPriceE8: bigint; multiplierE12: bigint; fetchedAtSec: number } | null;
}

/** The read for `candidate` at `amountIn` (its own size unless a part was chosen). */
export async function readMarket(ctx: RunnerContext, standing: DeskStanding, candidate: DeskCandidate, amountIn: bigint, nowSec: number): Promise<MarketRead> {
  const symbol = candidate.symbol;
  const view = priceView(ctx.feed, symbol, nowSec);
  const multiplierE12 = multiplierOf(ctx.mints, symbol);
  const mint = DESK_MINTS[symbol] as string;
  const chainRef = standing.kind === "live" ? standing.chain.refs[mint] ?? null : null;
  // A live desk is measured against the posted reference while it is fresh; when the runner can refresh it (an
  // operator and an attestor key, not a dry run) the feed's latest values stand in, because `commit` posts exactly
  // those before the action is sent. Without the keys, the chain's own reference, stale or unposted, is the truth.
  const canRefresh = standing.kind === "live" && ctx.operator !== null && ctx.attestor !== null;
  const chainFresh = chainRef !== null && chainRef.fetchedAtSec > 0 && nowSec - chainRef.fetchedAtSec <= REFERENCE_REFRESH_SEC;
  const reference = chainRef && (chainFresh || !canRefresh)
    ? { tokenPriceE8: chainRef.tokenPriceE8, markPriceE8: chainRef.markPriceE8, multiplierE12: chainRef.multiplierE12, fetchedAtSec: chainRef.fetchedAtSec }
    : view && multiplierE12 !== null
      ? { tokenPriceE8: view.spotE8, markPriceE8: view.markE8, multiplierE12, fetchedAtSec: view.fetchedAtSec }
      : null;
  const quote = view ? await pacedQuote(ctx, candidate.side, symbol, amountIn) : null;
  const spotE8 = view?.spotE8 ?? 0n;
  const meanE8 = view?.meanE8 ?? spotE8;
  const gap = gapOf(spotE8, meanE8);
  const multiplier = multiplierE12 ?? 0n;
  const frozen = standing.kind === "live" ? (standing.frozen[symbol] ?? null) : false;
  const referenceAgeSec = reference ? Math.max(0, nowSec - reference.fetchedAtSec) : null;
  const market: DeskMarketRead = {
    atSec: nowSec,
    symbol,
    spotE8,
    meanE8,
    markE8: view?.markE8 ?? null,
    indexE8: null,
    multiplierE12: multiplier,
    // Without a multiplier nothing can be sized or floored: the reference counts as unavailable, whatever its age.
    referenceAgeSec: multiplierE12 === null ? null : referenceAgeSec,
    ...gap,
    premiumBps: view && view.markE8 > 0n ? Number(((spotE8 - view.markE8) * 10_000n) / view.markE8) : null,
    indexPremiumBps: null,
    quoteOut: quote?.outAmount ?? null,
    costBps: quote && multiplier > 0n ? costBpsFor(candidate.side, amountIn, quote.outAmount, spotE8, multiplier) : null,
    routeAccounts: null,
    mintPaused: pausedOf(ctx.mints, symbol),
    accountFrozen: frozen,
  };
  return { market, quote, reference };
}
