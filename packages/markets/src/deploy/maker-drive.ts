/**
 * The S8 drive: supply the maker vault, rest one two-sided quote on a live Window, then merge and settle.
 *
 * Scripts may not import the chain SDKs (plan §6), so the chain work lives here and `scripts/drive/maker-vault.ts`
 * passes plain values. Every step re-derives its PDAs rather than trusting a caller's.
 */
import { findConfigPda, AGARI_EVENTS_PROGRAM_ADDRESS } from "@agari/clients/agari-events";
import {
  fetchMaybeMakerVault, fetchMaybeWindowBook, findCustodyPda, findSeatPda, findVaultPda,
  getMakerPullInstructionAsync, getMakerQuoteInstructionAsync, getProviderSupplyInstructionAsync,
  getPublicMergeInstructionAsync, getPublicSettleInstructionAsync, AGARI_MAKER_PROGRAM_ADDRESS,
} from "@agari/clients/agari-maker";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getAddressEncoder, getProgramDerivedAddress, type Address } from "@solana/kit";
import { windowAddresses } from "./cycle/accounts";
import { send, type SendContext } from "./send";

async function eventAuthority(): Promise<Address> {
  const [authority] = await getProgramDerivedAddress({
    programAddress: AGARI_EVENTS_PROGRAM_ADDRESS,
    seeds: ["__event_authority"],
  });
  return authority;
}

export async function windowBookOf(market: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: AGARI_MAKER_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("window"), getAddressEncoder().encode(market)],
  });
  return pda;
}

async function vaultContext(ctx: SendContext) {
  const [vault] = await findVaultPda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  const account = await fetchMaybeMakerVault(ctx.client.rpc, vault);
  if (!account.exists) throw new Error(`maker vault ${vault} is not initialised — run scripts/deploy/init-maker.ts`);
  const [payerToken] = await findAssociatedTokenPda({
    owner: ctx.client.payer.address,
    mint: account.data.collateralMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return { vault, custody, seat, account, mint: account.data.collateralMint, payerToken };
}

export async function supplyMaker(ctx: SendContext, amountBase: bigint) {
  const { vault, custody, seat, mint, payerToken } = await vaultContext(ctx);
  const ix = await getProviderSupplyInstructionAsync({
    provider: ctx.client.payer, custody, seat, providerToken: payerToken,
    collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amountBase,
  });
  const signature = await send(ctx, "supply", [ix], `${amountBase} base units into ${custody}`);
  const after = await fetchMaybeMakerVault(ctx.client.rpc, vault);
  return { signature, shares: after.exists ? after.data.supplyShares : 0n };
}

/** The engine accounts every maker CPI needs for one Window, derived from the Market itself. */
async function windowAccounts(ctx: SendContext, marketId: Address) {
  const market = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  const addrs = await windowAddresses(market.data.series, market.data.index);
  const [eventsConfig] = await findConfigPda();
  return {
    market: marketId,
    series: market.data.series,
    venueBook: market.data.book,
    ledger: addrs.ledger,
    mvault: addrs.mvault,
    eventsConfig,
    eventsEventAuthority: await eventAuthority(),
    lockAt: market.data.lockAt,
    lastPrice: market.data.lastPrice,
  };
}

export interface QuoteInput {
  marketId: Address;
  bidTicks: number;
  askTicks: number;
  lots: bigint;
}

export async function quoteMaker(ctx: SendContext, input: QuoteInput) {
  const { vault, custody, seat, mint } = await vaultContext(ctx);
  const w = await windowAccounts(ctx, input.marketId);
  const bookRecord = await windowBookOf(input.marketId);
  const ix = await getMakerQuoteInstructionAsync({
    maker: ctx.client.payer,
    bookRecord,
    custody,
    seat,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    eventsConfig: w.eventsConfig,
    series: w.series,
    market: w.market,
    venueBook: w.venueBook,
    ledger: w.ledger,
    mvault: w.mvault,
    collateralMint: mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    eventsEventAuthority: w.eventsEventAuthority,
    bidTicks: input.bidTicks,
    askTicks: input.askTicks,
    lots: input.lots,
    // Trading stops at lock_at; an expiry past it is refused with 6108.
    expireTs: w.lockAt,
  });
  const signature = await send(ctx, "quote", [ix], `${input.bidTicks}/${input.askTicks} x ${input.lots} on ${input.marketId}`);
  const [after, record] = await Promise.all([
    fetchMaybeMakerVault(ctx.client.rpc, vault),
    fetchMaybeWindowBook(ctx.client.rpc, bookRecord),
  ]);
  return {
    signature,
    deployedBase: after.exists ? after.data.deployedBase : 0n,
    book: record.exists ? record.data : null,
  };
}

export async function pullMaker(ctx: SendContext, marketId: Address) {
  const { custody, seat, mint } = await vaultContext(ctx);
  const w = await windowAccounts(ctx, marketId);
  const ix = await getMakerPullInstructionAsync({
    caller: ctx.client.payer,
    bookRecord: await windowBookOf(marketId),
    custody, seat,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    eventsConfig: w.eventsConfig,
    series: w.series, market: w.market, venueBook: w.venueBook, ledger: w.ledger, mvault: w.mvault,
    collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, eventsEventAuthority: w.eventsEventAuthority,
  });
  return send(ctx, "pull", [ix], `resting orders on ${marketId}`);
}

export async function mergeMaker(ctx: SendContext, marketId: Address, lots: bigint) {
  const { custody, seat, mint } = await vaultContext(ctx);
  const w = await windowAccounts(ctx, marketId);
  const ix = await getPublicMergeInstructionAsync({
    cranker: ctx.client.payer,
    bookRecord: await windowBookOf(marketId),
    custody, seat,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    eventsConfig: w.eventsConfig,
    series: w.series, market: w.market, ledger: w.ledger, mvault: w.mvault,
    collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, eventsEventAuthority: w.eventsEventAuthority,
    lots,
  });
  return send(ctx, "merge", [ix], `${lots} complete sets on ${marketId}`);
}

export async function settleMaker(ctx: SendContext, marketId: Address) {
  const { vault, custody, seat, mint } = await vaultContext(ctx);
  const w = await windowAccounts(ctx, marketId);
  const ix = await getPublicSettleInstructionAsync({
    cranker: ctx.client.payer,
    bookRecord: await windowBookOf(marketId),
    custody, seat,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    eventsConfig: w.eventsConfig,
    series: w.series, market: w.market, ledger: w.ledger, mvault: w.mvault,
    collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, eventsEventAuthority: w.eventsEventAuthority,
  });
  const signature = await send(ctx, "settle", [ix], `Window ${marketId}`);
  const [after, record] = await Promise.all([
    fetchMaybeMakerVault(ctx.client.rpc, vault),
    fetchMaybeWindowBook(ctx.client.rpc, await windowBookOf(marketId)),
  ]);
  void custody;
  return { signature, deployedBase: after.exists ? after.data.deployedBase : 0n, book: record.exists ? record.data : null };
}
