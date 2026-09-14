# `@agari/markets` consumer surface (S1 1b)

Generated 2026-09-14 from every static and dynamic `@agari/markets[/subpath]` import in `web/src`, `services/ops/src` and `scripts` at `ef188d3` (before the stub). This list defines what the S1 stub keeps (D-015). **Kept** symbols keep their names; their types follow core D-010…D-012 (base58 ids, `TickerSymbol`, `lockAtSec`, lamports). **Removed** symbols were EVM-only and have no Solana meaning; the owning stage adds the Solana equivalent. Each removal lists the files that still import it (1d rewrites them). Masayume's Shannon spikes (`scripts/spike`, `services/ops/src/spike`) and season tools were deleted in 1b and are left out of those lists.

Verified by compiling one `import type { X } from "<subpath>"` per row against the stub: 186 resolve, 29 are removed.

## `@agari/markets` — 56 kept, 16 removed

**Kept** (importing files): `assertFunded` (1), `bootMarkets` (3), `chainReconciler` (2), `closeRuntime` (17), `collateralOrNull` (3), `configureMarkets` (7), `createLocalStorageJournal` (2), `createMemoryJournal` (16), `createSubmitterSession` (17), `diagnose` (1), `ensureMarkets` (32), `getClient` (7), `getCollateral` (5), `getLeverageMark` (1), `getLeverageReserveState` (1), `getMakerVaultState` (1), `getParlayReserveState` (1), `getRangeReserveState` (2), `getVaultSnapshot` (2), `laneNextStart` (1), `listLeveragePositionsOf` (1), `listParlaysOf` (1), `listRangesOf` (1), `listVaultTallies` (2), `listWalletFills` (1), `loadCollateral` (25), `mapPool` (1), `marketsProvider` (53), `nowMs` (3), `parseMarketsEnv` (37), `previewRangeBasis` (1), `quoteMoonshotOnchain` (1), `quoteParlayOnchain` (1), `quoteRangeOnchain` (1), `readRangeCapacity` (1), `readVenueBoard` (1), `recoverUnresolved` (2), `resolveVaultDeployment` (1), `resolveVenueId` (22), `sizeLeverageForStake` (1), `submitLeverageOpen` (1), `submitParlayOpen` (1), `submitRangeOpen` (1), `syncClock` (3), `tallyToLedger` (2), `toRoundMarket` (1), `FundingCheck` (3), `MarketsEnv` (3), `MarketsSubmitter` (1), `RecoveryResult` (2), `SponsorStatus` (2), `SubmitterSession` (15), `VenueBoard` (1), `unwrap` (11), `vaultRound` (1), `withReading` (4).

| Removed | Owner of the Solana equivalent | Still imported by |
|---|---|---|
| `FORWARD_DEADLINE_SEC` | S7 sponsor | `features/session/sponsor.server.ts` |
| `PINNED_TESTNET` | none (DreamDEX addresses; S2 addresses.devnet.json) | `app/dev/boot/page.tsx`, `features/demo/proofs.ts`, `features/pitch/slides-a.tsx`, `features/pitch/slides-b.tsx` |
| `SOMNIA_SHANNON` | 1c (Privy cluster config) | `app/dev/boot/page.tsx` |
| `SPONSORABLE_FUNCTIONS` | S7 sponsor | `app/api/sponsor/route.ts` |
| `SPONSOR_MAX_GAS` | S7 sponsor | `features/session/sponsor.server.ts` |
| `createSessionKeySession` | S7 tap trading / S12 game key | `features/games/duel/useGameSession.ts`, `features/session/useKeySession.ts` |
| `createSponsorTransport` | S7 sponsor | `features/session/useKeySession.ts` |
| `executeSponsored` | S7 sponsor | `app/api/sponsor/route.ts` |
| `generateSessionKey` | S7 tap trading / S12 game key | `features/games/duel/useGameKey.ts`, `features/session/SessionKeyProvider.tsx` |
| `keyGasBalance` | S7 / S12 (key fee balance) | `features/games/duel/DuelPicking.tsx`, `features/games/duel/useGameSession.ts`, `features/games/sponsor.server.ts`, `features/session/SessionKeyProvider.tsx` |
| `requiredGasWei` | S7 / S12 (FEE_RESERVE_LAMPORTS) | `features/games/duel/DuelPicking.tsx`, `features/games/duel/gas.test.ts`, `features/games/duel/gas.ts`, `features/markets/balance/BalanceSheetPanel.tsx`, `features/markets/faucet/useFaucet.ts`, `features/session/SessionManager.tsx` |
| `sessionGasTopUpWei` | S7 / S12 | `features/session/SessionKeyProvider.tsx`, `features/session/SessionManager.tsx`, `features/session/SessionModal.tsx` |
| `sessionKeyClient` | S7 | `features/session/useKeySession.ts` |
| `sponsorAddressOf` | S7 sponsor | `features/session/sponsor.server.ts` |
| `sponsorableFunctionOf` | S7 sponsor | `app/api/sponsor/route.ts` |
| `topUpSessionGas` | S7 / S12 | `features/games/duel/useArenaWrites.ts`, `features/session/SessionKeyProvider.tsx` |

