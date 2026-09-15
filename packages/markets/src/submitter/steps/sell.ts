/**
 * The wallet route's cash-out sell (L-35, tap-trading.md §1.4): `user_place_order` SELL_YES / SELL_NO, IOC, from the
 * wallet's own seat, never drawing credit and withdrawing the proceeds to the ATA, so the seat's bond waits for redeem.
 * Booked from `OrderExecuted`: contracts sold, `costBase` 0, `proceedsBase` the cash received.
 */
import { AGARI_EVENTS_PROGRAM_ADDRESS, findMvaultPda, getUserPlaceOrderInstructionAsync } from "@agari/clients/agari-events";
import type { BookedOrder } from "@agari/core/ports";
import type { EventMarket, ExitQuote } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address, Instruction, TransactionSigner } from "@solana/kit";
import { eventAuthorityAddress, type WriteEvent } from "../events";
import { ORDER_KIND, ORDER_TYPE, SELF_MATCH_CANCEL_TAKER } from "../order-codes";
import type { BookContext } from "./book";
import type { OrderSeries } from "./build";

const PAIR_TICKS = 1000n;
const BPS_PER_TICK = 10n;
const MAX_FILLS = 16;
const MAX_EVICTIONS = 16;

export interface SellBuildInput {
  signer: TransactionSigner;
  market: Pick<EventMarket, "marketId" | "seriesAddress" | "poolAddress" | "collateral">;
  ledger: string;
  series: OrderSeries;
  side: "up" | "down";
  exit: Pick<ExitQuote, "contractsRaw" | "limitPriceRaw">;
  expireTs: number;
  /** The wallet's seat on this Window: a sell always comes from a seat that holds the side. */
  seatIndex: number;
}

function exactly(raw: bigint, unit: bigint, what: string): bigint {
  if (unit <= 0n || raw % unit !== 0n) throw new Error(`${what} ${raw} is not a whole multiple of ${unit}`);
  return raw / unit;
}

export async function sellInstruction(input: SellBuildInput): Promise<Instruction> {
  const { signer, market, series, exit } = input;
  const marketAddress = market.marketId as string as Address;
  const mint = market.collateral as string as Address;
  const [[mvault], [authorityToken], eventAuthority] = await Promise.all([
    findMvaultPda({ market: marketAddress }),
    findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    eventAuthorityAddress(),
  ]);
  return getUserPlaceOrderInstructionAsync({
    authority: signer,
    series: market.seriesAddress as string as Address,
    market: marketAddress,
    book: market.poolAddress as string as Address,
    ledger: input.ledger as Address,
    mvault,
    authorityToken,
    collateralMint: mint,
    eventAuthority,
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    kind: input.side === "up" ? ORDER_KIND.sellYes : ORDER_KIND.sellNo,
    priceTicks: Number(exactly(exit.limitPriceRaw, series.tickBase, "limit price")),
    lots: exactly(exit.contractsRaw, series.lotBase, "size"),
    expireTs: input.expireTs,
    orderType: ORDER_TYPE.ioc,
    selfMatch: SELF_MATCH_CANCEL_TAKER,
    maxFills: Math.min(MAX_FILLS, series.fillsCap),
    maxEvictions: Math.min(MAX_EVICTIONS, series.evictionsCap),
    seatHint: input.seatIndex,
    useCredit: false,
    withdrawProceeds: true,
    clientId: 0,
  });
}

/** What was sold is what `OrderExecuted` says: fill prices are YES ticks, a NO seller receives the complement. */
export function bookSellFromEvents(events: readonly WriteEvent[], ctx: BookContext): BookedOrder | null {
  const executed = events.find((e) => e.name === "OrderExecuted" && e.data.taker === (ctx.wallet as string) && e.data.market === (ctx.marketId as string));
  if (!executed || executed.name !== "OrderExecuted" || executed.data.filledLots === 0n) return null;
  const { data } = executed;
  const ownTicksLots = data.fills.reduce((sum, fill) => sum + fill.lots * (data.kind === ORDER_KIND.sellNo ? PAIR_TICKS - BigInt(fill.price) : BigInt(fill.price)), 0n);
  return {
    marketId: ctx.marketId,
    side: ctx.side,
    contractsRaw: data.filledLots * ctx.lotBase,
    costBase: 0n,
    proceedsBase: data.cashReceived,
    avgPriceBps: Number((ownTicksLots * BPS_PER_TICK) / data.filledLots),
    txHash: ctx.txHash,
    fillCount: data.fills.length,
  };
}
