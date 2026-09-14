/** What the relay reads from `services/ops/config/price-sources.json` (D-003): feeds, signers, gateways, trial end. */
import { readFileSync } from "node:fs";
import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { REDSTONE_GATEWAY } from "@agari/markets/ops/prints";

export interface RelaySources {
  redstoneFeeds: Array<{ symbol: TickerSymbol; feed: string }>;
  pythFeeds: Array<{ symbol: TickerSymbol; feedIdHex: string }>;
  /** Lower-case 0x EVM addresses of the configured RedStone signers (the on-chain set). */
  redstoneSigners: ReadonlySet<string>;
  /** Required signers while `now ≤ T + strict_sec`, and the threshold after it. */
  redstoneSignerCount: number;
  redstoneThreshold: number;
  gateways: string[];
  /** Boundaries after this are outside the Pyth trial (`pythTrial.lastCoveredClose`). */
  pythTrialLastSec: number;
}

type Raw = {
  defaults: { redstone: { threshold: number } };
  redstone: Record<string, unknown> & { gateway?: string };
  pythTrial: { lastCoveredClose: string };
  tickers: Record<string, { pythFeedId?: string; redstoneFeedId?: string }>;
};

const CONFIG_URL = new URL("../../../config/price-sources.json", import.meta.url);
const isSymbol = (s: string): s is TickerSymbol => (TICKER_SYMBOLS as readonly string[]).includes(s);

export function loadRelaySources(env: NodeJS.ProcessEnv = process.env): RelaySources {
  const raw = JSON.parse(readFileSync(CONFIG_URL, "utf8")) as Raw;
  const signers = raw.redstone["signersObserved_2026-09-13"];
  if (!Array.isArray(signers) || signers.length !== 5) throw new Error("price-sources.json: expected 5 RedStone signers");
  const symbols = Object.keys(raw.tickers).filter(isSymbol);
  const fromEnv = (env.REDSTONE_GATEWAY_URLS ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return {
    redstoneFeeds: symbols.flatMap((symbol) => (raw.tickers[symbol]!.redstoneFeedId ? [{ symbol, feed: raw.tickers[symbol]!.redstoneFeedId! }] : [])),
    pythFeeds: symbols.flatMap((symbol) => (raw.tickers[symbol]!.pythFeedId ? [{ symbol, feedIdHex: raw.tickers[symbol]!.pythFeedId!.toLowerCase() }] : [])),
    redstoneSigners: new Set(signers.map((s) => String(s).toLowerCase())),
    redstoneSignerCount: signers.length,
    redstoneThreshold: raw.defaults.redstone.threshold,
    gateways: fromEnv.length > 0 ? fromEnv : [raw.redstone.gateway ?? REDSTONE_GATEWAY],
    pythTrialLastSec: Date.parse(raw.pythTrial.lastCoveredClose) / 1000,
  };
}
