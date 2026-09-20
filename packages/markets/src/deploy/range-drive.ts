/**
 * The S10b drive: supply the reserve, open a round against a live Window, settle it and claim.
 *
 * Scripts may not import the chain SDKs (plan §6), so the whole drive lives here and `scripts/drive/range-round.ts`
 * passes plain values. Each step re-derives its PDAs rather than trusting a caller's, so a drive cannot be pointed
 * at the wrong reserve by a typo.
 */
import {
  fetchMaybeReserve, fetchMaybeRound, findReservePda, findVaultPda,
  getOwnerOpenRoundInstructionAsync, getProviderSupplyInstructionAsync,
  getPublicClaimRoundInstructionAsync, getPublicSettleRoundInstructionAsync,
  AGARI_RANGE_PROGRAM_ADDRESS,
} from "@agari/clients/agari-range";
import { bandProbE6, centerQE6OfTicks, floorStake, sideProbRaw } from "@agari/core/range";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AGARI_EVENTS_PROGRAM_ADDRESS } from "@agari/clients/agari-events";
import { getAddressEncoder, getI64Encoder, getProgramDerivedAddress, getU64Encoder, type Address, type KeyPairSigner } from "@solana/kit";
import { seriesAddress } from "./ensure-series";
import { windowAddresses } from "./cycle/accounts";
import { fundUser, KIND, ORDER_TYPE, placeOrder } from "./cycle/window";
import { send, type SendContext } from "./send";

const ONE = 1_000_000n;
/** The chain re-prices at its own clock, so the cap carries `RANGE_STAKE_HEADROOM_BPS` over the quote. */
const HEADROOM_BPS = 10_300n;

export async function roundAddressOf(roundId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: AGARI_RANGE_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("round"), getU64Encoder().encode(roundId)],
  });
  return pda;
}

export async function expiryBookAddressOf(expirySec: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: AGARI_RANGE_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("expiry"), getI64Encoder().encode(expirySec)],
  });
  return pda;
}