## `@agari/markets/chain` — 2 kept, 1 removed

**Kept** (importing files): `EXPLORER_URL` (1), `RPC_HTTP_URLS` (1).

| Removed | Owner of the Solana equivalent | Still imported by |
|---|---|---|
| `SOMNIA_SHANNON` | 1c (Privy cluster config) | `features/markets/balance/BalanceSheetPanel.tsx`, `features/markets/wallet/NetworkBanner.tsx`, `lib/wallet-session.ts`, `providers/AppProviders.tsx`, `providers/persist.ts`, `providers/wagmi.ts` |

## `@agari/markets/env` — 2 kept, 0 removed

**Kept** (importing files): `parseMarketsEnv` (1), `MarketsEnv` (1).

## `@agari/markets/faucet` — 2 kept, 0 removed

**Kept** (importing files): `createFaucetChain` (1), `FaucetChain` (2).

## `@agari/markets/games` — 14 kept, 2 removed

**Kept** (importing files): `arenaHeadBlock` (1), `distributeSeasonPrizes` (1), `getArenaCredit` (1), `getArenaMatch` (7), `getArenaState` (7), `getSeasonPool` (3), `listArenaEvents` (1), `quoteArenaPick` (4), `readArenaAgent` (3), `resolveArenaDeployment` (10), `sendArenaIntent` (6), `submitArenaPick` (1), `ArenaMatchView` (1), `ArenaPickOutcome` (1).

| Removed | Owner of the Solana equivalent | Still imported by |
|---|---|---|
| `sponsorKeyTopUp` | S12 | `features/games/sponsor.server.ts` |
| `writeGameArena` | S12 | — (only deleted spikes) |

## `@agari/markets/identity` — 3 kept, 5 removed

**Kept** (importing files): `ORACLE_PRICE_SCALE` (7), `PRICE_BASIS` (3), `marketIdOf` (1).

| Removed | Owner of the Solana equivalent | Still imported by |
|---|---|---|
| `decodeOutcomeId` | none (ERC-6909 ids; balances are Ledger seats) | — (only deleted spikes) |
| `marketKey` | none (DreamDEX settlement key) | — (only deleted spikes) |
| `outcomeIdsOf` | none (ERC-6909 ids) | — (only deleted spikes) |
| `readModuleMarket` | none (DreamDEX module) | — (only deleted spikes) |
| `readSettlementRecord` | none (DreamDEX settlement) | — (only deleted spikes) |

## `@agari/markets/leverage` — 6 kept, 0 removed

**Kept** (importing files): `getLeverageMark` (1), `getLeverageReserveState` (1), `listLeverageOpenPositions` (1), `sizeLeverageForStake` (1), `submitLeverageOpen` (1), `LeverageOpenOutcome` (1).

## `@agari/markets/maker` — 5 kept, 0 removed

**Kept** (importing files): `getMakerUnsettledExpired` (1), `getMakerVaultState` (1), `listMakerOpenWindows` (1), `readPoolTop` (1), `PoolTop` (1).

## `@agari/markets/parlay` — 4 kept, 0 removed

