# 12: Stage roadmap source (the draft behind `docs/plan/00-plan.md` §7)

> **Source:** planning-session Plan agent, 2026-09-13; transcribed by the main session after plan approval. Referenced as C:12.
>
> **The approved plan's §7 wins wherever it differs from this file.** The approved plan adds:
> - **S2 as a hard gate:** no financial program stage (S7, S8, S10, S12b) starts until the engine's randomized sequences, deadline races and failure scenarios pass.
> - **The holdings-aware hedge moves into S6** and forms the M2 holder demo. This file puts it under A-1a in S14.
> - **pnpm only.**
> - **Decisions PD-1…PD-8,** open questions Q-001…Q-008, and the post-approval research files C:06–C:12.
>
> **Path shorthand:**
> - `M:` = `reference/masayume/` (= `/Users/abu/dev/hackathon/sommina-events` @ `68f7a09`)
> - `C:` = `context/`
> - `R:` = `reference/`
> - `P§` = plan section

## 7.1 Resume protocol

**Files created in Stage 0** (each ≤400 lines; split when larger):

| File | Contents |
|---|---|
| `CLAUDE.md` (repo root) | 30 lines: the read order below, P§6 conventions, gate commands, and the rule "never trust memory over STATUS.md" |
| `docs/plan/00-plan.md` | This plan, verbatim. Changes only via a `decisions.md` entry |
| `docs/plan/STATUS.md` | The single resume pointer (template below) |
| `docs/plan/decisions.md` | `D-###` entries in Masayume's agency-log format: date, owner, evidence, rule, user-visible consequence, approval. `Q-###` open user questions, each naming the rows it blocks |
| `docs/plan/acceptance.md` | Evidence ledger: UTC, stage, scenario, parity rows, commit, devnet tx link, result, artifact path. **Failed txs stay in.** Pattern: Masayume's `acceptance-2026-09-06.md` |
| `docs/plan/parity.md` | Every row of `C:05` (L-01…L-74, Y-01…Y-18, A-1a…A-3d): class, status (`Pending/Shell/Partial/Done/Blocked`), owning stage, evidence. Rows are added or advanced, never deleted |
| `docs/plan/stage-NN-<slug>.md` | One per stage or sub-stage (`stage-10a-parlay.md`): the stage block from §7.2 with checkboxes, plus `## Findings` and `## Handoff` |
| `docs/plan/specs/<program>.md` | Design spec per program, derived from Solidity + tests, so parallel agents share one truth |
| `docs/plan/references.md` | Every reference clone: URL, pinned SHA, licence, and use allowed (code vs ideas-only) |

**`STATUS.md` template:**
```md
# STATUS — updated <UTC> by <agent/session>
Current stage: S4 (in-progress)   Sub-slices: 4a done · 4b in-progress (wt ../agari-wt/s4b) · 4c todo · 4d todo
Last green commit (gate passed): <sha> "<msg>"      Last commit: <sha> "<msg>"
In-flight step: S4b.5 journal reconcile — touches packages/markets/src/submitter/**; chain side-effects: none
Done: S0 ✅ S1 ✅ S2 ✅ S3 ✅ | Milestones: M0 ✅ M1 ☐
Blockers: B-3 NEXT_PUBLIC_PRIVY_APP_ID missing (user) since 09-14 — blocks S4c step 6 only
Env readiness (presence only): PYTH ✅(crypto-only) ALPACA ✅ FINNHUB ✅ HELIUS ✅ PRIVY ☐ DATABASE_URL ✅ …
Devnet addresses: scripts/deploy/addresses.devnet.json @ <sha>
Next action: <one imperative sentence a fresh agent can start immediately>
```

**Fresh-agent read order:**
1. `CLAUDE.md`
2. `STATUS.md`
3. The current `stage-NN-*.md` (first unchecked box + `## Handoff`)
4. The last 10 `D-` entries and every open `Q-` in `decisions.md`
5. Only the `00-plan.md` sections the stage names
6. The stage's "Open first" sources

Then run `git status && git log --oneline -5`, confirm HEAD matches STATUS, and run the fast gate before editing.

**Marking progress:**
- Tick a checkbox **in the same commit** as the artifact it describes.
- Update STATUS's `In-flight` line when starting a step (it rides the next commit).
- Append an `acceptance.md` row for every devnet tx.
- Advance `parity.md` statuses only at the stage gate.

**Commits:**
- One per checklist step or smaller. Never end a session with uncommitted work; use `wip(S4b.5): …` if needed.
- Format: `<feat|fix|chore|docs>(S<n><slice>.<step>/<area>): <summary>`, with trailers `Stage: S4`, `Parity: L-32,L-33`, plus required attribution trailers.
- The gate commit is `docs(plan): S4 gate passed`; STATUS "last green" moves to it.

**Branches and worktrees:**
- `main` is always gate-green.
- Stage work goes on `stage/S<n>-<slug>`. Parallel slices go on `slice/S<n><x>-<slug>` in `../agari-wt/<slice>`.
- Slices merge into the stage branch after the slice check; the stage branch merges to `main` after the stage gate.
- Files parallel slices share are append-only and merged by the stage owner: `lib.rs` dispatch, `errors.rs` code ranges, `Anchor.toml`, `addresses.devnet.json`, `services/ops/src/main.ts`, sponsor allowlist.

**Safe mid-stage pickup (every step is idempotent):**
1. Dirty worktree: read the diff, then finish or revert it. Never blind-reset another slice's worktree.
2. Every chain-touching step has a **read-only verify command** in its stage file. Run it first; skip the step if the state already exists.
3. Deploy and init scripts are ensure-style:
   - read `addresses.devnet.json`, check on-chain, create only what's missing;
   - **fail loudly** if existing parameters differ, never overwrite;
   - never regenerate keypairs whose files exist.