async function reserveContext(ctx: SendContext) {
  const [reserve] = await findReservePda();
  const [vault] = await findVaultPda();
  const account = await fetchMaybeReserve(ctx.client.rpc, reserve);
  if (!account.exists) throw new Error(`reserve ${reserve} is not initialised — run scripts/deploy/init-range.ts`);
  const [payerToken] = await findAssociatedTokenPda({
    owner: ctx.client.payer.address,
    mint: account.data.collateralMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return { reserve, vault, account, mint: account.data.collateralMint, payerToken };
}

export async function supplyRange(ctx: SendContext, amountBase: bigint) {
  const { vault, mint, payerToken, reserve } = await reserveContext(ctx);
  const ix = await getProviderSupplyInstructionAsync({
    provider: ctx.client.payer, providerToken: payerToken, collateralMint: mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS, amountBase,
  });
  const signature = await send(ctx, "supply", [ix], `${amountBase} base units into ${vault}`);
  const after = await fetchMaybeReserve(ctx.client.rpc, reserve);
  return { signature, shares: after.exists ? after.data.supplyShares : 0n };
}

/**
 * The Window a symbol and cadence are trading right now, derived rather than looked up: a drive that reads the
 * live id off the running app cannot run when the app is not running, and the lane rolls every hour.
 * `series.nextIndex - 1` is the newest Window the roller opened.
 */
export async function liveWindowFor(ctx: SendContext, seriesId: number, cadenceSec: number, basis: number): Promise<{ marketId: Address; index: bigint }> {
  const series = await seriesAddress(seriesId, cadenceSec, basis);
  const account = await ctx.client.agariEvents.accounts.series.fetch(series);
  const index = account.data.nextIndex - 1n;
  if (index < 0n) throw new Error(`series ${series} has opened no Windows yet`);
  const [marketId] = await getProgramDerivedAddress({
    programAddress: AGARI_EVENTS_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("market"), getAddressEncoder().encode(series), getU64Encoder().encode(index)],
  });
  return { marketId, index };
}

/** What a Window looks like to the reserve right now: the mark it would price against, and how old it is. */
export async function probeWindow(ctx: SendContext, marketId: Address) {
  const market = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  return {
    marketId,
    openingPrint: market.data.open.price,
    lastPrice: market.data.lastPrice,
    lastTradeAgeSec: market.data.lastTradeTs > 0n ? Number(nowSec - market.data.lastTradeTs) : null,
    tradeCount: market.data.tradeCount,
    expirySec: market.data.expiry,
    secondsLeft: Number(market.data.expiry - nowSec),
    state: market.data.state,
  };
}

export interface OpenRangeInput {
  marketId: Address;
  /** Half-width of the band as a fraction of the opening print, in basis points. */
  widthBps: bigint;
  maxPayoutBase: bigint;
  isInside: boolean;
}

export async function openRangeRound(ctx: SendContext, input: OpenRangeInput) {
  const { account, mint, payerToken } = await reserveContext(ctx);
  const market = await ctx.client.agariEvents.accounts.market.fetch(input.marketId);
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const openingPrint = market.data.open.price;
  const tauSec = Number(market.data.expiry - nowSec);
  const centerQE6 = centerQE6OfTicks(market.data.lastPrice);
  const params = account.data.params;

  const width = (openingPrint * input.widthBps) / 10_000n;
  const lowPrint = openingPrint - width;
  const highPrint = openingPrint + width;
  const insideProbE6 = bandProbE6(openingPrint, lowPrint, highPrint, centerQE6, params.sigmaE8, tauSec);
  const probRaw = sideProbRaw(insideProbE6, input.isInside ? "inside" : "outside", ONE);
  const stakeBase = floorStake(input.maxPayoutBase, probRaw, ONE, params.marginBps);

  const roundId = account.data.nextRoundId;
  const round = await roundAddressOf(roundId);
  const ix = await getOwnerOpenRoundInstructionAsync({
    owner: ctx.client.payer,
    round,
    expiryBook: await expiryBookAddressOf(market.data.expiry),
    ownerToken: payerToken,
    collateralMint: mint,
    market: input.marketId,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    isInside: input.isInside,
    lowPrint,
    highPrint,
    maxPayoutBase: input.maxPayoutBase,
    maxStakeBase: (stakeBase * HEADROOM_BPS) / 10_000n,
    expirySec: market.data.expiry,
  });
  const signature = await send(ctx, "open round", [ix], `round ${roundId} on ${input.marketId}`);
  const opened = await fetchMaybeRound(ctx.client.rpc, round);
  return {
    signature, roundId, round, openingPrint, lowPrint, highPrint, tauSec, centerQE6, insideProbE6,
    quotedStakeBase: stakeBase,
    booked: opened.exists ? opened.data : null,
  };
}

export async function settleRangeRound(ctx: SendContext, roundId: bigint) {
  const { mint, payerToken } = await reserveContext(ctx);
  const address = await roundAddressOf(roundId);
  const round = await fetchMaybeRound(ctx.client.rpc, address);
  if (!round.exists) throw new Error(`round ${roundId} not found at ${address}`);
  const settle = await getPublicSettleRoundInstructionAsync({
    cranker: ctx.client.payer, round: address,
    expiryBook: await expiryBookAddressOf(round.data.expirySec),
    market: round.data.market,
  });
  const signature = await send(ctx, "settle round", [settle], `round ${roundId} on ${round.data.market}`);
  const after = await fetchMaybeRound(ctx.client.rpc, address);
  const status = after.exists ? Number(after.data.status) : -1;
  // 1 Won, 3 Void both pay; 2 Lost pays nothing, so there is nothing to claim.
  let claimSignature: string | null = null;
  if (status === 1 || status === 3) {
    const claim = await getPublicClaimRoundInstructionAsync({
      cranker: ctx.client.payer, round: address, ownerToken: payerToken,
      collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    claimSignature = await send(ctx, "claim round", [claim], `round ${roundId}`);
  }
  return { signature, claimSignature, status, closingPrint: after.exists ? after.data.closingPrint : null };
}

/**
 * Put a real mark on a Window by crossing two independent wallets.
 *
 * The reserve refuses to price a Window the venue has never traded (`StaleMark`), which is correct: there is no
 * "where the market sits" without a trade. On a quiet devnet lane the house maker's quotes come and go, so a drive
 * that waits for one is a drive that usually does not run. This rests a bid from the payer and takes it from a
 * second wallet the caller funds, which is an ordinary two-sided trade and leaves an ordinary last price.
 */
export async function markWindow(ctx: SendContext, marketId: Address, taker: KeyPairSigner, faucet: KeyPairSigner, priceTicks: number, lots: bigint) {
  const market = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  // The reserve and the venue share one collateral: the reserve records it at init from the venue's own config.
  const { mint } = await reserveContext(ctx);
  const window = {
    ...(await windowAddresses(market.data.series, market.data.index)),
    book: market.data.book,
    mint,
    tradingStartSec: Number(market.data.tradingStart),
    expirySec: Number(market.data.expiry),
    policyVersion: market.data.policyVersion,
    signature: "",
  };
  const [makerToken] = await findAssociatedTokenPda({ owner: ctx.client.payer.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  // The taker needs lamports for its own signature and collateral for the fill.
  await ctx.client.system.instructions.transferSol({ source: ctx.client.payer, destination: taker.address, amount: 20_000_000n }).sendTransaction();
  const takerToken = await fundUser(ctx, { faucet, mint, owner: taker.address, amount: 50_000_000n });

  // Trading stops at `lock_at`, which the Gap lane sets well before expiry; an expiry past it is refused (6108).
  const expireTs = Number(market.data.lockAt);
  const rest = await placeOrder(ctx, { ...window, mint }, ctx.client.payer, makerToken, {
    kind: KIND.buyYes, priceTicks, lots, orderType: ORDER_TYPE.normal, expireTs,
  });
  // A BUY_NO at `1000 - priceTicks + margin` crosses the resting BUY_YES; an IOC fills at the resting price.
  const cross = await placeOrder(ctx, { ...window, mint }, taker, takerToken, {
    kind: KIND.buyNo, priceTicks: 1_000 - priceTicks + 20, lots, orderType: ORDER_TYPE.ioc, expireTs,
  });
  const after = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  return { rest, cross, lastPrice: after.data.lastPrice, tradeCount: after.data.tradeCount };
}
