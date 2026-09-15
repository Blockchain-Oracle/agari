/**
 * The holdings read (session-lanes.md §4, D-058): one owner's verified share tokens on mainnet, read-only, sized in
 * integers. Two RPC calls per owner — every Token-2022 account the owner has, then the few verified mints it holds for
 * their `scaledUiAmountConfig` — plus one ops `/prices/latest` snapshot for the underlyings. Server-only: the RPC URL
 * carries the Helius key, so it is never logged, echoed or thrown.
 */
import { SHARE_TOKENS, type ShareToken, type TickerSymbol } from "@agari/core/market";
import { z } from "zod";
import { effectiveMultiplierE12, exposureUsdE6, sharesE8, type ScaledUiAmountState } from "./scaled-amount";

const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const RPC_TIMEOUT_MS = 7_000;
const MINT_MEMO_MS = 60_000;

export interface Holding {
  mint: string;
  symbol: ShareToken["symbol"];
  issuer: ShareToken["issuer"];
  underlying: TickerSymbol;
  /** Integers as decimal strings: the wire carries no bigint. */
  rawAmount: string;
  decimals: number;
  multiplierE12: string;
  sharesE8: string;
  /** Null when ops has no fresh spot for the underlying (it serves ≤ 60 s old quotes only). */
  priceE8: string | null;
  exposureUsdE6: string | null;
}

export interface HoldingsBody {
  owner: string;
  cluster: "mainnet-beta";
  asOfSec: number;
  holdings: Holding[];
}

export interface HoldingsInput {
  owner: string;
  /** A mainnet RPC URL (Helius with the server key). */
  rpcUrl: string;
  /** The ops HTTP base; null leaves every price and exposure null. */
  priceFeedUrl: string | null;
  nowSec: number;
}

/** An RPC or price failure with a message that never contains the URL. */
export class HoldingsReadError extends Error {}

const VERIFIED = new Map(SHARE_TOKENS.map((token) => [token.mint as string, token]));

const tokenAccountsSchema = z.object({
  value: z.array(
    z.object({
      account: z.object({
        data: z.object({ parsed: z.object({ info: z.object({ mint: z.string(), tokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.number().int() }) }) }) }),
      }),
    }),
  ),
});

const scaledStateSchema = z.object({ multiplier: z.string(), newMultiplier: z.string(), newMultiplierEffectiveTimestamp: z.number().int() });
const mintsSchema = z.object({
  value: z.array(
    z
      .object({
        data: z.object({
          parsed: z.object({ info: z.object({ decimals: z.number().int(), extensions: z.array(z.object({ extension: z.string(), state: z.unknown() })).optional() }) }),
        }),
      })
      .nullable(),
  ),
});
const latestSchema = z.record(z.string(), z.object({ priceE8: z.string().regex(/^\d+$/) }));

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new HoldingsReadError(`${method}: ${error instanceof Error && error.name === "TimeoutError" ? "timed out" : "unreachable"}`);
  }
  if (!response.ok) throw new HoldingsReadError(`${method}: HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { code?: number } };
  if (body.error) throw new HoldingsReadError(`${method}: RPC error ${body.error.code ?? "unknown"}`);
  return body.result;
}

/** Balances summed per verified mint (an owner may hold one mint in several accounts). */
async function verifiedBalances(input: HoldingsInput): Promise<Map<string, { raw: bigint; decimals: number }>> {
  const result = await rpc(input.rpcUrl, "getTokenAccountsByOwner", [input.owner, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const parsed = tokenAccountsSchema.parse(result);
  const balances = new Map<string, { raw: bigint; decimals: number }>();
  for (const { account } of parsed.value) {
    const { mint, tokenAmount } = account.data.parsed.info;
    if (!VERIFIED.has(mint)) continue;
    const raw = BigInt(tokenAmount.amount);
    if (raw === 0n) continue;
    const prior = balances.get(mint);
    balances.set(mint, { raw: (prior?.raw ?? 0n) + raw, decimals: tokenAmount.decimals });
  }
  return balances;
}

let mintMemo: { atMs: number; states: Map<string, ScaledUiAmountState | null> } | null = null;

/** Every verified mint's `scaledUiAmountConfig` in one call, memoized a minute (the effective value is picked per request). */
async function mintStates(rpcUrl: string): Promise<Map<string, ScaledUiAmountState | null>> {
  if (mintMemo && Date.now() - mintMemo.atMs < MINT_MEMO_MS) return mintMemo.states;
  const mints = [...VERIFIED.keys()];
  const parsed = mintsSchema.parse(await rpc(rpcUrl, "getMultipleAccounts", [mints, { encoding: "jsonParsed", commitment: "confirmed" }]));
  const states = new Map<string, ScaledUiAmountState | null>();
  parsed.value.forEach((account, index) => {
    const extension = account?.data.parsed.info.extensions?.find((e) => e.extension === "scaledUiAmountConfig");
    const state = extension ? scaledStateSchema.safeParse(extension.state) : null;
    states.set(mints[index] as string, state?.success ? state.data : null);
  });
  mintMemo = { atMs: Date.now(), states };
  return states;
}

/** Spot is display-only context for the card; a dead ops process leaves exposure unknown, never zero. */
async function latestPrices(priceFeedUrl: string | null): Promise<Record<string, { priceE8: string }>> {
  if (!priceFeedUrl) return {};
  try {
    const response = await fetch(`${priceFeedUrl.replace(/\/$/, "")}/prices/latest`, { cache: "no-store", signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
    if (!response.ok) return {};
    const parsed = latestSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

const descending = (a: bigint, b: bigint): number => (a > b ? -1 : a < b ? 1 : 0);

export async function readHoldings(input: HoldingsInput): Promise<HoldingsBody> {
  const balances = await verifiedBalances(input);
  const [states, prices] = balances.size === 0 ? [new Map<string, ScaledUiAmountState | null>(), {}] : await Promise.all([mintStates(input.rpcUrl), latestPrices(input.priceFeedUrl)]);
  const holdings: Holding[] = [];
  for (const [mint, { raw, decimals }] of balances) {
    const token = VERIFIED.get(mint) as ShareToken;
    const multiplier = effectiveMultiplierE12(states.get(mint) ?? null, input.nowSec);
    // A multiplier the RPC printed in a form we can't read exactly is a holding we won't size.
    if (multiplier === null) continue;
    const shares = sharesE8(raw, decimals, multiplier);
    const price = prices[token.underlying]?.priceE8;
    holdings.push({
      mint,
      symbol: token.symbol,
      issuer: token.issuer,
      underlying: token.underlying,
      rawAmount: raw.toString(),
      decimals,
      multiplierE12: multiplier.toString(),
      sharesE8: shares.toString(),
      priceE8: price ?? null,
      exposureUsdE6: price ? exposureUsdE6(shares, BigInt(price)).toString() : null,
    });
  }
  holdings.sort((a, b) => descending(BigInt(a.exposureUsdE6 ?? "0"), BigInt(b.exposureUsdE6 ?? "0")) || descending(BigInt(a.sharesE8), BigInt(b.sharesE8)));
  return { owner: input.owner, cluster: "mainnet-beta", asOfSec: input.nowSec, holdings };
}
