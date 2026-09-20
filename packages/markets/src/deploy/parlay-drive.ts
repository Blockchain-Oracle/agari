/**
 * The S10a drive: supply the reserve, open a ticket over live Windows, settle its legs in order and claim.
 *
 * Scripts may not import the chain SDKs (plan §6), so the whole drive lives here and `scripts/drive/parlay-ticket.ts`
 * passes plain values. Every price here comes from the same rested-book walk the program runs, so what the drive
 * prints before it sends is what the chain should charge.
 */
import {
  AGARI_PARLAY_PROGRAM_ADDRESS, fetchMaybeParlayReserve, fetchMaybeParlayTicket, findReservePda, findVaultPda,
  getOwnerOpenParlayInstructionAsync, getProviderSupplyInstructionAsync, getPublicClaimParlayInstructionAsync,
  getPublicResolveLegInstructionAsync, getPublicVoidStaleInstructionAsync,
} from "@agari/clients/agari-parlay";
import { outcomeLevels, type NodeFilter } from "@agari/core/market";
import { nextParlayLegIdx, PARLAY_STAKE_HEADROOM_BPS, parlayLegStatusOf, parlayStatusOf, quoteParlay, type QuoteLeg } from "@agari/core/parlay";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AccountRole, getBase64Encoder, getProgramDerivedAddress, getU64Encoder, type Address, type Instruction } from "@solana/kit";
import { paramsOf } from "../parlay/reads";
import { decodeBook } from "../runtime/decode";
import { send, type SendContext } from "./send";

const BPS = 10_000n;
const PRICE_LEVELS = 32;
const PAIR_TICKS = 1_000n;

export async function ticketAddressOf(parlayId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: AGARI_PARLAY_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("ticket"), getU64Encoder().encode(parlayId)],
  });
  return pda;
}

