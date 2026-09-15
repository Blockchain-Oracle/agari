import { AGARI_EVENTS_PROGRAM_ADDRESS, findMvaultPda, getUserPlaceOrderInstructionAsync } from "@agari/clients/agari-events";
import type { Address as CoreAddress, EventMarket, Quote, Side } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address, Instruction, TransactionSigner } from "@solana/kit";
import { eventAuthorityAddress } from "../events";
import { ORDER_KIND, ORDER_TYPE, SELF_MATCH_CANCEL_TAKER } from "../order-codes";
import { buildWrite, type BuiltWrite, type WriteRpc } from "./message";

/** Per-placement budgets a user order asks for, each clamped to its Series cap (events-engine.md §3.3). */
const MAX_FILLS = 16;
const MAX_EVICTIONS = 16;
/** `seat_hint = u16::MAX`: the first empty seat; only for a wallet holding no seat on this Window (D-020, D-027). */
export const ANY_SEAT = 0xffff;

/** The Series facts an order is priced and sized on (a structural subset of the runtime's `SeriesFacts`). */
export interface OrderSeries {
  lotBase: bigint;
  tickBase: bigint;
  fillsCap: number;
  evictionsCap: number;
}

export interface OrderBuildInput {
  signer: TransactionSigner;
  market: Pick<EventMarket, "marketId" | "seriesAddress" | "poolAddress" | "collateral">;
  ledger: CoreAddress;
  series: OrderSeries;
  side: Side;
  quote: Quote;
  expireTs: number;
  /** The wallet's seat index on this Window's Ledger, or null when it holds none yet. */
  seatIndex: number | null;
  /** The `order_type` code: IOC (default) for a taker; the rest lane passes post-only, a call that rests at the quote's limit (D-088). */
  orderType?: number;
}

const kit = (value: string) => value as Address;

function exactly(raw: bigint, unit: bigint, what: string): bigint {
  if (unit <= 0n || raw % unit !== 0n) throw new Error(`${what} ${raw} is not a whole multiple of ${unit}`);
  return raw / unit;
}

/**
 * `user_place_order` for a buy: Up = BUY_YES, Down = BUY_NO at the confirmed quote's YES-terms limit (canon #7, D-033).
 * A taker is immediate-or-cancel; a pre-open call is post-only and rests (D-088). A taker never rests, so it never
 * self-matches; a resting call meeting its own taker cancels the taker (`SelfMatch::CancelTaker`). Credit funds first.
 */
export async function orderInstruction(input: OrderBuildInput): Promise<Instruction> {
  const { signer, market, series, quote } = input;
  const marketAddress = kit(market.marketId);
  const mint = kit(market.collateral);
  const [[mvault], [authorityToken], eventAuthority] = await Promise.all([
    findMvaultPda({ market: marketAddress }),
    findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    eventAuthorityAddress(),
  ]);
  return getUserPlaceOrderInstructionAsync({
    authority: signer,
    series: kit(market.seriesAddress),
    market: marketAddress,
    book: kit(market.poolAddress),
    ledger: kit(input.ledger),
    mvault,
    authorityToken,
    collateralMint: mint,
    eventAuthority,
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    kind: input.side === "up" ? ORDER_KIND.buyYes : ORDER_KIND.buyNo,
    priceTicks: Number(exactly(quote.limitPriceRaw, series.tickBase, "limit price")),
    lots: exactly(quote.contractsRaw, series.lotBase, "size"),
    expireTs: input.expireTs,
    orderType: input.orderType ?? ORDER_TYPE.ioc,
    selfMatch: SELF_MATCH_CANCEL_TAKER,
    maxFills: Math.min(MAX_FILLS, series.fillsCap),
    maxEvictions: Math.min(MAX_EVICTIONS, series.evictionsCap),
    seatHint: input.seatIndex ?? ANY_SEAT,
    useCredit: true,
    withdrawProceeds: false,
    clientId: 0,
  });
}

/** The order's v0 message, paid by the wallet (D-023), simulated and compute-limited. Throws `SimulationFailedError`. */
export async function buildOrder(rpc: WriteRpc, input: OrderBuildInput): Promise<BuiltWrite> {
  return buildWrite(rpc, input.signer, [await orderInstruction(input)]);
}
