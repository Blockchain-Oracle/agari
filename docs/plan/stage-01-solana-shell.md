# S1 — Solana primitives, stub adapter, Privy wallet shell (no EVM left)

**Goal:** core types are Solana-shaped; every route renders against a stub adapter that returns honest `unavailable` Readings; Privy and Wallet Standard wallets connect; ed25519 message signing works; zero viem/wagmi/RainbowKit/Somnia imports. Plan: `00-plan.md` §7.2 S1, §2.2 (calendar, tickers), §5 (seams), §6 (conventions).

**Branch:** `stage/S1-solana-shell` (main worktree). `main` stays gate-green; S1 merges at its gate. Until 1d lands, the workspace typecheck is expected red on this branch: each 1a commit gates on `pnpm --filter @agari/core typecheck && pnpm invariants`.

**D-number range:** D-010…D-019 (S2 holds D-006…D-009 while both stages run).

## Steps

- [ ] 1a core (first; the other slices compile against it)
  - [x] 1a.1 `types/{primitives,ids}.ts`: base58 `Address`, `Signature`, `Hash32`; `MarketId` = Market PDA (D-010)
  - [ ] 1a.2 `market/tickers.ts`: `Ticker` registry (Pyth feed id, RedStone feed id, Surge symbol, Alpaca symbol, xStock mint, mark); `asset` → `Ticker`
  - [ ] 1a.3 `market/{session,lanes}.ts`: Pyth `schedule` parser, Alpaca calendar shape, session states, cadence alignment, `lock_at`, no-entry buffer, Regular/Gap/Token lanes
  - [ ] 1a.4 `auth/signed-message.ts`, `urls/explorer.ts`, `projection/settle.ts` (1e7 denominator), Somnia constants out of core
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
- **1a.4 still owns:** `private/protocol.ts` wire `signature` (still a 0x hex regex), the signed-message wording in `faucet`, `x/link`, `games/room-token`, `private/protocol`, and `urls/explorer.ts` / Somnia constants.
