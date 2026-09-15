# Tap-trading spec (S7): adapter, session key, sponsor co-sign, web, lanes

**Authority:** [`vault.md`](vault.md) (program contract). Masayume `68f7a09`:
- `packages/markets/src/{vault/*,sessions/session-key.ts}`
- `web/src/features/{vault,session}/*`
- `web/src/app/api/sponsor/route.ts`

Plan §3.2 fees and gas (`00-plan.md:376-385`), §5 (`00-plan.md:496`), §7.2 S7. `first-call.md` §3 (order lane, journal, reconcile). D-012, D-014, D-023, D-033…D-036. Frozen at the S7 foundation commit (D-061); changes need a D-entry.

M: = `reference/masayume`; F = `web/src/features`. **New** = does not exist yet.

## 1. Adapter (lane 7b; starts at the IDL freeze, §6)

### 1.1 Deployment and reads (`packages/markets/src/vault/{deployment,read,history}.ts`)

**`resolveVaultDeployment(env)`** replaces the stub at `vault/read.ts:9-11`. Result:

`{ chainId, eventVault: env.vaultProgramId, seat: ["seat"] PDA, config: ["vault-config"] PDA, collateral: readVenue().collateralMint, fromBlock: deploy slot }`

- `vaultProgramId` comes from the new `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` and must equal `programs.agari_vault.programId` in `scripts/deploy/addresses.devnet.json`.
- Absent env → `null`, so every surface keeps its honest not-deployed state.
- `getVaultDeployment` (`runtime/read-runtime.ts:96`) returns the same value.

| Read | Source | Mapping |
|---|---|---|
| `getVaultSnapshot(w)` | `getMultipleAccounts([acct(w)])`, then the live `Grant` PDAs from `active_grants` in one more call | Masayume `read.ts:58-99` shape: `availableBase = available`, `privateAvailableBase`, `totalDeposited/WithdrawnBase`. `grants.{session,executor,strategy}` = `VaultGrant` with `maxPriceRaw = max_price_ticks × tick_base`. No account → zeros and null grants. No deployment → `null` |
| `getVaultHoldings(w, onchain)` | the same account read (shared in flight, 1 s) | slot for `onchain.marketId`: `upRaw = yes_lots × lot_base`, `downRaw`, `upGrantId = yes_grant`, `downGrantId`; no slot → zeros (`M:read.ts:102-119`) |
| `getVaultGrant(id)` | `["grant", id]` | throws not-found as Masayume (`M:read.ts:50-55`) |
| `getBalanceSheet(w).vaultBase` | snapshot | `available`, as Masayume `provider/balances.ts:64`; replaces `null` at `provider/wallet.ts:123` |
| `useVaultPoolCredit` source | seat credit per Window | always `[]` (vault.md §1 "sweep"), so the sweep row never renders |
| `listVaultTallies(w)` | index `GET /api/index/wallet/:w/vault-tallies` (new) | Masayume `VaultTally` fields from `Executed`/`Settled` rows; `complete` when paging ends |
| key SOL | `getBalance(key)` every 15 s while armed | feeds `keyFeeLamports` (`F/session/SessionKeyProvider.tsx:73-74`) |

**Indexer:**
- New `packages/markets/src/ops/indexer/vault-decode.ts` decodes the vault's `emit_cpi` events.
- New `packages/db/src/idx/vault.ts` adds `idx_vault_fills`/`idx_vault_settlements` plus the tally query and the unsettled-slots-by-market query that the settler crank uses.
- The stage owner adds the program to the indexer's `logsNotifications` set (`venue-ops.md:140`).

### 1.2 Vault TxIntents (`vault/write.ts`; port `ports/submitter.ts:66-78`)

Every intent runs the S4 tx lane: journal → build → simulate → sign → `markSent(sig, lastValidBlockHeight)` → send → confirm (D-033).

