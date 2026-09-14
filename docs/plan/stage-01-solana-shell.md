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
- [x] 1b markets stub + invariants (`no-evm`, `kit-import-boundary`, `idl-no-destination`, `program-id-drift`; DreamDEX rules removed) (D-015, D-016)
- [x] 1c providers, Privy, header (`wagmi.ts` and `rainbowkit-theme.ts` deleted) (D-017)
- [ ] 1d port the 32 EVM-importing web files onto the stub and identity seams; `*.server.ts` verifiers on ed25519; write hooks return `CapabilityPending`
- [ ] `/dev/wallet` fixture: Privy sign-in → signMessage → server verify
- [ ] Browser pass: 37 product routes at 390 and 1440, both themes

## Gate

`pnpm typecheck && pnpm invariants && pnpm build` · no EVM imports · Privy embedded wallet shows a base58 address · Phantom connects · signed-message verify works.

**Rows:** Shell L-01, 02, 03, 05, 06, 07, 21; Partial L-10, L-24, L-72.

## Findings

- **Blast radius measured at start (2026-09-14):** 38 core files and 158 repo files use `Hex`/`Address`/`Bytes32`; 648 files import `@agari/core`; EVM imports are in 70 `packages/markets` files, 32 `web/src` files, 8 `services/ops` files and 3 `scripts/spike` files.

- **1a.1:** only 40 type errors surfaced in core; the real hazards compiled silently. `txHash: Hex` still type-checked, and 30 `toLowerCase()` calls on addresses would have merged or corrupted base58 keys. Both were swept by hand (D-010). Core tests: 757 pass.

- **1c:**
  - **Lazy island.** Privy, `@solana/kit` and the `@solana-program/*` peers are value-imported only by `providers/privy.tsx`, reached through `next/dynamic`; everything else reads a Privy-free context. The bundle effect can't be measured until `pnpm build` is green (1d); check it there.
  - **Hooks match the seam.** Privy's hook types satisfy `PrivySigners` directly, with no cast.
  - **Out-of-scope edit.** The shared `features/markets/wallet/ConnectButton.tsx` was ported with the header, since it is the plan's "ConnectButton on Privy" deliverable and about 20 features render it. The dead `NetworkBanner` was deleted.
  - **1b seam items** (`WalletSession` export, `wallet` prop) landed with the 1b merge.
  - **Left for 1d:**
    - wagmi `useSignMessage` in `features/{markets/faucet/useFaucet,private/usePrivateOpen,room/useRoom,takes/useTakes,x/useXStatus}.ts` → `signText(useOwnerWallet(), text)`.
    - `useOwnerWalletClient` in 7 feature write hooks and `SessionKeyProvider` → `useOwnerWallet`.
    - 20 viem importers in `features/**`/`app/**`.
    - wagmi and viem stay in `web/package.json` until then.