async function reserveContext(ctx: SendContext) {
  const [reserve] = await findReservePda();
  const [vault] = await findVaultPda();
  const account = await fetchMaybeParlayReserve(ctx.client.rpc, reserve);
  if (!account.exists) throw new Error(`reserve ${reserve} is not initialised: run scripts/deploy/init-parlay.ts`);
  const [payerToken] = await findAssociatedTokenPda({ owner: ctx.client.payer.address, mint: account.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return { reserve, vault, account, mint: account.data.collateralMint, payerToken };
}

export async function supplyParlay(ctx: SendContext, amountBase: bigint) {
  const { vault, mint, payerToken, reserve } = await reserveContext(ctx);
  const ix = await getProviderSupplyInstructionAsync({
    provider: ctx.client.payer, providerToken: payerToken, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amountBase,
  });
  const signature = await send(ctx, "supply", [ix], `${amountBase} base units into ${vault}`);
  const after = await fetchMaybeParlayReserve(ctx.client.rpc, reserve);
  return { signature, shares: after.exists ? after.data.supplyShares : 0n };
}

export interface DriveLeg {
  marketId: Address;
  isUp: boolean;
}

/** One leg as the reserve sees it right now: the Window's clock, and the rested levels of the side being bought. */
export async function probeParlayLeg(ctx: SendContext, leg: DriveLeg, minRestSlots: number) {
  const market = await ctx.client.agariEvents.accounts.market.fetch(leg.marketId);
  const series = await ctx.client.agariEvents.accounts.series.fetch(market.data.series);
  const info = await ctx.client.rpc.getAccountInfo(market.data.book, { encoding: "base64", commitment: "confirmed" }).send();
  if (!info.value) throw new Error(`Book ${market.data.book} not found`);
  const book = decodeBook(market.data.book, getBase64Encoder().encode(info.value.data[0]), info.context.slot);
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const seriesRest = BigInt(series.data.minRestSlots);
  const floor = BigInt(minRestSlots);
  const filter: NodeFilter = { now: nowSec, slot: book.slot, restedOnly: true, minRestSlots: seriesRest > floor ? seriesRest : floor };
  const walk = (rested: boolean) => outcomeLevels(leg.isUp ? "BUY_YES" : "BUY_NO", book.bids, book.asks, PRICE_LEVELS, { ...filter, restedOnly: rested });
  const toViews = (levels: ReturnType<typeof walk>) => levels.map(([ticks, lots]) => ({
    priceRaw: BigInt(ticks) * series.data.tickBase, priceBps: ticks * 10, quantityRaw: lots * series.data.lotBase,
  }));
  const status = market.data.state !== 0 ? "terminal" : nowSec < market.data.tradingStart ? "listed" : nowSec < market.data.lockAt ? "trading" : "locked";
  return {
    ...leg,
    book: market.data.book,
    series: market.data.series,
    status,
    secondsToLock: Number(market.data.lockAt - nowSec),
    secondsToExpiry: Number(market.data.expiry - nowSec),
    expirySec: Number(market.data.expiry),
    one: series.data.tickBase * PAIR_TICKS,
    rested: toViews(walk(true)),
    /** What a taker could hit. When this is deeper than `rested`, somebody quoted inside the last `min_rest_slots`. */
    resting: toViews(walk(false)),
  };
}

export async function openParlayTicket(ctx: SendContext, legs: readonly DriveLeg[], maxPayoutBase: bigint) {
  const { account, mint, payerToken } = await reserveContext(ctx);
  const params = paramsOf(account.data.params);
  const probes = await Promise.all(legs.map((leg) => probeParlayLeg(ctx, leg, params.minRestSlots)));
  const one = probes[0]?.one ?? 1_000_000n;
  const quoteLegs: QuoteLeg[] = probes.map((p) => ({ expirySec: p.expirySec, asks: p.rested }));
  const quoted = quoteParlay({ legs: quoteLegs, mode: { kind: "fixPayout", maxPayoutBase }, params, one, decimals: 6, nowMs: Date.now() });
  if (!quoted.ok) throw new Error(`the reserve would refuse this ticket: ${JSON.stringify(quoted.refusal, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);

  const parlayId = account.data.nextParlayId;
  const ticket = await ticketAddressOf(parlayId);
  const open = await getOwnerOpenParlayInstructionAsync({
    owner: ctx.client.payer, ticket, ownerToken: payerToken, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    legsUp: legs.map((leg) => leg.isUp),
    maxPayoutBase,
    maxStakeBase: (quoted.quote.stakeBase * (BPS + BigInt(PARLAY_STAKE_HEADROOM_BPS))) / BPS,
  });
  const remaining = probes.flatMap((p) => [p.marketId, p.book, p.series]).map((address) => ({ address, role: AccountRole.READONLY }));
  const instruction: Instruction = { ...open, accounts: [...(open.accounts ?? []), ...remaining] };
  const signature = await send(ctx, "open parlay", [instruction], `ticket ${parlayId}, ${legs.length} legs, payout ${maxPayoutBase}`);
  const booked = await fetchMaybeParlayTicket(ctx.client.rpc, ticket);
  return { signature, parlayId, ticket, quote: quoted.quote, booked: booked.exists ? booked.data : null };
}

/**
 * Decide every leg the venue has an answer for, in the order the reserve takes them, then claim a win or a void.
 * Stops at the first leg whose Window has not settled: that is not a failure, it is a ticket still in play.
 */
export async function settleParlayTicket(ctx: SendContext, parlayId: bigint) {
  const { mint } = await reserveContext(ctx);
  const address = await ticketAddressOf(parlayId);
  const signatures: { step: string; signature: string }[] = [];
  for (;;) {
    const ticket = await fetchMaybeParlayTicket(ctx.client.rpc, address);
    if (!ticket.exists) throw new Error(`ticket ${parlayId} not found at ${address}`);
    const status = parlayStatusOf(Number(ticket.data.status));
    const legs = ticket.data.legs.map((leg) => ({ status: parlayLegStatusOf(Number(leg.status)), expirySec: Number(leg.expirySec), market: leg.market }));

    if (status === "won" || status === "void") {
      const [ownerToken] = await findAssociatedTokenPda({ owner: ticket.data.owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      const claim = await getPublicClaimParlayInstructionAsync({ cranker: ctx.client.payer, ticket: address, ownerToken, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      signatures.push({ step: "claim", signature: await send(ctx, "claim parlay", [claim], `ticket ${parlayId} (${status})`) });
      continue;
    }
    if (status !== "live") return { status, legs, signatures, waitingOn: null };

    const next = nextParlayLegIdx(legs);
    const leg = next === null ? undefined : legs[next];
    if (next === null || !leg) return { status, legs, signatures, waitingOn: null };
    const market = await ctx.client.agariEvents.accounts.market.fetch(leg.market);
    if (market.data.state === 0) return { status, legs, signatures, waitingOn: { legIdx: next, market: leg.market, expirySec: leg.expirySec } };
    const resolve = await getPublicResolveLegInstructionAsync({ cranker: ctx.client.payer, ticket: address, market: leg.market, legIdx: next });
    signatures.push({ step: `resolve leg ${next}`, signature: await send(ctx, "resolve leg", [resolve], `ticket ${parlayId} leg ${next} on ${leg.market}`) });
  }
}

/** The backstop: void a ticket whose next leg the venue cannot answer, an hour past its last boundary. */
export async function voidStaleParlay(ctx: SendContext, parlayId: bigint) {
  const address = await ticketAddressOf(parlayId);
  const ticket = await fetchMaybeParlayTicket(ctx.client.rpc, address);
  if (!ticket.exists) throw new Error(`ticket ${parlayId} not found at ${address}`);
  const legs = ticket.data.legs.map((leg) => ({ status: parlayLegStatusOf(Number(leg.status)), expirySec: Number(leg.expirySec), market: leg.market }));
  const next = nextParlayLegIdx(legs);
  const leg = next === null ? undefined : legs[next];
  if (!leg) throw new Error(`ticket ${parlayId} has no leg waiting`);
  const ix = await getPublicVoidStaleInstructionAsync({ cranker: ctx.client.payer, ticket: address, market: leg.market });
  return send(ctx, "void stale", [ix], `ticket ${parlayId}, waiting on leg ${next}`);
}

export async function readParlayReserve(ctx: SendContext) {
  const { account, vault, reserve } = await reserveContext(ctx);
  const balance = await ctx.client.rpc.getTokenAccountBalance(vault).send();
  return { reserve, vault, vaultBase: BigInt(balance.value.amount), data: account.data };
}