4. `pnpm codegen` is deterministic: rebuild, then `git diff --exit-code packages/clients`.
5. DB `ensureSchema()` is idempotent. Ops actors are single-writer with a journal: reconcile before send, never resend.
6. Drive scripts accept `RESUME_*` ids (Masayume's `MATCH_ID` pattern).

**Env and keys checklist.** Each stage file lists its subset. `pnpm env:check` prints presence only.

| Scope | Variables |
|---|---|
| Research/data (root `.env.local`) | `PYTH_API_KEY`, `ALPACA_{ENDPOINT,KEY_ID,SECRET_KEY}`, `FINNHUB_API_KEY`, `HELIUS_API_KEY`, `JUPITER_API_KEY` (optional) |
| Web (`web/.env.local`) | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_SOLANA_RPC_URL`/`_WS_URL`, `DATABASE_URL`, `SPONSOR_PRIVATE_KEY`, `FAUCET_MINT_AUTHORITY_PRIVATE_KEY`, Sensei/brain LLM keys (S13), `X_SESSION_SECRET` + X OAuth 1.0a consumer keys (S11), `ROOM_TOKEN_SECRET` (S12b) |
| Ops (`services/ops/.env.local`, one key per role) | `ROLLER_`, `PRICE_RELAY_`, `PRICE_ATTESTOR_` (ed25519, separate from the relay fee payer), `SETTLER_`, `MAKER_`, `LEVERAGE_KEEPER_`, `RUNNER_`, `X_EXECUTOR_`, `PRIVATE_DESK_`, `GAME_DECK_`, `GAME_SETTLER_`, `SEASON_ADMIN_` `PRIVATE_KEY`; X cookies (rettiwt) |

- Keypair files live outside the repo at `~/.config/agari/devnet/<role>.json`. Program keypairs are backed up to `~/.config/agari/programs/`.
- Committed `.env.example` files contain names only.

## 7.2 Stages

### S0: Bootstrap and authority (M0 "the fork builds")

**Goal:** a git repo with Masayume's exact tree renamed to Agari that builds (still EVM), with a pinned toolchain, cloned references, probed keys, and the plan files.

**Preconditions:** none.

**Open first:** `C:05` §1 and §6; P§1 and P§6; `M:package.json`, `M:pnpm-workspace.yaml`; `M:docs/architecture/yosuku-source-led-migration/05-migration-and-agency-handoff.md` §Stage 0; `R:solana-templates/kit/nextjs-anchor/{anchor,codama.json}`.

**Steps:**
- [ ] `git init` in `/Users/abu/dev/hackathon/stocklana`. Keep `context/` tracked and `reference/` ignored.
- [ ] Import the pinned tree:
  `git -C …/sommina-events archive 68f7a09 web packages services scripts package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts THIRD_PARTY_NOTICES.md | tar -x`
  Contracts, docs and context stay reference-only. Record D-001 (provenance + SHA).
- [ ] Mechanical rename: `@masayume/*`→`@agari/*`; `BRAND` in `web/src/lib/copy.ts`, the manifest and marks; storage key prefixes `masayume.`→`agari.`. Record the remaining `grep -ri masayume` identity hits in the S15 checklist. Tokens and layout are unchanged.
- [ ] `pnpm install && pnpm typecheck && pnpm build` passes on the renamed EVM tree (baseline proof).
- [ ] Toolchain decision D-002:
  - Run `avm install 1.2.0 && avm use 1.2.0`.
  - Build a throwaway program with `anchor-lang = "=1.2.0"` + `pyth-solana-receiver-sdk = "2.0.0"`.
  - If it builds, pin 1.2.0 (`Anchor.toml [toolchain]`, `rust-toolchain.toml`); otherwise pin 1.1.2 for both CLI and crates.
  - Fix the P§1 vs P§6 contradiction to match.
- [ ] Scaffold `anchor/` (Anchor.toml, workspace `Cargo.toml`, `crates/agari-common` stub) from the nextjs-anchor template layout, plus `codama.json` and the `pnpm codegen` / `anchor:build` scripts.
- [ ] Clone into `R:` and pin SHAs in `references.md` (verify repo names with `gh repo view`): Phoenix v1 (MIT), lib-sokoban (MIT/Apache), Polymarket `ctf-exchange` (MIT), BetDexLabs Monaco protocol (Apache), and optionally Manifest (GPL, ideas only).
- [ ] Add the Solana Developer MCP (`https://mcp.solana.com/`) to project `.mcp.json`. Confirm Context7 ids `/websites/anchor-lang`, `/anza-xyz/kit`, `/litesvm/litesvm`.
- [ ] Generate role keypairs (outside the repo) and `scripts/deploy/roles.mjs`, which prints pubkeys only. Fund the deployer with ~15 devnet SOL and record the balance.
- [ ] Create `.env.local` and `.env.example` for root, web and ops, plus `scripts/env-check.mjs`.
- [ ] Rerun `scripts/probe-keys.mjs` including Pyth equities. Record D-003: the settlement source per basis (Pyth if entitled, attested fallback otherwise).
- [ ] Create every `docs/plan/*` file:
  - `parity.md` seeded from `C:05`.
  - D-004+ decisions: Agari brand, Privy, own engine, Masayume authority, nine programs, tests policy.
  - The Q list: Y-01…18 carry-over, A-1b approval, A-2a devnet yield, Yosuku CSS licence for a public repo, X account, geofence method, corporate-action data source.

**Parallelizable:** reference clones, keypairs and env, and the Anchor scaffold (no shared files).

**Exit gate:**
- `pnpm typecheck && pnpm build`
- `NO_DNA=1 anchor build` (empty workspace builds)
- `surfpool --version`
- `pnpm env:check`
- Probe output recorded in `acceptance.md`
- First commit on `main`

**Rows:** none change status (authority setup).

**Risks:** the Yosuku licence Q gates public visibility only. Devnet faucet limits mean requesting SOL over days.

### S1: Solana primitives, stub adapter and wallet shell (no EVM left)

**Goal:**
- Core types are Solana-shaped.
- Every route renders through a stub adapter returning honest `unavailable` Readings.
- Privy and Wallet Standard connect, and ed25519 message signing works.
- No viem, wagmi, RainbowKit or Somnia imports remain.

**Preconditions:** S0.

**Open first:**
- `M:packages/core/src/{types/primitives.ts,ports/markets-provider.ts,ports/submitter.ts,urls,projection/settle.ts,private/types.ts,market}`
- `M:packages/markets/src/{index.ts,react/*}` and `package.json` exports
- `M:web/src/providers/*`, `M:web/src/lib/wallet-session.ts`
- The 32 EVM-importing web files (list in the `C:05` §4.1 grep)
- Context7: Privy v3 Solana, `@solana/kit` 8, `@solana/react`
- The `solana-dev` skill

**Deliverables:**
- **Core types** (`packages/core/src/types/{primitives,ids}.ts`): base58 `Address` and `Signature` (regex brands, no kit import), `Hash32` for sha256 commitments, `MarketId` = Market PDA address.
- **Core modules:**
  - `core/market/{tickers,session,lanes}.ts`: parse the Pyth `schedule` string and the Alpaca calendar shape; cadence alignment; `lock_at`; the no-entry buffer.
  - `core/auth/signed-message.ts`; `core/urls/explorer.ts` (Solana Explorer, devnet); `core/projection/settle.ts` (1e7 payout denominator).
  - Replace `asset: BTC|ETH` with `Ticker` across core.
- **Markets stub:** `packages/markets/src/stub/*` implements both ports with the export map and hook names unchanged. The Masayume originals stay readable under `M:`.
- **Web:**
  - `providers/{AppProviders,UserSessionProvider,privy.tsx,wallet-standard.ts}`; delete `wagmi.ts` and `rainbowkit-theme.ts`.
  - `HeaderAccount` and `ConnectButton` use Privy, with a `toSolanaWalletConnectors()` fallback.
  - `*.server.ts` verifiers call `@agari/markets/identity` (ed25519).
  - Write hooks (`use{Arena,Leverage,Parlay,Range,Desk}Writes`, `usePrivateOpen`, `useXGrant`, `useFaucet`) return a `CapabilityPending` refusal.
- **Invariants** (`scripts/invariants/rules.mjs`):
  - Remove `sdk-import-boundary`, `sdk-version-pin`, `address-drift`, `generated-abi`, `vault-abi-shape`.
  - Add `no-evm`.
  - Add `kit-import-boundary`: only `packages/markets` may import `@solana/*`, `@solana-program/*`, `@agari/clients` or `@pythnetwork/*`, with `web/src/providers` exempt for Privy.
  - Add `idl-no-destination` (AD-5 checked against the IDLs) and `program-id-drift` (Anchor.toml = `declare_id!` = addresses JSON).
  - Extend `file-length` to `.rs`.
- **Tests:** delete tests coupled to removed EVM code rather than porting them (record a D- entry). Keep the golden vectors.

**Steps:**
- [ ] 1a core primitives, tickers, session and lanes (first, so others can compile against it)
- [ ] 1b markets stub + invariants
- [ ] 1c providers, Privy, Wallet Standard, header
- [ ] 1d port the 32 files to the stub and identity seams
- [ ] `/dev/wallet` fixture: Privy sign-in → signMessage → server verify
- [ ] Browser pass: all 37 product routes at 390 and 1440, both themes

**Parallelizable** (after 1a): 1b (`packages/markets`, `scripts/invariants`), 1c (`web/src/providers`, `components/shell`, `lib`), 1d (`web/src/features/**`, `app/api/**`).

**Exit gate:**
- `pnpm typecheck && pnpm invariants && pnpm build`
- `grep -rE "from ['\"](viem|wagmi|@rainbow-me|@somnia-chain)"` returns nothing
- A Privy embedded wallet shows a base58 address in the header, and Phantom connects
- Signed-message verification works

**Rows:** Shell L-01, 02, 03, 05, 06, 07, 21. Partial L-10 (cluster guard), L-24, L-72.

**Risks:** the Privy v3 Solana config shape is unverified (do the Context7 step first). Privy's bundle weight: lazy-load the provider island.

### S2: `agari-events` engine (runs in parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, with a Codama client and targeted money tests.

**Preconditions:** S0.

**Open first:**
- P§3.0–3.1 and P§8 engine checks
- `R:dreamdex-markets-sdk/package/src/{tradeAbi,moduleAbi,readsAbi,eventsAbi,writer,orders,store,derivedReads}.ts` and `binary/{sets,settlement,portfolio}.ts`
- `R:dreamdex-docs/trading/event-contracts*.md` and `developers/event-contracts/*`; `M:context/{41,43,44,48}`
- `R:phoenix-v1` (matching loop, `match_limit`), `R:sokoban`, `R:ctf-exchange` (`MatchType`)
- `C:02` §1.5(a) and §6.3; `R:pyth-examples`
- Context7: Anchor zero-copy, `#[event_cpi]`, `token_interface`

**Deliverables:**
- `docs/plan/specs/events-engine.md`: four-path truth table with worked numbers, escrow and refund formulas, order-type revert semantics, byte layouts + rent, per-instruction account lists, error codes, event schema.
- `anchor/crates/agari-common/src/{fixed,seeds,book_view,events}.rs`.
- `anchor/programs/agari-events/src/`:
  - `{lib.rs,constants,errors,events}.rs`
  - `state/{config,series,market,book,ledger}.rs`
  - `math/{escrow,ladder,paths}.rs`
  - `matching/{engine,evict}.rs`
  - `instructions/*.rs`, one per P§3.1 instruction
- `anchor/tests/events_{paths,orders,settle,prints}.rs` (LiteSVM); `anchor/tests/vectors/book.vectors.json`, shared with `packages/core/src/market/book-math.ts`.
- `packages/clients/agari-events/**` (Codama).
- `scripts/deploy/{deploy.mjs,init-events.mjs,addresses.devnet.json}`, `scripts/drive/events-cycle.ts`.

**Steps:**
- [ ] Spec, frozen at the end of this step
- [ ] Workspace, common fixed-point, seeds
- [ ] State accounts: zero-copy `Book`/`Ledger` via top-level `createAccount` + `#[account(zero)]`
- [ ] Admin instructions + `roller_open_window`
- [ ] Prints:
  - Pyth: uniqueness rule, Full verification, feed id, reject `publish_time > now + 2`.
  - Attested: ed25519 via Instructions-sysvar introspection over the domain-separated message.
- [ ] Matching:
  - four paths; Normal/IOC/FOK/PostOnly; self-match; `max_fills`; eager expiry eviction;
  - funding from credit first, then token transfer;
  - cancel, reduce, cancel-expired.
- [ ] Complete sets + withdraw credit
- [ ] Settle (Up if close ≥ open), void, redeem/redeem_for (owner ATA only), release book, close ledger + `Unclaimed` records
- [ ] `book_view` reads + TS mirror + vectors
- [ ] Targeted tests (P§8 engine list only)
- [ ] CU profile with Surfpool `profileTransaction` (10-fill IOC within budget; record numbers)
- [ ] Codama codegen
- [ ] Devnet deploy + `init-events`: config, tUSDC mint (faucet authority), 2 tickers × regular 5m, 2 book slots each
- [ ] Surfpool drive with time-travel: open → mint-a-pair → print → settle → redeem
- [ ] Same drive on devnet with attested prints

**Parallelizable** (after state + spec are frozen):
- 2a orders/matching (`matching/`, `instructions/user_*order*`)
- 2b prints/settlement/redeem
- 2c sets/admin/roller/deploy scripts
- 2d `book_view`/TS mirror/vectors/codegen

Error code ranges: 6000 admin/roller, 6100 orders, 6200 prints/settle, 6300 sets/cash.

**Exit gate:**
- `NO_DNA=1 anchor build`, `cargo test -p agari-events`, `pnpm codegen && git diff --exit-code packages/clients`
- The Surfpool drive passes
- `acceptance.md` has devnet sigs for: window opened, direct fill, mint-pair fill, burn-pair fill, attested print, settle, redeem, void
- Account sizes, rent and CU recorded

**Rows:** resolves the "market primitive" blocker (`C:05` §6 Q1); enables L-29…L-34.

**Risks:**
- DreamDEX internals are reconstructed from the SDK and docs (the spec cites evidence).
- CU and account limits.
- Anchor 1.x skew in LLM output: use the MCP `program_autofixer`.
- The CPI authority model (program PDA signer) must be designed now for S7+.

### S3: Venue operations (calendar, roller, prices, settler, indexer, seed maker)

**Goal:** devnet runs unattended through a full NYSE session. Windows roll per the calendar, prints post, Windows settle or void, projections fill, and books have quotes.

**Preconditions:** S1 (core session types), S2 (IDL, clients, addresses).

**Open first:**
- `M:services/ops/src/{main.ts,actors/market-maker/*,actors/duel-projector/*}` (cursor/replay pattern)
- `M:packages/db/src/{client,migrate,schema}.ts`
- `C:02` §1.4, §1.5(b)(c), §4.1–4.3, §6.2–6.3; P§2.2, P§4
- `R:dreamdex-bot-kit` ec-maker
- Context7: `@pythnetwork/hermes-client`, Alpaca, Helius `logsSubscribe`

**Deliverables:**
- `services/ops/src/calendar/{alpaca,pyth-schedule,session-service}.ts` (if sources disagree, list nothing).
- Actors:
  - `actors/window-roller/{plan,execute,index}.ts`: idempotent, skips if the Market PDA exists.
  - `actors/price-relay/{pyth-post,attest,alpaca-bars,index}.ts`. D-0xx: web3.js 1.x is confined to `pyth-post.ts` if the receiver SDK requires it.
  - `actors/settler/{decide,index}.ts`.
  - `actors/indexer/{subscribe,backfill,decode,apply,index}.ts`: replay-safe upsert keyed `(market, seq)`, plus a cursor table.
  - `actors/market-maker` with `MAKER_MODE=seat`: post-only quotes from its own seat so the M1 demo has liquidity; `vault` mode arrives in S8 (D-0xx).
- `services/ops/src/http/{health,spot-sse}.ts`.
- `packages/db/src/schema-index.ts` + projections (markets, fills, orders, candles, positions, prints, cursors).
- `packages/markets/src/{runtime/solana-rpc.ts,sessions/keypair-session.ts}` (minimal node-side runtime).
- `scripts/deploy/init-series.mjs` (8 tickers × regular 5/15/60), `scripts/drive/verify-index.ts`.

**Steps:**
- [ ] Calendar service
- [ ] Roller
- [ ] Attested relay
- [ ] Pyth relay (per-series entitlement flag)
- [ ] Settler
- [ ] Indexer + backfill
- [ ] Seed maker
- [ ] Register actors in `main.ts` (DRY_RUN default) + heartbeats
- [ ] Register all series; compute rent
- [ ] One-session soak

**Parallelizable:** 3a calendar+roller · 3b price-relay+SSE · 3c settler+seed maker · 3d indexer+db. The stage owner edits `main.ts`.

**Exit gate:**
- `pnpm typecheck && pnpm invariants`
- Soak evidence: N Windows opened with no overlaps; every Window resolved or voided within its settlement window; indexer lag <10 s; `verify-index.ts` matches on-chain Fill counts
- Outside market hours, the roller lists no regular Windows

**Rows:** Partial L-73, L-15/L-16 inputs. Implements HRS/BASIS semantics.

**Risks:** Pyth entitlement (attested fallback, disclosed); Helius 10 RPS (batch, backfill cursor); attestor trust assumption (README).

### S4: First end-to-end call on devnet (M1)

**Goal:** browse `/markets` signed out → Tutorial → Privy sign-in → Get test funds (SOL top-up + tUSDC mint) → ticket quotes off the book → sponsored IOC fill → The Call share card → Verdict at expiry → Claim → Portfolio rows. Also journal recovery, Reels on the same stream, and a baseline "closed · opens …" state.

**Preconditions:** S3.

**Open first:**
- `M:packages/markets/src/runtime/{read-runtime,coordinator}.ts`
- `M:packages/markets/src/provider/{boot,markets,books,quotes,prices,positions,claimables,resolution,next-window,clock-sync,balances}.ts`
- `M:packages/markets/src/submitter/**`, `sessions/{submitter-session,authority,trader}.ts`, `react/*`
- `M:web/src/features/markets/{hero,lanes,word-board,ticket,verdict,claims,reels,faucet,wallet}`, `features/{funding,onboarding,recovery}`
- `M:web/src/app/api/{faucet,faucet/challenge,sponsor}`
- `M:docs/implementation/testnet-faucet-2026-09-07.md`
- `M:docs/implementation/parity-ledger.md` §hero (L845–873)
- `C:04` §3, §5; the `solana-dev` skill

**Deliverables:**
- **Runtime and providers:**
  - `packages/markets/src/runtime/coordinator.ts`: `accountNotifications` deduped into one book per market.
  - `provider/*` rewritten over Codama decoders + `/api/index/*`.
- **Submitter:**
  - `submitter/steps/{status-gate,expiry,quote,build,sign,send,confirm}.ts`.
  - `submitter/journal`: reconcile by signature + `lastValidBlockHeight` → confirmed / failed / absent / unknown.
  - `sessions/{privy-signer,wallet-standard-signer}.ts`.
- **Faucet and sponsor:**
  - `faucet/solana.ts`.
  - `sponsor/policy.ts`: allowlist Agari program ids + ComputeBudget; refuse deposits and token transfers with the payer as authority; per-address and per-device quotas.
  - `web/src/app/api/{faucet,faucet/challenge,sponsor,index/[...]}/route.ts`.
- **Web:** markets surfaces rewired, including a ticker picker (filter, paging; UNIV), session chips, and "closed" copy.
- **Invariants:** `status-gate-enum`, `expiry-from-headroom`, `order-lane-ioc` re-pointed to the new files.
- `scripts/drive/first-call.ts`.

**Steps:**
- [ ] Context7: kit confirmation factories, Privy `useSignTransaction`
- [ ] Runtime + boot facts
- [ ] Provider reads
- [ ] Hooks (names unchanged)
- [ ] Submitter + journal recovery
- [ ] Signer seams
- [ ] Faucet (challenge, SOL top-up, `mint_to`)
- [ ] Sponsor route
- [ ] Web surfaces rewired
- [ ] Drive script
- [ ] Browser pass at 390/768/1440, both themes: signed-out, first-run, unfunded, quote moved, fill, unknown send (kill the tab mid-send), win/loss/void, claim, closed
- [ ] Tag `m1-first-call`

**Parallelizable** (port signatures frozen since S1; changes need a D- entry):
- 4a `runtime/`, `provider/`, `react/`
- 4b `submitter/`, `sessions/`
- 4c faucet+sponsor (`packages/markets/src/{faucet,sponsor}`, `web/src/app/api/{faucet,sponsor}`, `features/funding`)
- 4d `web/src/features/markets/**`

**Exit gate:**
- Full gate; drive passes
- Manual end-to-end with a fresh Privy account during market hours
- `acceptance.md` rows: faucet SOL, mint, sponsored fill (fee payer = sponsor), ops settle, claim
- Journal recovery shown
- Then run S16 once

**Rows:** L-04, L-08, L-09, L-10, L-22 (The Call), L-24, L-25, L-26, L-29…L-34. Partial L-44, L-46.

**Risks:** blockhash expiry during co-signing (sign immediately); sponsor drain (store `rent_payer`, rate-limit); missing Privy key (blocker B-; Wallet Standard works through the same seam).

### S5: Proof and analytics on the indexer

**Preconditions:** S4.

**Open first:** `M:packages/core/src/projection/*`; `M:packages/markets/src/provider/{history,board,traction,scan,fills}.ts`; `M:web/src/features/{stats,status,edge,leaderboard,surface,share}` + `features/markets/{portfolio,balance,history}`; `M:web/src/app/api/{leaderboard,traction,status}`.

**Deliverables:**
- Portfolio completed: history, receipt, equity, badges, CSV, Restore.
- Trader Edge with ET session buckets.
- Leaderboard with "this session" and per-ticker boards.
- `/stats` and `/traction`.
- `/status` probes: RPC slot lag, indexer lag, relay freshness (session-aware), print source mix, DB, ops heartbeats.
- `/surface` on the Book decode.
- The Earned Heat share card.
- `scripts/drive/recount.ts` (read-only on-chain recount).

**Parallelizable:** 5a portfolio/edge/CSV/badges · 5b leaderboard/stats/traction · 5c status · 5d surface/share.

**Exit gate:** `recount.ts` matches `/stats` and the leaderboard for a 24 h window; `/status` is green during market hours and shows "closed (expected)" otherwise; browser pass.

**Rows:** L-15, L-16, L-22, L-40, L-46 (market pools), L-47, L-48, L-49.

**Risks:** weekends show near-zero 24 h figures (use honest labels).

### S6: Stock-session lanes and states (parallel with S5)

**Goal:** the Monday Gap lane, the 24/7 token lane, halts and voids, earnings flags, split-day skips, and closed / early-close / halted states on every always-on surface.

**Preconditions:** S4.

**Open first:** `C:02` §4, §6; `C:01` (xStock mints, ScaledUiAmount); `C:05` §2.3, §3.1; P§2.2.

**Deliverables:**
- Roller `gap` + `token24x7` series.
- Relay `jupiter.ts`: verified xStock mints only (`isVerified` + `xstocks` tag), with multiplier normalization.
- Void-reason enum on verdicts, receipts and share cards.
- `core/market/events-calendar.ts` (Finnhub earnings) plus the cap-tightening flags S10 consumes.
- `services/ops/config/corporate-actions.json` (a skip list, pending a Q).
- Header session indicator; "TSLAx token price" labels; the Monday Gap card; halted refusals.
- `/dev/states` fixtures (closed, halted, split, gap, token).

**Parallelizable:** 6a gap · 6b token · 6c halts/voids/earnings/corp · 6d copy/states/fixtures.

**Exit gate:**
- Surfpool time-travel proves a Gap Window: Friday close print → Sunday 20:00 lock → Monday open print → settle.
- A halt voids.
- On devnet, the first real weekend yields a token-lane settlement and a Gap Window, recorded in `acceptance.md`.

**Rows:** HRS/BASIS/HALT/CORP/EVT across L-04, L-09, L-29, L-32, L-33, L-44, L-61, L-62, L-72. Resolves `C:05` §6 Q2.

**Risks:** Jupiter price manipulation in thin names (low caps, limited token-lane tickers); holiday-Monday rollover.

### S7: Trading Balance vault, tap trading and plain cash-out

**Preconditions:** S4.

**Open first:** `M:contracts/src/vault/{EventVault,IEventVault,VaultTally,VenueGateway}.sol`; `M:contracts/test/{EventVault.funding,EventVault.trading,CapsVectors}.t.sol`; `M:packages/core/src/vault/caps.vectors.json`; `M:packages/markets/src/{vault,sessions/session-key.ts}`; `M:web/src/features/{vault,session}`; `M:context/41`; `C:04` §4; P§3.2 vault row.

**Deliverables:**
- `anchor/programs/agari-vault/**`:
  - `Account` and `Grant` PDAs with `Caps`.
  - deposit; withdraw to the owner ATA only; `deposit_and_grant`, grant, revoke, `fund_grant`.
  - `place_for`: CPI with the vault-seat PDA, measuring deltas.
  - `crank_settle`; private bucket; `Tally`.
  - Grant kinds SESSION, EXECUTOR, STRATEGY, GAME_SESSION, CLAIM_ONLY.
- Rust replay of the caps vectors; `specs/vault.md`.
- `packages/markets/src/vault/*`. Session key = kit `KeyPairSigner` in IndexedDB. Sponsor policy entry for `place_for`.
- Web: vault and session surfaces; the Trading Balance row on the plate; the ticket route selector; **L-35 plain cash-out** (IOC sell; "no exit liquidity" when closed).

**Parallelizable:** 7a program · 7b markets adapter (after IDL state is frozen) · 7c web.

**Exit gate:**
- Caps vectors pass; `idl-no-destination` passes.
- Devnet evidence: `deposit_and_grant` in one signature → 3 session-key taps with zero wallet popups → a cap refusal sends no tx → revoke returns the budget → owner withdraw → `crank_settle` pays the owner → a plain cash-out fill.

**Rows:** L-27, L-28, L-35, L-46 (Trading Balance pool), Y-16.

**Risks:** CPI depth (user → vault → events = 2, fine).

### S8: Earn (maker vault + maker actor; parallel with S7)

**Preconditions:** S4.

**Open first:** `M:contracts/src/maker/*`; `M:contracts/test/{MarketMakerVault.*,MakerTestBase}.sol`; `M:services/ops/src/actors/market-maker/*`; `M:packages/core/src/maker`, `M:packages/markets/src/maker`, `M:web/src/features/earn`; `M:context/44`.

**Deliverables:**
- `agari-maker`: shares at the conservative share price; supply, and withdraw of idle capital only; per-window caps; post-only BUY_YES@bid and BUY_NO@ask via CPI; merge, pull, settle.
- The actor switches to `MAKER_MODE=vault`: quotes only in session, pulls on halt, never quotes into the close.
- The `/earn` screen; the LP Provider badge.

**Exit gate:** devnet supply → maker quotes rest for a full session → user taps fill against them → merge → settle → withdraw after cranks. A share-price monotonicity check script passes.

**Rows:** L-50, plus the A-2b maker tab.

**Risks:** weekend inventory gap risk (flatten before the close).

### S9: Agents (registry, runner, builder, copy)

**Preconditions:** S7.

**Open first:** `M:contracts/src/strategy/*`, `M:contracts/test/StrategyRegistry.t.sol`; `M:services/ops/src/{runner-main.ts,actors/strategy-runner/**}`; `M:packages/brain`; `M:packages/core/src/strategies/{spec,agent}.ts`; `M:packages/db/src/strategy*.ts`; `M:web/src/features/strategies`, `M:web/src/app/{agents,api/strategies}`; `M:docs/implementation/acceptance-2026-09-06.md` (unit-normalization defect).

**Deliverables:**
- `agari-strategy`: Strategy + Subscription PDAs; subscribe and STRATEGY grant in one tx.
- The runner on kit sessions: reconcile before send, never resend, "sleeping until open".
- The 4-step builder, copy drawer and agents board.
- **L-56** paid Memory Market pass, gated by the subscription fee.
- **L-57** Reversion preset made selectable.

**Parallelizable:** 9a program+adapter · 9b runner · 9c web · 9d L-56/57.

**Exit gate:** devnet publish → subscribe with grant → persisted AI decision → fill → auto-settle to owner → pause/revoke. Restart produces no duplicate attempts. The equity-exponent normalization check passes.

**Rows:** L-51…L-57.

**Risks:** LLM cost; equity price scale.

### S10: Specialist tickets (four sub-stages in separate worktrees)

**Shared rules:**
- Each sub-stage owns its program dir, `packages/markets/src/<product>` and `web/src/features/<product>`.
- The ticket mode registry, `Anchor.toml`, addresses JSON and sponsor allowlist are append-only, merged in order a → b → c → d.

| Sub | Preconditions | Open first | Deliverables | Gate (devnet + vectors) | Rows |
|---|---|---|---|---|---|
| **10a Parlay** | S4 (S7 for the vault route) | `M:contracts/src/parlay/*`, `M:contracts/test/Parlay*.t.sol`, `M:packages/core/src/parlay/pricing.vectors.json`, `M:web/src/features/parlay`, `M:context/42` | `agari-parlay` (legs = Market PDAs, `remaining_accounts` or ALT); `core/parlay/correlation.ts` (ticker-correlation haircut CORR, D-) | vectors; open → `resolve_leg` → claim; voided-leg ticket | L-38 |
| **10b Range + Moonshot** | S4, S6 | `M:contracts/src/range/*`, `M:contracts/test/{Range*,MoonshotVectors}.t.sol`, `M:packages/core/src/range/{pricing,moonshot}.vectors.json`, `M:web/src/features/{range,games/moonshot}`, `M:context/43`, `M:docs/architecture/yosuku-source-led-migration/06-game-architecture.md` §Moonshot | `agari-range` (σ per ticker, settles from the Window close print, `void_stale`, saturated Moonshot bands, earnings-day caps); enable Range takes | vectors; inside/outside settle; a Moonshot round won and paid | L-36, L-67 |
| **10c Boost + keeper (+Inverse)** | S4, S6 | `M:contracts/src/leverage/*`, `M:contracts/test/Leverage*.t.sol`, `M:packages/core/src/leverage/sizing.vectors.json`, `M:services/ops/src/actors/leverage-keeper/*`, `M:web/src/features/leverage`, `M:context/45` | `agari-leverage` (IOC open via CPI, mark = exit walk; no knock-out while halted or closed, and the UI says why; session cap table `C:02` §6.3). **A-1b Inverse** only after Q-approval, as a new instruction set in the same program | vectors; 2× open → cash-out → keeper knock-out → settle | L-37, A-1b |
| **10d Private desk** | S7 | `M:contracts/src/private/*`, `M:contracts/test/Private*.t.sol`, `M:web/src/app/api/private/*`, `M:web/src/features/private` (`desk.server.ts`), `M:context/46` | `agari-private` (owner **or** slot, never both; single-use keys; ed25519 claims; backup/restore) | resumable open (charge/fund/mint); restore from an empty browser; cash-out (settle/sweep/credit/withdraw); a lost reply never double-charges | L-39 |

**Risks:** many-leg tx size (ALTs); normal-σ mispricing across gaps (earnings caps); desk key trust (disclosed).

### S11: Trade from X and Blinks

**Preconditions:** S7, S6. The user supplies the Agari X account, cookies and OAuth keys (Q).

**Open first:** `M:web/src/features/x`, `M:web/src/app/{api/x/*,claim}`; `M:packages/core/src/x/{parse,grant-policy,receipt,refusal}.ts`; `M:services/ops/src/actors/x-relay/**` (README); `M:packages/db/src/x*.ts`; the parity-ledger 2026-09-05 decision (rettiwt); `C:04` §7; `R:solana-actions`.

**Deliverables:**
- Cashtag grammar (`$TSLA up 5 15m`, synonyms, refusal on ambiguity, closed/halted refusals).
- EXECUTOR grant through the vault; relay execution via a kit session; rebranded reply card.
- `/claim` re-link with ed25519.
- `web/public/actions.json` + `/api/actions/w/[marketId]` (GET/POST with a kit-serialized tx) + OG fallback.
- Dialect registry submission (live action; needs the user's go).

**Exit gate:** one mention executes exactly once with an image receipt; one invalid command gets one refusal and no tx; the recursion fence holds; a blink tx confirms through Phantom or dial.to.

**Rows:** L-58, L-59, L-60, A-3d.

### S12: Games

**12a Off-chain and ticket-lane games**
- **Preconditions:** S4 (S6 for off-hours states).
- **Open first:** `M:web/src/features/games/{GamesHub.tsx,catalog.ts,practice,lucky,arcade,art,stage}`; `M:packages/core/src/games`; `M:web/src/app/api/games/{arcade,lucky,occupancy,history}`; `M:packages/db/src/{arcade,lucky,games}.ts`; `M:web/public/sounds/SOURCES.md`; `06-game-architecture.md`.
- **Deliverables:**
  - Hub.
  - Practice on the live spot price (paused off-hours, or on the token lane).
  - Lucky commit-reveal over eligible-Window candidate hash.
  - Line Rider and Candle Hop (identity changes only).
  - History, audio, motion and settings.
  - **L-71** profile, achievements and friends stores (a Masayume gap).
- **Gate:** a devnet Lucky spin placed and settled; an arcade score replayed on the server; Practice checked during and outside market hours.

**12b Arena, Duel, Rank, Season**
- **Preconditions:** S4 (S7 optional).
- **Open first:** `M:contracts/src/games/*`, `M:contracts/test/{GameArena.*,ArenaVectors,SeasonPrizePool}.t.sol`; `M:services/ops/src/actors/{matchmaker,game-room,duel-projector,duel-settler}/*`, `M:services/ops/src/tools/season-*`; `M:web/src/app/api/games/{room-token,rank,season,sponsor}`, `M:web/src/features/games/duel`; `M:context/{54,55}`.
- **Deliverables:**
  - `agari-arena`: matches, per-seat agent key, sha256 deck commitment, picks via engine CPI, finalize/refund branches, season pool instructions.
  - The projector fed by indexer events.
  - Room token signed by the game key and checked against `agentOf`.
  - Sponsor funds the match key.
- **Gate:** two browsers play a full duel (create/join with one signature each → reveal → all cards picked → settle → finalize → claim); refund branches proven on Surfpool; season fund and distribute on devnet.

**Parallelizable:** 12a ∥ 12b.

**Rows:** L-61…L-71.

**Risks:** deck supply depends on in-session Windows (measure dealability with Masayume's `spike:deck-supply` pattern).

### S13: Social and assistant (parallel with S5/S6)

**Preconditions:** S4.

**Open first:** `M:web/src/features/{sensei,room,takes,alerts,news}`, `M:web/src/features/markets/reels`; `M:web/src/app/api/{sensei,room/*,takes,news}`; `M:packages/brain`; `M:packages/db/src/{comments,bettors,takes}.ts`.

**Deliverables:**
- Sensei with stock-, session- and earnings-aware prompts, plus the advice Brake (REG).
- Finnhub news.
- The Room: ed25519 join, bettors from the indexer.
- Takes with cashtags; basis-aware alerts; Reels with woven takes; the marquee sentiment cell (Y-08 decision).
- **A-3a** profiles, follows and social boards.
- **A-3c** ticker rooms, activity feed, and lifecycle notifications (fill, settle, copied trade).

**Parallelizable:** 13a Sensei · 13b Room/Takes/Reels · 13c news/alerts/marquee · 13d A-3a/A-3c.

**Exit gate:** a signed take verifies on the server; the Room is gated by an on-chain position; a Sensei trade card hands off to the ticket and advice framing is refused; notifications fire.

**Rows:** L-04, L-17, L-41…L-45, A-3a, A-3c.

### S14: Add-ons completion

**Preconditions:** S9, S10, S13.

**Deliverables:**
- **A-1a** "Bet against" toggle + Down-first presets + "hedge my xStocks" (mock Token-2022 xStock mints on devnet, labelled as mocks).
- **A-1c** fade a strategy (inverse subscription flag in the runner).
- **A-3b** copy human traders (leader calls feed mirrored under a STRATEGY grant).
- **A-2a** idle-balance yield per the Q answer: either an honest "mainnet only" state plus design, or a devnet reserve-fee accrual bucket. **Never a fake APY.**
- **A-2b** Earn tabs: Maker, Range/Moonshot, Parlay, Boost, Inverse.
- **A-2c** realized-only yield reporting.

**Parallelizable:** 14a A-1a · 14b A-1c+A-3b · 14c A-2a/b/c.

**Exit gate:** each add-on has devnet evidence, or is recorded Blocked with the user's decision.

**Rows:** A-1a, A-1c, A-2a…c, A-3b.

### S15: Public story, docs, submission

**Preconditions:** S5–S14 surfaces exist. Draft copy can start after S6.

**Open first:** `R:yosuku/app/page.tsx` (1,032 lines; the landing page Masayume never ported); `M:web/src/features/{how-it-works,demo,pitch,install}`; `M:README.md`, `M:docs/submission/*`; `/Users/abu/dev/hackathon/masayume-docs`; `C:00` §1, §3, §7; the `direct-demo-video` skill.

**Deliverables:**
- **Site pages:**
  - L-11 landing (live stock dial / closed state)
  - L-12 How it works (sessions, basis, halts, voids)
  - L-13 demo (**recorded Mon–Thu during market hours**)
  - L-14 pitch
  - L-18 download
  - L-19 honest native page (Blocked)
  - L-20 docs site content rewrite
  - L-23 site and per-ticker OG images (Y-14)
- **README:** Proven on-chain table, program ids, trust assumptions, honest limitations, why Solana.
- **Housekeeping:** `THIRD_PARTY_NOTICES.md` (+ Phoenix/sokoban); geofence and disclaimers; submission checklist; brand sweep.

**Exit gate:** public routes at 320/390/768/1440 in both themes; every README link resolves; zero "masayume" identity hits outside notices; demo exists.

**Rows:** L-11…L-14, L-18…L-20, L-23, and Y-rows as decided.

### S16: Deploy train (Vercel web, Fly ops, Neon DB)

**When:** first after S4, again after each milestone, and a final run before S17. **Every live action needs the user's go.**

**Open first:** Masayume's `RESUME.md` twentieth-session hosting notes (Fly `masayume-ops`/Vercel); the `vercel:deploy` skill.

**Deliverables:**
- Neon `DATABASE_URL` + `ensureSchema`.
- Vercel project `agari` (root `web`), env vars, CSP for Privy/Helius.
- `services/ops/{Dockerfile,fly.toml}`: one machine, never auto-stopped, secrets per role.
- `scripts/deploy/verify-live.mjs` (read-only `/api/status`, program ids, ops `/health`).

**Steps:**
- [ ] Provision
- [ ] Migrate
- [ ] **Stop local ops** (one writer per key)
- [ ] Deploy ops
- [ ] Deploy web
- [ ] Verify
- [ ] One end-to-end call from the deployed URL

**Exit gate:** the public URL works, status is green, deploy ids recorded in `acceptance.md`.

**Rows:** L-73, L-74.

### S17: Fidelity completion gate and coherence pass

**Preconditions:** all stages.

**Steps:**
- [ ] Performance pass: one stream per key, hidden-tab throttling, bundle/font audit, lazy game bundles
- [ ] Route-by-route comparison against the Masayume source at 390/768/1440, both themes
- [ ] Drive all eight `C:05` §2.2 flows on the deployed app
- [ ] `parity.md` reconciled; every Q closed or recorded
- [ ] Final README evidence
- [ ] `/status` green

**Exit gate:** §7.4.

## 7.3 Dependency graph and concurrency

```text
S0 ─┬─> S1 ─┐
    └─> S2 ─┴─> S3 ──> S4 (M1 first call) ──┬─> S5  ┐
                                            ├─> S6  │  (M2 stock-native demo = S5+S6)
                                            ├─> S13 │
                                            ├─> S8  │
                                            ├─> S10a, S10b(+S6), S10c(+S6)
                                            ├─> S12a, S12b
                                            ├─> S16 (first run)
                                            └─> S7 ──┬─> S9 ─┐
                                                     ├─> S10d │
                                                     └─> S11(+S6)
                        S9 + S10* + S13 ──> S14 ──> S15 ──> S16 (final) ──> S17
```

**Concurrency:**
- S1 and S2 run in parallel.
- After M1, run up to 4 agents at a time:
  - W1: S5, S6, S13, S7
  - W2: S8, S10a, S10b, S12a
  - W3: S9, S10c, S12b, S11
  - W4: S10d, S14
- Program stages (S2, S7, S8, S10, S12b) own separate `anchor/programs/*` dirs. Only `Anchor.toml` and the addresses JSON are shared, append-only.
- Budget devnet SOL per program deploy, and close buffers after each.

## 7.4 Global definition of done (fidelity completion gate)

1. **Every row classified.** Every row in `parity.md` (L-01…L-74, Y-01…Y-18, A-1a…A-3d) is **Exact / Adapted / Additive / Blocked**.
   - **No row is Excluded** without a dated user decision in `decisions.md`.
   - Every open Q (Y-rows, A-1b, A-2a, Masayume-gap rows) is answered and reclassified.
2. **Every row resolved.** Each is Done, or Blocked with a named blocker and the exact resolution needed (e.g. L-19/Y-17 native: no source exists).
3. **Evidence for each Done row:**
   - a commit;
   - a route check vs the Masayume source at mobile and desktop in both themes;
   - a devnet tx in `acceptance.md` for economic rows.
   - Masayume's route DoD (doc 05) applies: real data, real write boundary, shared truth with adjacent routes, and every identity, failure, recovery and responsive state.
4. **State families.** All `C:05` §2.3 state families are implemented, including stock states: pre, regular, post, closed, holiday, early-close, halted, corporate-action pending, gap and token basis.
5. **Flows driven.** All eight `C:05` §2.2 flows (first call, tap trading, agent lifecycle, X, duel, Lucky, Earn, Private) run on the deployed devnet app with recorded receipts.
6. **Program correctness.**
   - P§8 engine checks and golden vectors pass in Rust.
   - `idl-no-destination` passes (AD-5: no instruction takes a payout destination).
   - Permissionless void, redeem and settle work after their deadlines.
7. **Build health.** `pnpm typecheck && pnpm invariants && pnpm build && NO_DNA=1 anchor build` are green; no file >400 lines; no EVM imports.
8. **No fake data.** No invented odds, balances, fills, users or APYs. Practice and arcade say "no stake".
9. **Shipped.**
   - Deployed (Vercel/Fly/Neon) with `/status` green.
   - README lists trust assumptions and limitations.
   - Demo recorded during market hours.
   - The user has reviewed the full product end-to-end.

## Plan inconsistencies to fix when pasting (all resolved in the approved plan)

- P§1 said Anchor 1.2.0 while P§6 said 1.1.2. S0 decides (D-002); the plan pins `=1.1.2` and spikes 1.2.0.
- P§2.0's last line still said engine decision pending.
- P§5's Brand row still said the name was pending.
- P§5's wallet row omitted Privy.
- P§3.1 text said the Book is ladder + bitmap, but the accounts table said red-black tree or slab. The plan now says ladder + bitmap.

### Critical files for implementation
- `/Users/abu/.claude/plans/golden-stargazing-fiddle.md`
- `/Users/abu/dev/hackathon/stocklana/context/05-masayume-baseline-parity-inventory.md`
- `/Users/abu/dev/hackathon/sommina-events/packages/core/src/ports/markets-provider.ts`
- `/Users/abu/dev/hackathon/sommina-events/packages/core/src/ports/submitter.ts`
- `/Users/abu/dev/hackathon/sommina-events/scripts/invariants/rules.mjs`
