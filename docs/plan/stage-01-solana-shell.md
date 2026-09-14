# S1 — Solana primitives, stub adapter, Privy wallet shell (no EVM left)

**Goal:** core types are Solana-shaped; every route renders against a stub adapter that returns honest `unavailable` Readings; Privy and Wallet Standard wallets connect; ed25519 message signing works; zero viem/wagmi/RainbowKit/Somnia imports. Plan: `00-plan.md` §7.2 S1, §2.2 (calendar, tickers), §5 (seams), §6 (conventions).

**Branch:** `stage/S1-solana-shell` (main worktree). `main` stays gate-green; S1 merges at its gate. Until 1d lands, the workspace typecheck is expected red on this branch: each 1a commit gates on `pnpm --filter @agari/core typecheck && pnpm invariants`.

**D-number range:** D-010…D-019 (S2 holds D-006…D-009 while both stages run).

## Steps

- [x] 1a core (first; the other slices compile against it)
  - [x] 1a.1 `types/{primitives,ids}.ts`: base58 `Address`, `Signature`, `Hash32`; `MarketId` = Market PDA (D-010)
  - [x] 1a.2 `market/tickers.ts`: `Ticker` registry (Pyth feed id, RedStone feed id, Surge symbol, Alpaca symbol, xStock mint, mark); `asset` → `Ticker` (D-011)
  - [x] 1a.3 `market/{session,lanes}.ts`: Pyth `schedule` parser, Alpaca calendar shape, session states, cadence alignment, `lock_at`, no-entry buffer, Regular/Gap/Token lanes (D-011; session slice `8512da7`)
  - [x] 1a.4 `auth/signed-message.ts` (ed25519, verifier injected), `urls/explorer.ts` (Solana Explorer + cluster), Somnia constants out of core (`constants/{chain,fees,faucet}.ts`, SOL faucet policy, copy)
  - [x] 1a.5 `claims/payout.ts` + `projection/settle.ts`: mirror the engine's redeem (1e7 payout vector, zero fee, floor) from the frozen S2 spec
- [ ] 1b markets stub + invariants (`no-evm`, `kit-import-boundary`, `idl-no-destination`, `program-id-drift`; DreamDEX rules removed)
- [ ] 1c providers, Privy, header (`wagmi.ts` and `rainbowkit-theme.ts` deleted)
- [ ] 1d port the 32 EVM-importing web files onto the stub and identity seams; `*.server.ts` verifiers on ed25519; write hooks return `CapabilityPending`
- [ ] `/dev/wallet` fixture: Privy sign-in → signMessage → server verify
- [ ] Browser pass: 37 product routes at 390 and 1440, both themes

## Gate

`pnpm typecheck && pnpm invariants && pnpm build` · no EVM imports · Privy embedded wallet shows a base58 address · Phantom connects · signed-message verify works.

**Rows:** Shell L-01, 02, 03, 05, 06, 07, 21; Partial L-10, L-24, L-72.

## Findings

- **Blast radius measured at start (2026-09-14):** 38 core files and 158 repo files use `Hex`/`Address`/`Bytes32`; 648 files import `@agari/core`; EVM imports are in 70 `packages/markets` files, 32 `web/src` files, 8 `services/ops` files and 3 `scripts/spike` files.

- **1a.1:** only 40 type errors surfaced in core; the real hazards compiled silently. `txHash: Hex` still type-checked, and 30 `toLowerCase()` calls on addresses would have merged or corrupted base58 keys. Both were swept by hand (D-010). Core tests: 757 pass.

## Handoff

- **1b–1d must:** never lowercase, uppercase or text-sort an `Address`/`MarketId`/`Signature` (Masayume web code does this for EVM ids); build test ids with `packages/core/src/testing/ids.ts`; treat `txHash` as a base58 `Signature`.
- **1d must:** pass `{ lockAtSec, intervalSec }` to the entry helpers (`markets/submitter/steps/expiry.ts`, `ops/x-relay/execute.ts`, `web/features/x/XInstructionBuilder.tsx`); build `EventMarket` fixtures with `packages/core/src/testing/market.ts`; drop every reader of the removed DreamDEX fields (D-011).
- **S2 must agree with core:** ticker `seriesId` values, Gap cadence seed 604,800, basis order `regular 0 · gap 1 · token 2` (confirm in the frozen spec).
- **1a.5 done:** `estPayoutBase(amountRaw, kind)` = `⌊amountRaw × {10⁷ | 5·10⁶} / 10⁷⌋`, exact on every valid grid because registration forces `1000·cu == lot_base`. `feeBps` fields remain as display data, always 0 from the adapter; the UI stages decide whether a fee line survives.
- **1b must:** drop `GasLane`/`GAS_CEILING` (removed) for simulate → `units × COMPUTE_MARGIN_BPS`, capped at `COMPUTE_UNIT_LIMIT_MAX`; `txUrl(signature, cluster)` replaces the Somnia explorer; `urls/oracle.ts` is gone (proof links come from prints, S5).
- **1d must:** verify signed texts with `verifySignedMessage` + a server ed25519 (`faucet`, `x/link`, `room-token`, `private/protocol` now read "Agari" and name the Solana cluster); message signatures travel as base58; the faucet is SOL in lamports (`SOL_FAUCET_POLICY`, `lastValidBlockHeight` instead of an EVM nonce).
- **Numeric cluster ids (D-012):** fields still named `chainId` hold `CLUSTER_ID` (devnet 103).
- **Left for S10 (private):** `PRIVATE_CLAIM_TYPES`/`PRIVATE_CLAIM_DOMAIN_NAME` are EIP-712 and still say Masayume; PD-4 needs an ed25519 claim over a canonical encoding. **S15:** `copy/verdict.ts` "Masayume — it came true", provenance comments in `games/{deck,picking}.ts`.