| Intent | Transaction | Signer / fee payer | Sponsorable |
|---|---|---|---|
| `vault-deposit` | [`owner_open_account` if absent] + [ATA idempotent if absent] + `owner_deposit` | owner / owner | never |
| `vault-deposit-and-grant` | [open] + [`SystemProgram.transfer(owner → key, keyTopUpLamports)` when unsponsored] + `owner_deposit_and_grant(grant_id = config.next_grant_id)`. One signature (gate). StaleGrantId 7114 → re-read and rebuild once | owner / owner | never |
| `vault-grant` (rekey) | `owner_grant` (+ `previous_grant`) [+ top-up] | owner / owner | never |
| `vault-fund-grant` | `owner_fund_grant` | owner / owner | never |
| `vault-withdraw` / `vault-withdraw-private` | [ATA idempotent] + `owner_withdraw(_private)` | owner / sponsor when covered, else owner | yes, without the ATA ix |
| `vault-move-private` | `owner_move_to_private` | owner / owner | no (not on Masayume's list) |
| `vault-revoke` | `owner_revoke` | owner / sponsor or owner | yes |
| `vault-crank-settle` | `public_crank_settle` with grant accounts from the slot | any / sponsor or signer | yes |
| `vault-sweep` | none: refused `contract-revert` "nothing to sweep: proceeds are withdrawn on every fill" | — | — |

Journal summaries: Masayume `summarizeVault` wording (`M:vault/write.ts:210-234`), with Solana terms.

### 1.3 Order route through the vault (`vault/order.ts`; `submitter/order-lane.ts:63` dispatches `route.kind !== "wallet"` here)

Masayume `submitVaultOrder` order (`M:vault/order.ts:115-173`) on the S4 steps (`first-call.md` §3.1):
1. `status-gate`.
2. Stop gate.
3. `freshQuote` (requote rule unchanged).
4. `orderExpiry`.
5. **Funded check** (`M:order.ts:56-86`):
   - `vault` → `snapshot.available ≥ quote.maxCostBase`, else `insufficient-collateral`.
   - `vault-grant` → `getVaultGrant` + `simulateCaps` (`core/vault/caps.ts:50`) with `opensNewPosition = held == 0`. A refusal returns `grant-refused` with Masayume's text (`M:order.ts:24-46`) **before any signature or request** (gate: "cap refusal sends no transaction").
6. **Window check:** the Ledger's seat at the vault index is the vault's PROGRAM seat, else refused `market-not-trading` "Trading Balance opens with the next Window" (7207).
7. **Build:**
   - `owner_place` / `actor_place_for` with `outcome` (up 0 / down 1), `is_buy = true`, `price_ticks = limitPriceRaw / tick_base`, `lots = contractsRaw / lot_base`, `expire_ts`;
   - v0, simulate (`sigVerify: false`), CU limit = units × 1.1.
8. **Fees:**
   - `vault-grant` with a sponsor → fee payer = sponsor, `partiallySignTransactionMessageWithSigners` (key), `cosign` (§3).
   - Refusal → the key pays if its balance ≥ `FEE_RESERVE_LAMPORTS` (`core/constants/fees.ts:19`), else refused with the sponsor's reason. The ticket then signs from the wallet (`F/session/useTicketRoute.ts:88`).
9. `journal.record` → sign/co-sign → `markSent` → send → confirm.
10. **Book** from the vault's `Executed` event: `contractsRaw = lots_delta × lot_base`, `costBase = cash_delta`, `avgPriceBps` own terms, `fillCount = fills` (`M:order.ts:89-103`).

**Outcome codes:**
- Simulation 6110 → requote or `no-liquidity`.
- Landed 6110 → `nothingFilled`.
- 7xxx → vault.md §6 kinds.
- Engine 6xxx → the S4 table.

### 1.4 Plain cash-out, L-35 (`submitter/cash-out.ts`, `provider/exit-quote.ts`; new)

- **Exit quote** `freshExitQuote(target, side, contractsRaw)`:
  - Up sells `SELL_YES` into bids as they are; Down sells `SELL_NO` into asks inverted (`events-engine.md` §9 outcome terms).
  - `exitWalk(levels, lots)` (`core/market/book-math.ts:118`) over live, unexpired orders gives `filled`, `proceeds`.
  - `lots = min(held, filled)`.
  - `limit_own` = the last level reached (own terms) − `max(⌊p × 300 / 10,000⌋, 10)` ticks, floored at 1: the downward mirror of `quote_stake` padding (`events-engine.md` §9). The order's YES-terms price is `up ? limit_own : 1000 − limit_own`.
  - `minProceedsBase = lots × limit_own × cu`.
- **Refusals:**
  - `filled == 0` → `no-liquidity` "No exit liquidity right now".
  - `status ≠ Trading` → `market-not-trading` "No exit liquidity: this Window has locked, it pays at settlement" (plan `00-plan.md:1001`).
- **Routes:**
  - wallet → `user_place_order(kind SELL_*, IOC, seat_hint = own seat, use_credit false, withdraw_proceeds true)`, so proceeds land in the ATA and the bond waits for redeem;
  - `vault` → `owner_place(is_buy false)`;
  - `vault-grant` → `actor_place_for(is_buy false)`, sponsorable.
- **Same lane as §1.3:** simulation 6110 → re-quote once, else `no-liquidity`. A fresh `minProceeds` below the displayed one → `requote`. Landed 6110 → `nothingFilled`.
- **Booking:** `OrderExecuted` (wallet) or vault `Executed` → `BookedOrder{ contractsRaw, costBase: 0, proceedsBase }`.

### 1.5 Errors, recovery, ops helper

- `vault/errors.ts`: the vault.md §6 table plus Masayume's names (`M:vault/errors.ts:6-29`), so web refusal copy (`F/session/refusal.ts`) keys on `errorName` unchanged.
- `vault/recovery.ts`:
  - `recoverVaultExecution` by signature: `getTransaction` → the one `Executed` matching owner, actor, market, grant and side (`M:vault/recovery.ts:25-41`).
  - With no signature (the co-sign never returned): the index `Executed` by actor + market since `createdAtMs`, after 120 s (`first-call.md` §3.4). Nothing is ever re-signed.
- `ops/settle/vault-crank.ts` (new): `planVaultCranks(market)` from the index. The stage owner wires it into the settler after `SETTLER_REDEEM_GRACE_SEC` (vault.md §5.1 step 5).

## 2. Session key (Masayume `sessions/session-key.ts`, `F/session/{store,SessionKeyProvider,useKeySession}.*`)

- **Key:**
  - `@agari/markets` exports `generateSessionKey()` (new): Kit `generateKeyPair()`, a **non-extractable** Ed25519 `CryptoKeyPair`, returning `{ address, keyPair }`.
  - It replaces the web's extractable PKCS#8 export (`F/session/keygen.ts:18-27`), since web may not import `@solana/kit` (`kit-import-boundary`).
  - Signing: `createSignerFromKeyPair`. A `SessionSigner` variant `{ keyPair }` joins `{ wallet } | { secretKey }` (`packages/markets/src/sessions/submitter-session.ts:19`).
- **Storage:**
  - IndexedDB via `idb-keyval`, key `agari.sessionKey.<owner>` (`F/session/store.ts:14-18`).
  - Record v2: `{ v: 2, address, keyPair, createdAtMs }`. A `CryptoKey` survives structured clone and stays non-extractable.
  - v1 base58 records (`store.ts:7-12`) read as "no key", so the owner re-enables; devnet only, no migration.
  - No IndexedDB → `STORAGE_UNAVAILABLE`, as Masayume.
- **Lifecycle** (Masayume `M:F/session/SessionKeyProvider.tsx:96-195`):

  | Step | Rule |
  |---|---|
  | enable | `ensureKey` → `vault-deposit-and-grant` with `terms.actor = key`, form defaults `CAPS_DEFAULTS` (`F/session/caps.ts:24`: 5 per trade, 25 daily, 4 positions, 95¢, 24 h, 25 deposit) and `keyTopUpLamports = SESSION_KEY_TOPUP_LAMPORTS` (10,000,000, `F/session/fees.ts:9-10`) only when the sponsor is unconfigured. **One wallet signature**; Masayume's separate top-up (`M:SessionKeyProvider.tsx:136-137`) folds into the same transaction |
  | armed | `deriveStatus` (`F/session/view.ts`): grant live (`now ≤ expires_at_sec`, not revoked), key loaded, and `grant.actor == key.address` exactly (base58 case-sensitive) |
  | tap | `useKeySession` builds the key's own session (its own journal and serialised sends) only while armed, disposing it on any change (`F/session/useKeySession.ts:40-86`) |
  | rekey | `vault-grant` with the same terms and a new key (replaces the grant, budget returned first, vault.md §3.3) |
  | expiry | status `expired`; the budget stays in the Grant until **revoke** (vault.md §3.3 `owner_revoke`), which the manage sheet offers |
  | revoke | `vault-revoke`, sponsorable; the key's session is disposed |
  | forget | delete the IndexedDB record; the grant stays until revoked or expired |
- **Invariant (new, stage owner):** `session-key-non-extractable`. `F/session/**` and `packages/markets/src/sessions/**` may not contain `exportKey(` or `extractable: true`.

## 3. Sponsor fee-payer co-sign (D-023 moved it here; D-065)

**Flow:**
1. The client builds the v0 message with fee payer = the sponsor address from `GET /api/sponsor`, signs partially as the key (or owner), and `POST /api/sponsor { transaction: base64, lastValidBlockHeight }` with header `x-agari-device` (`F/session/store.ts:15` id).
2. The server checks the policy, signs as fee payer only, stores a `sponsor_cosigns` row, and returns `{ signature, transaction, instruction }`. **The server never sends.**
3. The client journals `markSent(signature, lastValidBlockHeight)`, then sends and confirms on the S4 lane. A lost response means nothing was sent.

**Policy** (`packages/markets/src/sponsor/policy.ts`, pure; `sponsor/cosign.ts`, server subpath `@agari/markets/sponsor`; checks in order):

| # | Check | Refusal |
|---|---|---|
| 1 | Decodes as v0 with **no address-table lookups** (every key visible) | 400 |
| 2 | Static key 0 (fee payer) == sponsor; the sponsor's signature slot is empty | 403 |
| 3 | `numRequiredSignatures ≤ 2`; the other signer's signature is present and verifies over the message (WebCrypto Ed25519) | 403 |
| 4 | ≤ 3 instructions. ComputeBudget only `SetComputeUnitLimit ≤ min(SPONSOR_MAX_COMPUTE_UNITS, 400,000)` and `SetComputeUnitPrice ≤ SPONSOR_MAX_MICRO_LAMPORTS` (0 on devnet), at most one each. **Exactly one** agari-vault instruction whose discriminator ∈ {`actor_place_for`, `public_crank_settle`, `owner_withdraw`, `owner_withdraw_private`, `owner_revoke`}: Masayume's `SPONSORABLE_FUNCTIONS` (`M:packages/markets/src/vault/sponsor.ts:25-27`) minus `sweep`. Any other program (System and its nonce advance, Token, ATA, engine) → refuse | 403 |
| 5 | The sponsor key appears in **no instruction's account list** (never writable, signer, `init` payer or transfer source; privileges only pass through listed accounts) | 403 |
| 6 | `isBlockhashValid(blockhash)`; `lastValidBlockHeight − blockHeight ≥ 20` | 409 |
| 7 | `getFeeForMessage ≤ SPONSOR_MAX_FEE_LAMPORTS` (10,000 = 2 signatures) | 403 |
| 8 | `simulateTransaction(sigVerify false, accounts [sponsor])` has no error (a failed transaction still costs the fee), `unitsConsumed ≤ limit`, and sponsor balance delta ≤ fee | 409 |
| 9 | Gates: signer ≤ 30/h, device ≤ 60/h (Masayume defaults, `M:F/session/sponsor.server.ts:21-23`); device ≤ `SPONSOR_DEVICE_DAILY_LAMPORTS` (5,000,000); global ≤ `SPONSOR_DAILY_LAMPORTS` (500,000,000); **breaker** when the sponsor balance < `SPONSOR_MIN_BALANCE_LAMPORTS` (200,000,000). Empty device id → refuse (fail closed, `F/session/sponsor.server.ts` today) | 429 / 503 |

- **Store:**
  - `packages/db/src/{sponsor,schema-sponsor}.ts` (new): `sponsor_cosigns(signature pk, signer, device, instruction, fee_lamports, last_valid_block_height, created_at)`. Daily sums come from it, the plan §3.2 DB budget.
  - Without `DATABASE_URL`, an in-process counter is used and the GET reports `reason: "local counters"`.
- **Wire:**
  - `GET` → `SponsorWire { configured, sponsor, balanceLamports, allowlist: ["agari_vault:actor_place_for", …], reason? }` (additive to `F/session/useSponsorStatus.ts:10-15`).
  - Not configured, no vault, or breaker open → `configured: false` with a reason.
  - `POST` errors are `{ error }` with the codes above, 502 on RPC failure. This replaces the constant 503 (`web/src/app/api/sponsor/route.ts:18-24`).
- **Keys and env (server only, never printed):**
  - `SPONSOR_PRIVATE_KEY`, else the role file `~/.config/agari/devnet/sponsor.json` (`AGARI_KEYS_DIR`), as D-034.
  - `SPONSOR_RPC_URL` defaults to public devnet (D-030 budget).
  - The limits named above.
  - `web/.env.example:84-98` still says EventVault, STT/gas and `SPONSOR_MAX_GAS`; the stage owner rewrites it.
  - The games route shares the role (`F/games/sponsor.server.ts`, S12) but not this policy.
- **Fallback** (Masayume `M:vault/write.ts:99-124`): a refusal returns `null` plus `lastRefusal()`. Owner-signed intents then pay their own fee; key taps follow §1.3 step 8. A wallet that alters a sponsored transaction (for example by adding instructions) fails check 4 and falls back to wallet-paid.
- **P-11** (`docs/plan/audits/ui-fidelity-2026-09-14.md:194`): `useSponsorStatus` fetches only while the enable or manage sheet is open or a key is armed. That is not every page (`F/session/SessionKeyProvider.tsx:40`).
- **Gate row (D-035 → here):** "sponsored fill: fee payer = sponsor, signer = session key, zero wallet popups".

## 4. Web surfaces (lane 7c): Masayume components exactly (D-036)

Every S7 surface already exists file for file. The only diffs are Solana wording and the removed ERC-20 approval (`F/vault/TradingBalancePanel.tsx:23-24`). 7c wires data and fixes copy; it adds no new visuals, except the L-35 control, which uses Masayume's own cash-out link.

| Surface | Masayume | Agari (today) | S7 change |
|---|---|---|---|
| Trading Balance plate row | `VaultRow` in `M:F/markets/balance/BalanceSheetPanel.tsx:40` | same line | none; renders once `vaultBase ≠ null` (§1.1) |
| Portfolio Trading Balance disclosure | `M:F/markets/portfolio/PortfolioScreen.tsx:93-95` → `TradingBalancePanel` | same lines | Solana copy in `VAULT.notDeployed.how` (`F/vault/copy.ts:61` still names `NEXT_PUBLIC_EVENT_VAULT_ADDRESS`); sweep rows gone (empty credit); Y-16 |
| Header "Trading account" | `M:components/shell/header/HeaderAccount.tsx:85-88` | `:66-68` | none |
| Ticket route selector | `RouteControl` at `M:F/markets/ticket/AccountGate.tsx:84`; shown per `Ticket.tsx:152` | `AccountGate.tsx:89`; `Ticket.tsx:157`, route passed `:170` | none (the adapter now serves the route); 7207 copy via `F/session/refusal.ts` |
| Tap-trading chip, enable, manage | `SessionControl` `M:AccountGate.tsx:88` → `SessionChip`, `SessionModal`, `SessionManager` | `AccountGate.tsx:93` | enable = one transaction; fee row from the real key balance; drop `KEY_FEES_UNAVAILABLE` (`F/session/fees.ts:12-13`) and `topUpIfKeyPays` (`SessionKeyProvider.tsx:90-94`) |
| Session provider and recovery | `M:providers/AppProviders.tsx:37,42` | `:30,:35` | key v2 store; the `{ keyPair }` session; P-11 gating |
| Vault open bets | `useVaultBetItems` `M:F/markets/portfolio/BetsPanel.tsx:56` → `VaultBetRow` | same | + cash-out link (below) |
| Vault claims (crank) | `M:F/markets/claims/LiveClaimPlate.tsx:49` → `VaultCreditRows` (crank at `F/vault/VaultCreditRows.tsx:61`) | same | none |
| Wallet open bets (L-35) | `M:F/markets/portfolio/BetRow.tsx:35-74`, no sell (Masayume never built it: `M:F/how-it-works/content.ts:201-202`) | same | "Cash out" link styled exactly as `F/leverage/LeverageBetRow.tsx:121-122` (`type-caption text-accent underline`, `cashOut`/`cashingOut` copy), with the exit quote's `minProceeds`, through a new `F/markets/portfolio/useCashOut.ts` → `submitCashOut`; refusals inline ("No exit liquidity …") |
| How it works | `M:F/how-it-works/content.ts:201-202` | `:200-203` (still says "Masayume's cash-out control is not connected yet") | Agari copy: sell back to the book before lock; after lock it pays at settlement |
| Dev fixtures | `M:web/src/app/dev/{vault,session}` | same (`SessionFixtures.tsx:44` has `forwarder`) | shapes per D-069 |

**Browser pass:** 390/768/1440, both themes, side by side with masayume.app. Covers: not deployed, empty, funded, armed, expired, revoked, cap refusal, sponsor refused (key pays or wallet fallback), predating Window, cash-out fill, no exit liquidity, locked. The audit doc is updated (D-036 upkeep).

## 5. Stage owner, at the foundation (shared files)

- **Ports (additive, D-067/D-069):**
  - `core/vault/types.ts:46-54` `VaultDeployment` → `{ chainId, eventVault, seat, config, collateral, fromBlock }` (drops `forwarder`); `VAULT_NOT_DEPLOYED` (`:74`) → "agari-vault is not deployed on this cluster yet".
  - `ports/submitter.ts`: `vault-deposit-and-grant.keyTopUpLamports?`; `CashOutRequest { market, side, contractsRaw, displayedExit: ExitQuote, wallet, route? }`; `Submitter.submitCashOut`; `BookedOrder.proceedsBase?`.
  - `ports/markets-provider.ts`: `freshExitQuote`; `core/types/trading.ts` `ExitQuote { contractsRaw, limitPriceRaw, expectedProceedsBase, minProceedsBase, avgPriceBps }`.
- **Env:** `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` in `packages/markets/src/env.ts` and `web/src/lib/env.ts`; `.env.example`; `web/.env.local`.
- **Package exports:** `@agari/markets/sponsor` (server-only) and the `generateSessionKey` export; `@agari/clients/agari-vault` codegen (D-025).
- **Chain:**
  - `~/.config/agari/programs/agari-vault.json`, `declare_id!`, `Anchor.toml`, `addresses.devnet.json` `programs.agari_vault`;
  - deploy (`--arch v0`, D-024), IDL metadata publish (D-026);
  - `scripts/deploy/{init-vault,set-authorities}.ts`, `packages/markets/src/deploy/venue-spec.ts:100`;
  - `sponsor` funding.
- **Ops and invariants:** `services/ops/**` (indexer program set, settler crank), `scripts/invariants/**` (§2 invariant), `docs/plan/**`.

## 6. Lanes

| Lane | Branch · worktree · ports | Owns | Proves itself |
|---|---|---|---|
| **7a program** | `slice/S7a-vault-program` · `../agari-wt/s7a` · Surfpool 8980/8981 | `anchor/programs/agari-vault/**`; `anchor/tests/vault_*.rs`, `anchor/tests/src/vault*.rs`, the vault `[[test]]` entries in `anchor/tests/Cargo.toml` | **7a.1 IDL freeze:** every accounts struct, args, state layout (size asserts), event and error builds with `NO_DNA=1 anchor build --arch v0`; handlers may be partial. The stage owner codegens `packages/clients/agari-vault`. **7a:** the LiteSVM suites of vault.md §10; CPI-client choice and `.so` size (D-064); CU and bytes table filled |
| **7b adapter** | `slice/S7b-vault-adapter` · `../agari-wt/s7b` · Surfpool 8990/8991 · DB `agari_s7b` | `packages/markets/src/{vault,sponsor}/**`; `sessions/{session-key,submitter-session}.ts`; `submitter/{order-lane,cash-out}.ts` + `submitter/steps/sell*.ts`; `provider/{exit-quote,wallet,reads}.ts` vault parts; `ops/indexer/vault-decode.ts`, `ops/settle/vault-crank.ts`; `packages/db/src/{sponsor,schema-sponsor}.ts`, `packages/db/src/idx/vault.ts`; `web/src/app/api/index/**` vault path; `scripts/drive/vault*.ts` | Surfpool devnet fork with the local vault deployed and registered (D-027 pattern): enable in one signature, 3 key taps co-signed by the real route handler, cap refusal with no request, revoke, withdraw, settle + crank, cash-out (wallet and vault); killed-send reconcile; policy vitests per §3 row (tampered, extra instruction, ALT, sponsor in accounts, over-fee) |
| **7c web** | `slice/S7c-vault-web` · `../agari-wt/s7c` · web 3007 | `web/src/features/{vault,session}/**`, `web/src/app/api/sponsor/**`, `F/markets/portfolio/{BetRow.tsx,useCashOut.ts}`, `F/how-it-works/content.ts` cash-out entry, `web/src/app/dev/{vault,session}/**` | Against fixtures and the stub until 7b merges, then the fork and devnet; §4 browser pass |

- **Frozen interfaces:**
  - the vault IDL at 7a.1 (a later change needs a D-entry and a re-codegen, and blocks 7b);
  - §3 wire shapes;
  - §5 port additions;
  - the `generateSessionKey` signature.
- **Merge order:** foundation → 7a.1 → codegen → (7b ∥ 7c) → 7a → 7b → 7c.
- **Stage owner only:** every `package.json`, `pnpm-lock.yaml`, package `exports`; `packages/core/src/ports/**`, `core/vault/types.ts`; `packages/markets/src/{env,index}.ts`; `web/src/providers/**`, `web/src/lib/env.ts`, `.env.example`, `web/.env.local`; `services/ops/**`; `scripts/invariants/**`; `scripts/deploy/**`; `anchor/Anchor.toml`, `anchor/Cargo.toml`; program and role keypairs; deploys; `docs/plan/**`. A lane that needs one of these writes the request into its report.

## 7. Gate (restates `00-plan.md:1005-1007`; wallets are Wallet Standard, no Privy, D-023)

- Caps vectors pass: Rust replay and `packages/core/src/vault/caps.test.ts`. `idl-no-destination` passes over `packages/clients/agari-vault/idl.json`.
- **Devnet (acceptance.md rows):**
  - vault deploy + `admin_init_vault` + `set-authorities`;
  - `deposit_and_grant`, one Phantom signature;
  - **3 session taps with zero popups, fee payer = sponsor** (the moved row);
  - cap refusal sends no transaction and no co-sign request;
  - revoke returns the budget;
  - owner withdraw;
  - `crank_settle` → owner (third-party cranker);
  - plain cash-out fill (wallet route);
  - Ledger closes after the settler cranks the vault seat.

## 8. Open questions

| Q | Question | Recommended default |
|---|---|---|
| Q-S7-1 | A fresh wallet with 0.02 SOL (D-012 top-up) enabling tap trading without a sponsor needs ≈ 0.0096 SOL rent + 0.01 key top-up + fees ≈ 0.0197 SOL | Keep 0.02 and ship the sponsor on by default; raise the SOL faucet target to 0.05 only if the sponsor stays off |
| Q-S7-2 | `program_authorities` index table shared with S8's maker (both run `set-authorities`) | Fixed table (vault 0, maker 1, leverage 2, private 3, arena 4); stage owners serialize runs |
| Q-S7-3 | 16 position slots per owner (0.00654 SOL rent) vs 32 (≈ 0.0117) | 16; the settler cranks within ≈ 5 min of settle |