**Kept** (importing files): `listParlaysOf` (1), `quoteParlayOnchain` (1), `submitParlayOpen` (1), `ParlayOpenOutcome` (1).

## `@agari/markets/perf` — 3 kept, 0 removed

**Kept** (importing files): `mark` (4), `milestones` (1), `subscribeMilestones` (1).

## `@agari/markets/private` — 11 kept, 5 removed

**Kept** (importing files): `ClaimRefusedError` (1), `cashOutPrivateBet` (2), `createDeskClient` (2), `deskHealth` (2), `getPrivateBudget` (1), `getPrivateDeskState` (1), `getPrivateSlot` (1), `openPrivateBet` (2), `publicReason` (1), `sizePrivateForStake` (3), `DeskClient` (1).

| Removed | Owner of the Solana equivalent | Still imported by |
|---|---|---|
| `canonicalSignature` | S10 (PD-4 ed25519 claims) | `app/api/private/open/route.ts` |
| `claimDomain` | S10 (PD-4) | `app/dev/private/fixtures.ts`, `features/private/verify.ts` |
| `deriveSlotKeys` | S10 (PD-4) | `app/dev/private/fixtures.ts` |
| `signPrivateClaim` | S10 (PD-4) | `app/dev/private/fixtures.ts` |
| `verifyPrivateClaim` | S10 (PD-4) | `features/private/verify.ts` |

## `@agari/markets/range` — 10 kept, 0 removed

**Kept** (importing files): `listRangesOf` (1), `quoteMoonshotOnchain` (1), `quoteRangeOnchain` (1), `readRangeCapacity` (1), `submitRangeOpen` (1), `MoonshotQuote` (2), `MoonshotWindow` (1), `RangeBand` (1), `RangeCapacity` (2), `RangeOpenOutcome` (1).

## `@agari/markets/react` — 51 kept, 0 removed

**Kept** (importing files): `MarketsProvider` (1), `SubmitterSessionProvider` (1), `invalidateAfterWrite` (15), `keys` (18), `MarketsBoot` (2), `useArenaCredit` (1), `useArenaMatch` (3), `useArenaQuote` (1), `useArenaState` (4), `useAssetPrice` (6), `useBalanceSheet` (14), `useBook` (3), `useBookParams` (1), `useBooks` (1), `useClaimables` (3), `useClockFact` (1), `useCollateralFact` (1), `useHoldings` (1), `useLanes` (10), `useLeverageMark` (1), `useLeverageReserve` (2), `useMakerHistory` (1), `useMakerShares` (2), `useMakerVault` (2), `useMakerWindows` (1), `useMarket` (6), `useMarketsBoot` (3), `useMarketsLite` (2), `useMyLeveragePositions` (1), `useNextWindow` (2), `useOnchain` (5), `useOpeningPrice` (10), `useParlayReserve` (1), `usePositions` (4), `usePriceHistory` (1), `usePrivateBudget` (3), `usePrivateDesk` (3), `useRangeReserve` (4), `useReadingQuery` (16), `useResolution` (2), `useSettlementFee` (1), `useSigner` (10), `useStakeQuote` (2), `useSubmitter` (15), `useTick` (4), `useUserSession` (2), `useVaultHoldings` (1), `useVaultSnapshot` (7), `useVenueFact` (1), `useWalletCollateral` (1), `useWalletHistory` (2).

## `@agari/markets/runtime` — 1 kept, 0 removed

**Kept** (importing files): `getClient` (9).

## `@agari/markets/strategies` — 9 kept, 0 removed

**Kept** (importing files): `getStrategy` (4), `listLiveSubscribers` (1), `listStrategies` (2), `listStrategySubscribers` (1), `listSubscriptionsOf` (2), `openingOnFeedScale` (1), `readAgentContext` (2), `resolveRegistryDeployment` (2), `submitStrategyTx` (1).

## `@agari/markets/vault` — 7 kept, 0 removed

**Kept** (importing files): `getVaultGrant` (2), `getVaultSnapshot` (1), `listVaultTallies` (1), `recoverVaultExecution` (2), `resolveVaultDeployment` (5), `RecoveredVaultExecution` (1), `VaultContracts` (5).
