/**
 * `@agari/markets/deploy`: server-only operator tooling. Scripts read keypair files and JSON, then call these.
 * Not re-exported from the package root, so no web bundle pulls it.
 */
import type { Address, KeyPairSigner } from "@solana/kit";
import type { DeployClient } from "./client";
import { ensureConfig, ensureMint, ensureTreasury } from "./ensure-config";
import { ensureBooks, ensureSeries } from "./ensure-series";
import type { PriceSources } from "./policies";
import type { StepContext, StepLog, VenueRecord } from "./send";
export type { StepContext } from "./send";
import { s2Authorities, s2Series, type AuthorityKeys } from "./venue-spec";

export { createDeployClient, keypairSigner, type DeployClient, type DeployClientConfig } from "./client";
export { describeSendError, DriftError, type SendContext, type SeriesRecord, type StepLog, type VenueRecord } from "./send";
export { ADMIT_UNTIL_LOCK, policyVersions, type PriceSources } from "./policies";
// S6 lanes (session-lanes.md §6): 6a the Gap Series, 6b the token Series.
export * from "./series-gap";
export * from "./series-token";
export { seriesAddress } from "./ensure-series";
export { BOOK_CAPACITY, BOOKS_PER_SERIES, DRIVE_ATTESTED_FEED, driveTestSeries, LAUNCH_GRID, s2Series, type SeriesSpec } from "./venue-spec";
export { ensureBooks, ensureSeries } from "./ensure-series";
export { chainNowSec, readSeats, windowAddresses, type Seat } from "./cycle/accounts";
export { DRIVE_TEST_TICKER } from "./venue-spec";
// S18 (D-100): the PreStocks Pre-IPO lane.
export { BASIS, PRESTOCKS_TICKER_BASE, preStocksFeedId, preStocksSeries } from "./venue-spec";
export { profileOnSurfpool, type TransactionProfile } from "./cycle/profile";
export { ANY_SEAT, fundUser, KIND, newSigner, openWindow, ORDER_TYPE, placeOrder, placeOrderInstruction, seatHintFor, type OpenedWindow, type OrderInput } from "./cycle/window";
export { recordAttestedPrint, recordPythPrint, recordRedstonePrint, recycleBooks, redeem, settleWindow, sweepExpired, voidExpired, WHICH } from "./cycle/resolve";
export { attestedMessage, ed25519Instruction } from "../prices/attested";
export { initVault, programDataAddress, registerVaultSeat, VAULT_AUTHORITY_INDEX, vaultAddresses } from "./vault";
export { depositAndAllowPrivate, rawChargeAsPayer, readPrivateBudget, readPrivateDesk, revokePrivate, withdrawPrivate } from "./private-drive";
export { DEVNET_PRIVATE_PARAMS, initPrivateDesk, PRIVATE_AUTHORITY_INDEX, privateAddresses, registerPrivateSeat } from "./private";
export { DEVNET_PARLAY_PARAMS, initParlayReserve, parlayAddresses } from "./parlay";
export { initStrategyRegistry, strategyAddresses } from "./strategy";
export { openParlayTicket, probeParlayLeg, readParlayReserve, settleParlayTicket, supplyParlay, ticketAddressOf, voidStaleParlay, type DriveLeg } from "./parlay-drive";
export { DEVNET_RANGE_PARAMS, initRangeReserve, rangeAddresses } from "./range";
export { closeOwnedWindow, DRIVE_OWNED_TICKER, driveOwnedSeries, openOwnedWindow, ownedWindowOf, quoteOwnedWindow, type OwnedQuote, type OwnedWindowKeys } from "./drive-window";
export { claimLeverage, exitLeverage, openLeverage, probeLeverage, readLeveragePosition, readLeverageReserve, supplyLeverage, withdrawLeverage, type BoostSpec } from "./leverage-drive";
export { DEVNET_LEVERAGE_PARAMS, initLeverageReserve, leverageAddresses, LEVERAGE_AUTHORITY_INDEX, registerLeverageSeat } from "./leverage";
export { DEVNET_MAKER_PARAMS, initMakerVault, makerAddresses, MAKER_AUTHORITY_INDEX, registerMakerSeat } from "./maker";
export { mergeMaker, pullMaker, quoteMaker, settleMaker, supplyMaker, withdrawMaker, windowBookOf, type QuoteInput } from "./maker-drive";
export { expiryBookAddressOf, liveWindowFor, markWindow, probeWindow, openRangeRound, roundAddressOf, settleRangeRound, supplyRange, type OpenRangeInput } from "./range-drive";
export { packagesAt, parseGatewayJson, redstoneHistoricalUrl, redstoneMedianE8, redstonePayload, decimalToE8, type RedStonePackage } from "../prices/redstone";

export type InitEventsInput = {
  /** Fee payer and config admin: must be the program's upgrade authority (`admin_init_config`). */
  client: DeployClient;
  clusterTag: number;
  programData: Address;
  /** The tUSDC mint keypair; it signs only when the mint is created. */
  mint: KeyPairSigner;
  mintAuthority: Address;
  authorities: AuthorityKeys;
  sources: PriceSources;
  /** Mutated in place and passed to `save` after every confirmed step. */
  record: VenueRecord;
  save: (record: VenueRecord) => void;
  log: (entry: StepLog) => void;
};

/** S2 `init-events`: mint → treasury → config + authorities → TSLA/NVDA 5m Series + versions → 2 Books each. */
export async function initEvents(input: InitEventsInput): Promise<VenueRecord> {
  const ctx: StepContext = {
    client: input.client,
    record: input.record,
    save: (next) => {
      Object.assign(input.record, next);
      input.save(input.record);
    },
    log: input.log,
  };
  const mint = await ensureMint(ctx, input.mint, input.mintAuthority);
  const treasury = await ensureTreasury(ctx, mint);
  await ensureConfig(ctx, {
    clusterTag: input.clusterTag,
    programData: input.programData,
    mint,
    treasury,
    authorities: s2Authorities(input.authorities, input.sources),
  });
  for (const spec of s2Series(input.sources)) {
    const series = await ensureSeries(ctx, spec);
    await ensureBooks(ctx, spec, series);
  }
  return input.record;
}
export { planAuthorities, setAuthorities, type AuthoritiesChange, type AuthoritiesPlan } from "./authorities";