- **1b surface:** 215 consumer symbols across 17 subpaths (`docs/plan/specs/markets-surface.md`); 186 kept (names unchanged, types per D-010…D-012) and 29 EVM-only removed with owner stages. `packages/markets` went from ≈ 10.7k to ≈ 3.8k lines (−9,974 net), with no `viem`, no DreamDEX SDK and no `@solana/kit` yet.
- **1b gates:** `@agari/core`, `@agari/markets`, `@agari/db`, `@agari/brain`, `services/ops` typecheck green; invariants 10/10 green (`no-evm` allowlist 35 = the plan's 32 web files + 3 web deps); 982 tests pass (core + markets + ops). **`web` is red by design: 313 type errors in 145 files** until 1c/1d.
- **1b hazards found outside `packages/core`:** 20 address `toLowerCase()` calls in ops actors (removed) and the intent journal's `listUnresolved` (fixed). `packages/db` still lowercases addresses and market ids on write (`strategy-attempts.ts` and others): out of 1b's scope, but base58-corrupting.
- **1d-D1 (games, room, takes, `/dev`):**
  - **Errors:** 91 → 12 in the lane's folders. The last 12 belong to others:
    - 10 are fixtures now passing a base58 `Signature` into components D2/D3 still type as `Hex`: `features/markets/claims` `ClaimItem.txHash`, `features/share` `CallCard`/`TradeCard`, and the parlay/range ticket props.
    - 2 are `features/games/keccak.ts` waiting on the `@noble/hashes` web dependency. With it added locally the file typechecks, and 14 tests pass across games, room, takes and auth.
  - **Game key:**
    - `useGameKey` makes a WebCrypto Ed25519 keypair (`duel/game-keypair.ts`).
    - IndexedDB `agari.gameKey.<owner>` stores `{ address, secretKey: base58(seed ‖ pubkey, 64 B), createdAtMs }`. That is the Solana CLI layout the markets session takes as `{ secretKey }`; a Masayume EVM record doesn't parse and is replaced.
    - It signs room texts as base58 ed25519, verified server-side by `verifyWalletMessage`. A test round-trips it.
  - **Fees:**
    - `duel/gas.ts` is lamports: `FEE_RESERVE_LAMPORTS` + `LAMPORTS_PER_SIGNATURE` × cards × 2.
    - The key balance poll is gone; the key-balance read is S4/S12's.
    - The sponsor route runs every gate, then refuses the SOL transfer honestly ("lands with the arena program").
    - `fundKey` refuses with `ARENA_NOT_DEPLOYED`.
    - Route wire names (`amountWei`, `capWei`, …) are kept and now carry lamports (D-010).
  - **Signed texts:**
    - Room join and take post read "Agari", name the wallet exactly, carry `Network: Solana devnet`, and validate `addressSchema` + `messageSignatureSchema` (+ `marketIdSchema` for takes).
    - The duel room token verifies the key's ed25519 signature.
  - **Base58 hazards removed:** 40 address `toLowerCase()` comparisons across duel/lucky/arcade surfaces, room token and session storage keys, and the Lucky placement's txHash. Hex values (match ids, seeds, commitments) still fold case. The room session prefix `masayume:room:` became `agari:room:`.
  - **Lucky golden vector unchanged:** the web HMAC test's wallet is the old left-padded word as a 32-byte key (D-010).
  - **`/dev` fixtures:**
    - `app/dev/fixture-ids.ts` maps each old hex literal to base58 of the same bytes; `app/dev/fixture-window.ts` is one complete `EventMarket`.
    - BTC/ETH → TSLA/NVDA; cent prices → 8-dp prints; explorer links use `txUrl`; the boot page shows the Solana config and the engine's deploy state.
    - The private desk tickets carry placeholder signatures until S10's ed25519 claim (PD-4), never a faked "Verified".
## Handoff

- **1d-D1 needs from the parent:**
  - `pnpm --filter web add @noble/hashes@1.8.0` (same version as ops) for `features/games/keccak.ts`.
  - D2/D3 retype `txHash` props to `Signature` (claims, share cards, parlay/range tickets).
  - D3's `app/api/games/*` and `app/api/{room,takes}` routes still import `bytes32Schema`/`hexSchema`: `api/games/sponsor` → `hash32Schema` for `matchId`; `api/games/lucky/placed` → `signatureSchema` for `txHash`.
- **1d-D1 depends on D2's `features/session/sponsor.server.ts` exports:** `gate`, `marketsEnvFromProcess`, `sponsorConfig` (`config.sponsor`, `maxPerDevicePerHour`, `maxPerAddressPerHour`). If D2 renames them, `features/games/sponsor.server.ts` follows.
- **S12 (games):** size a fresh key's rent-exempt minimum and priority fees into `deckFeeLamports`, read key/sponsor SOL balances, restore the dry-key poll, and send the sponsor's top-up. `ArenaAgentGrant.gasWei` carries lamports until then.

- **1b–1d must:** never lowercase, uppercase or text-sort an `Address`/`MarketId`/`Signature` (Masayume web code does this for EVM ids); build test ids with `packages/core/src/testing/ids.ts`; treat `txHash` as a base58 `Signature`.
- **1d must:** pass `{ lockAtSec, intervalSec }` to the entry helpers (`markets/submitter/steps/expiry.ts`, `ops/x-relay/execute.ts`, `web/features/x/XInstructionBuilder.tsx`); build `EventMarket` fixtures with `packages/core/src/testing/market.ts`; drop every reader of the removed DreamDEX fields (D-011).
- **S2 must agree with core:** ticker `seriesId` values, Gap cadence seed 604,800, basis order `regular 0 · gap 1 · token 2` (confirm in the frozen spec).
- **1a.5 done:** `estPayoutBase(amountRaw, kind)` = `⌊amountRaw × {10⁷ | 5·10⁶} / 10⁷⌋`, exact on every valid grid because registration forces `1000·cu == lot_base`. `feeBps` fields remain as display data, always 0 from the adapter; the UI stages decide whether a fee line survives.
- **1b done (D-015, D-016).** For 1c: `SubmitterSessionProvider({ env, wallet, enabled? })` with `wallet: WalletSession | undefined` (exported as a type from `@agari/markets/react`); the session re-keys on `address` + `kind`, not the wallet object's identity. `parseMarketsEnv` defaults to public devnet; `marketsEnvInputFrom(process.env)` maps `NEXT_PUBLIC_SOLANA_{CLUSTER,RPC_URL,WS_URL}`, `NEXT_PUBLIC_AGARI_{INDEXER_URL,VENUE_ID,EVENTS_PROGRAM_ID}`, `NEXT_PUBLIC_PRICE_FEED_URL`. `SOMNIA_SHANNON` is gone: the Privy config names the cluster itself.
- **For 1d:** the 29 removed symbols and every file still importing them are in `markets-surface.md`. Web code calling `getClient().getViemClient()`/`getErc20*` must go (`getClient()` is a `{ cluster, rpcHttpUrl, rpcWsUrl, eventsProgramId }` descriptor). Product write contexts take `contracts: { signer, deployment }`. `FundingCheck` has no `needsApproval`. `GasCheck` is lamports (`balanceLamports`/`requiredLamports`). `readVenueBoard`/`listWalletFills` return not-deployed until the S3 indexer. Empty `scripts/invariants/no-evm.allow.json` as each file is ported.
- **For S3/S4:** `packages/db` lowercases addresses on write (see Findings). Ops actors compile and idle honestly ("not deployed"); their chain paths (recovery cursor, sends) wait on the adapter. `services/ops` gained `@noble/hashes` for the deck commitment's keccak (was viem).
- **1d must:** verify signed texts with `verifySignedMessage` + a server ed25519 (`faucet`, `x/link`, `room-token`, `private/protocol` now read "Agari" and name the Solana cluster); message signatures travel as base58; the faucet is SOL in lamports (`SOL_FAUCET_POLICY`, `lastValidBlockHeight` instead of an EVM nonce).
- **Numeric cluster ids (D-012):** fields still named `chainId` hold `CLUSTER_ID` (devnet 103).
- **Left for S10 (private):** `PRIVATE_CLAIM_TYPES`/`PRIVATE_CLAIM_DOMAIN_NAME` are EIP-712 and still say Masayume; PD-4 needs an ed25519 claim over a canonical encoding. **S15:** `copy/verdict.ts` "Masayume — it came true", provenance comments in `games/{deck,picking}.ts`.
- **User action (Privy dashboard, before the `/dev/wallet` fixture):**
  - Enable **Solana** embedded wallets and the login methods you want (email, Google, X…) on the app for `NEXT_PUBLIC_PRIVY_APP_ID`.
  - Add `http://localhost:3000` (and the deploy origin in S16) to allowed origins.
  - Turn on **gas sponsorship for Solana** if embedded sends should be fee-free.
