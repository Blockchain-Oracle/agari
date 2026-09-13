# 11: Solana reference repos (patterns to adopt, adapt, avoid)

> **Source:** planning-session explore agent, 2026-09-13, transcribed by the main session after plan approval.
> **Scope:** local clones under `stocklana/reference/`, read locally with no web access.
> **Referenced by:** `docs/plan/00-plan.md` §3 and stages S1/S2/S4/S11 as C:11.
> **Tags:** [C] means read in code; [I] means inferred.

All paths below are under `/Users/abu/dev/hackathon/stocklana/reference/`.

**What the references do and don't give you:**
- The patterns you need are all in these repos, but none can be copied as-is.
- MagicBlock's example has two engine bugs.
- The Next.js template you want is split across two repos.
- Switchboard's example crates conflict with Anchor 1.x.

---

## 1. MagicBlock binary-prediction

Program files: `magicblock-engine-examples/binary-prediction/anchor/programs/binary-prediction/src/{lib,state,error,utils}.rs`

**Versions** [C]
- `anchor-lang =1.0.2` (+`init-if-needed`), `anchor-spl =1.0.2`, `ephemeral-rollups-sdk 0.16.2`, `pyth-solana-receiver-sdk =2.0.0`, `session-keys =3.1.1` (`no-entrypoint`).
- `Anchor.toml` pins toolchain 1.0.2 but still has a `[registry]` section, which Anchor 1.0.0 removed.
- Test genesis loads `dlp.so` (`DELeGG…`), `ephemeral_token_program.so` (`SPLxh1…`) and `ephemeral_oracle.so` (`PriCems5…`).

**PDAs** [C]
- `POOL_SEED = b"pool"`, seeds `[pool, mint]`.
- `BET_SEED = b"bet"`, seeds `[bet, user]`. The seeds don't include the pool, so each user gets one Bet account across all pools.
- Constants: `MAX_PRICE_AGE_SECONDS = 300`, `BASIS_POINTS_DENOMINATOR = 10_000`.

**State** [C]
- `Pool { mint, authority (= Pool PDA itself), price_feed: Pubkey, price_feed_id: [u8;32], bet_duration_seconds: i64, min_stake, payout_bps, bump }`, sized by a hand-written `LEN`.
- `Bet { open_price: i64, expiry_ts, direction: Direction{Up,Down}, stake, is_open }`.

**Errors** [C]: `InvalidAmount`, `InvalidTokenOwner`, `InvalidPoolConfig`, `MintMismatch`, `InvalidEphemeralAta`, `InvalidVault`, `InvalidVaultAta`, `InvalidDelegationPda`, `StakeTooSmall`, `BetAlreadyOpen`, `BetNotOpen`, `BetNotExpired`, `InvalidPriceFeed`, `InvalidTokenDelegate`, `InsufficientDelegatedAmount`, `InsufficientLiquidity`, `MathOverflow`, `TieHasNoDirection`.

**Instructions** [C] (`#[ephemeral] #[program]`)

| Instruction | Layer | Accounts and logic |
|---|---|---|
| `initialize(price_feed, price_feed_id, seed_amount, bet_duration_seconds, min_stake, payout_bps)` | base | See the breakdown below the table. |
| `initialize_bet` | base | `payer`, `user: UncheckedAccount`, `bet` (`init_if_needed`) |
| `delegate_bet` | base | `#[delegate]` struct, `#[account(mut, del, seeds…)] bet: UncheckedAccount`, `user: Signer`; calls `ctx.accounts.delegate_bet(&payer, seeds, DelegateConfig{validator, ..Default})` |
| `undelegate_bet` | ER | `#[commit]` struct; `MagicIntentBundleBuilder::new(payer, magic_context, magic_program).commit_and_undelegate(&[bet]).build_and_invoke()` |
| `place_bet(direction, stake)` | ER | `#[session_auth_or(ctx.accounts.user.key() == ctx.accounts.payer.key(), SessionError::InvalidToken)]`; `#[derive(Accounts, Session)]`; `#[session(signer = payer, authority = user.key())] session_token: Option<Account<SessionTokenV2>>`; `price_update: UncheckedAccount` whose key must equal `pool.price_feed` |
| `settle` | ER | Anyone can call. Requires `now >= expiry_ts`, reads the price at settle time. A tie refunds the stake, a win pays `stake*payout_bps/10_000`, a loss pays 0. Resets the Bet. |

`initialize` in detail:
- **Accounts:** `admin`, `mint`, `pool` (init), `pool_token_account` (ATA, `init_if_needed`), `admin_token_account`.
- **Ephemeral-rollup plumbing,** each checked with `constraint = key == helper()`: `pool_ephemeral_ata`, `vault`, `vault_ephemeral_ata`, `vault_token_account`, and buffer/record/metadata PDAs for both EATAs. `ephemeral_token_program` and `delegation_program` are pinned with `address =`.
- **Flow:**
  1. SPL transfer admin → pool ATA
  2. `init_ephemeral_ata`
  3. `init_vault`
  4. create the vault ATA
  5. `delegate_ephemeral_ata` (vault)
  6. `transfer_to_vault`, signed by the pool PDA
  7. `delegate_ephemeral_ata` (pool)
- The validator comes from `remaining_accounts[0]`.

**How session keys authorize `place_bet`** [C]
1. The macro accepts either the user signing, or a valid `SessionTokenV2` whose signer is `payer` and authority is `user`.
2. Session keys can't move tokens on their own. When `payer != user`, `require_token_delegate(user_token_account, payer, stake)` requires the session key to be an SPL `approve` delegate with enough allowance.
3. `signer_transfer` then moves the stake with `payer` as authority.

**Liquidity check** [C]: `pool_token_account.amount + stake >= checked_payout(stake, payout_bps)`.

**Two flaws not to copy** [C, from reading the logic]
- **Solvency is checked per bet, not in aggregate.** Other bets' open liabilities are ignored, so the pool can over-commit.
- **Settlement uses whatever price is current when `settle` is called** (within 300 s), so the user can pick a convenient moment. Stocklana must pin settlement to a price published at or just after the window end.
- The program also emits no events.

**Ephemeral-rollup-only vs base layer** [C]
- ER-only: the `#[ephemeral]`/`#[delegate]`/`#[commit]` macros, EATA/vault/delegation PDAs (seeds `"buffer"`, `"delegation"`, `"delegation-metadata"`), the MagicBlock ephemeral oracle account `ENYwebBT…` (SOL/USD), and `Magic11…`/`MagicContext1…` ids.
- It already uses the Anchor 1.x call form `CpiContext::new(ctx.accounts.token_program.key(), …)`.

**TS client** (`app/src/lib/binaryPrediction.ts`) [C]
- **Stack:** web3.js v1 + `@coral-xyz/anchor 0.32.1`, Vite, React 18. Not kit.
- **Connections:** two `AnchorProvider`s, base layer `https://rpc.magicblock.app/devnet` and ER `https://devnet-as.magicblock.app`. Validator `MAS1Dt9q…`.
- **Keys and tokens:** burner keypairs live in localStorage. User tokens are delegated with `delegateSpl()` from `@magicblock-labs/ephemeral-rollups-sdk 0.14.3`.
- **Oracle decoding:** `decodeOraclePrice` reads raw offsets (price i64 @73, exponent i32 @89, publish_time i64 @93, slot @125). It accepts two discriminators: ephemeral oracle `[234,161,14,36,…]` and Pyth `PriceUpdateV2` `[34,241,35,99,…]`.
- **Quirks:** `initialize` passes `feed.toBytes()` (the account address) as `price_feed_id`. The app never creates a session; it always sends `sessionToken: null`.

**Session token lifecycle** [C] (`tests/binary-prediction.ts:631-695`, `magicblock-engine-examples/session-keys/anchor/app/src/App.tsx`)
1. Create: `new SessionTokenManager(wallet, connection)` (`@magicblock-labs/gum-sdk ^3.0.10`), then `.program.methods.createSessionV2(topUp: bool, validUntil: BN(now+3600), topUpLamports: BN)` with `.accounts({targetProgram, sessionSigner, feePayer, authority})`. Signers: authority and the session keypair.
2. The session PDA is `["session_token_v2", targetProgram, sessionSigner, authority]` under the gum program.
3. Approve: `createApproveInstruction(userAta, sessionSigner, user, STAKE)`, sent on the ER connection.
4. Call the instruction with `payer: sessionKeypair, sessionToken: pda`.
5. Revoke with `revokeSessionV2().accounts({sessionToken})`. Check expiry by fetching `sessionTokenV2.validUntil`.

The counter example (`session-keys/anchor/programs/anchor-counter-session/src/lib.rs`) adds two points:
- Its `delegate` does the check by hand, because `session_auth_or` can't read fields from an `UncheckedAccount`.
- Its app bumps a nonce on each create to avoid "Allocate: account already in use", and derives the temp keypair from pubkey XOR nonce. **That derivation is predictable. Don't copy it.**

---

## 2. solana-templates (you need parts of two templates)

**`solana-templates/kit/nextjs-anchor`** [C]: Anchor and Codama wiring
- **Layout:**
  - `anchor/{Anchor.toml, Cargo.toml, programs/vault/src/{lib.rs,tests.rs}}`
  - `app/{components/*, generated/vault/{errors,instructions,pdas,programs,shared,index.ts}, lib/{wallet/{context.tsx,signer.ts,standard.ts,types.ts}, hooks/{use-balance,use-send-transaction}.ts, solana-client.ts, solana-client-context.tsx, errors.ts, explorer.ts}}`
  - root: `codama.json`, `next.config.ts`, `empty-module.js`
- **Dependencies:** `@solana/kit ^6.3.0`, `@solana/kit-client-rpc ^0.7.0`, `@solana/kit-plugin-rpc ^0.7.0`, `@wallet-standard/*`, `next 16.3.4`, `react 19.2.3`, `next-themes`, `sonner`, `swr`, `ws`. Dev: `codama 1.10.0`, `@codama/nodes-from-anchor 1.5.3`, `@codama/renderers-js 1.7.1`, `tailwindcss ^4`, `@tailwindcss/postcss`.
- **Scripts:**
  - `anchor-build` = `cd anchor && anchor build --ignore-keys`
  - `anchor-test` adds `cargo test`
  - `codama:js` = `codama run js`
  - `setup` = anchor-build + codama:js
  - plus `dev`/`build`/`lint`/`format`/`ci`
  - No deploy script; the README says to deploy manually without `--ignore-keys`.
- **`codama.json`:** `{"idl":"./anchor/target/idl/vault.json","scripts":{"js":[{"from":"@codama/renderers-js","args":["./app/generated/vault"]}]}}`.
- **Using the generated client:** the web imports `getDepositInstruction` and `getWithdrawInstructionAsync` from `../generated/vault`. The async variant fills in PDA accounts.
- **`Anchor.toml`:** empty `[toolchain]`, `programs.devnet.vault`, `[scripts] test = "cargo test"`, empty `[hooks]`.
- **Program:** `anchor-lang = "1.1.2"`, dev-deps `litesvm 0.10.0` and `solana-sdk 3`. `tests.rs` uses `LiteSVM::new()` with `include_bytes!("../../../target/deploy/vault.so")`.
- **Wallet:**
  - Hand-rolled Wallet Standard. `signer.ts` builds a `TransactionModifyingSigner`, falling back to `TransactionSendingSigner`.
  - Transactions are sent with `createClient({url, rpcSubscriptionsConfig, payer: signer}).sendTransaction(ixs)` from `@solana/kit-client-rpc`.
- **Env:** no `process.env`. Clusters are a hard-coded map, and the selection is saved in localStorage `solana-cluster`.
- **`next.config.ts`:** `serverExternalPackages: ["ws"]`, turbopack `resolveAlias fs → ./empty-module.js`.
- **Styling:** Tailwind v4 with shadcn-style CSS variables in `app/globals.css` (`@custom-variant dark`). No `components.json`, so no shadcn CLI.

**`solana-templates/kit/nextjs`** [C]: the wallet stack you want
- **Dependencies:** `@solana/kit ^7.0.0`, `@solana/kit-plugin-wallet ^0.14.0`, `@solana/react ^7.0.0`, `@solana/kit-plugin-rpc ^0.15.0`, `@solana-program/{system,token,memo}`; dev `@solana/surfpool ^1.5.0`, vitest.
- **Client:** `app/lib/solana-client.ts` builds `createClient().use(walletSigner({chain})).use(solanaRpc({rpcUrl, rpcSubscriptionsUrl, transactionConfig:{microLamportsPerComputeUnit}})).use(rpcAirdrop()).use(systemProgram())…`. Localnet signs against `solana:devnet`.
- **Hooks:** `ClientProvider`/`useClient` (`@solana/react`); `useWallets`/`useConnect`/`useDisconnect`/`useConnectedWallet`/`useIsWalletReady` (`@solana/kit-plugin-wallet/react`); `useAction` (`@solana/react`); `useTrackedDataSWR` (`@solana/react/swr`).

[I] Both templates are on kit 6 or 7, so expect peer-dependency bumps for kit 8. `anchor/cli/src/codama.rs` exists (not read), which suggests built-in Codama generation in Anchor.

---

## 3. Anchor repo

**Version** [C]: `anchor/Cargo.toml` workspace version is `1.2.0` (released 2026-09-04).

**1.0.0 breaking changes** [C]
- Duplicate mutable accounts are rejected unless marked `dup` (#3946).
- Program Metadata replaces legacy IDL instructions (#3798); see `cli/src/metadata.rs`, `PMP_CLIENT_VERSION 0.5.1`.
- `@coral-xyz/anchor` is renamed `@anchor-lang/core` (#4141).
- The program `AccountInfo` is removed from `CpiContext` (#2762); `lang/src/context.rs:188` is `CpiContext::new(program_id: Pubkey, accounts)`.
- Solana 3.0 dependencies; `[registry]` removed; one `#[error_code]` per program; no external `solana` CLI needed.

**1.0.0 features** [C]
- Surfpool is the default for `anchor test`/`localnet` (#4106).
- LiteSVM is the default test template (#4316; `cli/src/template.rs:602`, `litesvm = "0.10.0"`).
- `Migration<'info,From,To>`, `[hooks]`, and a deprecation warning for `AccountInfo` in `Accounts`.
- `init_if_needed` is now included in duplicate-account checks.

**1.1.1** [C]: versioned transactions in the client, multiple named scripts, `program_id` check on CPI return data, MSRV 1.89, syn 2, a warning when `event-cpi` is unreachable under custom discriminators.

**1.1.2** [C]: only tightens dependencies between `anchor-*` crates.

**1.2.0** [C]
- A TS error-constants file generated from the IDL.
- `AccountLoader::new_unchecked`.
- Pausable mint extension; clearer `token` constraint errors.
- Generated CPI metas honor `is_signer`, enabling PDA signers (#3322).
- All-zero discriminators rejected; `LazyAccount` re-checked after CPI; SIMD-0431 extend-size fix.

**Do you need 1.2.0 over 1.1.2?** [I]
- Not strictly. It helps with generated TS error constants and with `declare_program!` CPI using PDA signers.
- The real risk is the tighter crate pins: mixing 1.2.0 with `session-keys 3.1.1` or `ephemeral-rollups-sdk` (the MagicBlock examples pin 1.0.2) may not resolve.
- Run `cargo tree -i anchor-lang` before choosing.

**Where the examples are** [C]

| Feature | Path |
|---|---|
| `emit_cpi!` / `#[event_cpi]` | `anchor/tests/events/programs/events/src/lib.rs` |
| `token_interface::transfer_checked` | `anchor/tests/escrow/programs/escrow/src/lib.rs:84,92`, `anchor/tests/spl/token-proxy`, `anchor/tests/spl/token-wrapper` |
| PDA signer `new_with_signer` | `anchor/tests/spl/token-wrapper`, `anchor/tests/cashiers-check`, `anchor/tests/ido-pool`, `anchor/tests/lockup/programs/registry` |
| `InitSpace` | `anchor/tests/idl/programs/idl`, `anchor/tests/chat`, `anchor/tests/lazy-account` |
| `dup` constraint | `anchor/tests/duplicate-mutable-accounts/programs/duplicate-mutable-accounts/src/lib.rs:115` |
| Token-2022 re-exports | `anchor/spl/src/token_interface.rs` (re-exports `token_2022` and its extensions) |

---

## 4. pyth-examples

**`pyth-examples/price_feeds/solana/send_usd`** [C]: older stack, `anchor-lang 0.30.1` + `pyth-solana-receiver-sdk 0.5.0`
- **Program:** `Account<'info, PriceUpdateV2>`, then `get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE=3600, &get_feed_id_from_hex(FEED_ID)?)`.
- **TWAP variant:** `Account<TwapUpdate>` with `get_twap_no_older_than(clock, age, window, feed_id)`.
- **App:** CRA on web3.js 1, using `@pythnetwork/hermes-client ^2.0.0` and `@pythnetwork/pyth-solana-receiver ^0.10.0`.
- **Posting flow:**
  1. `new HermesClient("https://hermes.pyth.network/").getLatestPriceUpdates([id], {encoding:"base64"})`
  2. `new PythSolanaReceiver({connection, wallet}).newTransactionBuilder({closeUpdateAccounts:true})`
  3. `addPostPriceUpdates(data.binary.data)`
  4. `addPriceConsumerInstructions(async getPriceUpdateAccount => [{instruction, signers:[]}])`
  5. `provider.sendAll(await buildVersionedTransactions({computeUnitPriceMicroLamports:50000}), {skipPreflight:true})`
  - For TWAP, swap in `getLatestTwaps` / `addPostTwapUpdates` / `addTwapConsumerInstructions`.

**Matching versions for Stocklana** [C]: `program-examples/oracles/pyth/anchor/programs/pythexample` uses `anchor-lang 1.0.2` + `pyth-solana-receiver-sdk 2.0.0`, reading `price_update.price_message.{feed_id, price, conf, exponent, publish_time}` directly.

**No local example checks a price against a target timestamp** [C via grep]. For settlement [I]:
- Use `Account<PriceUpdateV2>`, which checks the owner. binary-prediction's `try_deserialize_unchecked` is only safe because it pins the account address.
- Require `feed_id` to match, `publish_time >= window_end` and `publish_time <= window_end + grace`, and Full verification.
- Fetch the update from Hermes by timestamp (`/v2/updates/price/{t}`). That endpoint doesn't appear in the local references.

**Alternative** [C]: `pyth-examples/lazer/solana-anchor` uses `anchor 0.31.1` + `pyth-lazer-solana-contract 0.5.0`.

---

## 5. switchboard-examples

**Versions** [C]
- All Anchor examples use `anchor-lang 0.31.1` + `switchboard-on-demand 0.13.0` (`anchor`, `devnet` features), and pin `blake3 =1.8.2` and `constant_time_eq =0.3.1`.
- TS: `@switchboard-xyz/on-demand ^3.10.6`, `@switchboard-xyz/common ^5.8.5`, `@coral-xyz/anchor ^0.31.1`.
- [I] The `anchor` feature will likely conflict with anchor-lang 1.x.

**Current "managed quote" pattern** (`switchboard-examples/solana/feeds/basic`) [C]
- **Program:**
  - `#[account(address = quote_account.canonical_key(&default_queue()))] quote_account: Box<Account<SwitchboardQuote>>`.
  - Staleness is `clock.slot - quote_account.slot` (in slots); the example only logs it.
  - Values are read with `feed.value()` / `feed.hex_id()`.
- **Creating a custom feed** (`scripts/createManagedFeed.ts`, `utils.ts:221`):
  1. `OracleJob.fromObject({tasks:[{httpTask:{url}}, {jsonParseTask:{path:"$[?(@.symbol == 'X')].price"}}]})`
  2. `OracleFeed.fromObject({name, jobs, minOracleSamples, minJobResponses, maxJobRangePct})`
  3. `new CrossbarClient("https://crossbar.switchboard.xyz").storeOracleFeed(feed)` returns `feedId`
- **Updating:**
  1. `queue.fetchManagedUpdateIxs(crossbar, [feedHash], {numSignatures, variableOverrides, payer})` returns an Ed25519 instruction plus a `verified_update` instruction.
  2. The account is `OracleQuote.getCanonicalPubkey(queue.pubkey, [feedHash])`.
  3. The transaction is built with `sb.asV0Tx`.
- Values are i128 with 18 decimals.

**Pinocchio variant** (`feeds/advanced`) [C]: `QuoteVerifier::new().slothash_sysvar().ix_sysvar().clock_slot().queue().max_age(30).verify_account(quote)`.

**Strong pattern for binding a stock API to a feed** (`switchboard-examples/solana/prediction-market/programs/prediction-market/src/lib.rs`) [C]
1. `verifier.verify_instruction_at(0)`.
2. Rebuild the protobuf `OracleFeed` on-chain (`KalshiApiTask` + `JsonParseTask`, with secrets as `${VAR}` overrides).
3. Hash it and `require!(feed_id == expected)`.

**Legacy** [C]: `PullFeedAccountData::parse` (`solana/legacy/variable-overrides/programs/sb-on-demand-solana/src/lib.rs`, `on-demand =0.4.7`); `feedAccount.fetchUpdateIx` (`solana/legacy/feeds/runFeed.ts:69`); `PullFeed.fetchUpdateManyIx` (`solana/legacy/benchmarks`).

**Randomness** (`solana/randomness/coin-flip`) [C]
- **Commit:** `RandomnessAccountData::parse`; require `seed_slot == clock.slot - 1` and that `get_value(slot)` still errors (not yet revealed). Store `commit_slot` and **take collateral at commit**.
- **Settle:** check the account key, `seed_slot == commit_slot`, then `get_value(clock.slot)`.
- **TS:** `sb.Randomness.create(program, kp, queue)`, `commitIx(queue)`, `revealIx()`.

---

## 6. kora

**TS SDK** [C]: `@solana/kora 0.3.0-beta.4`, exports `.` and `./kit`. Depends on `@solana/kit ^7.1.0`, `kit-plugin-{instruction-plan ^0.13, rpc ^0.15, signer ^0.13}`, `@solana-program/compute-budget ^0.17`.

**Kit plugin** (`kora/sdks/ts/src/kit/index.ts`) [C]
- **Usage:** `createClient().use(identity(userSigner)).use(kora({endpoint, rpcUrl, feeToken, apiKey?, hmacSecret?, getRecaptchaToken?, computeUnitLimit?, tokenProgramId?}))`, then `client.sendTransaction([ix])`.
- **Internally:**
  1. `getPayerSigner()`, then installs a no-op payer signer.
  2. Adds compute-budget instructions and a placeholder payment instruction (`kit/payment.ts`).
  3. The executor (`kit/executor.ts`) estimates the fee, rewrites or removes the payment instruction, then calls `signAndSendTransaction`.
- `plugin.ts` `koraPlugin` exposes `estimateTransactionFee`, `estimateBundleFee`, `getBlockhash`, `getConfig`, and more.

**Config file** (`kora/kora.toml`) [C]

| Section | Settings |
|---|---|
| `[kora]` | `rate_limit`, `cors_allow_origins` |
| `[kora.auth]` | `api_key`, `hmac_secret`, recaptcha |
| `[kora.enabled_methods]` | which RPC methods are exposed |
| `[validation]` | `max_allowed_lamports`, `max_signatures`, `price_source`, `allowed_programs`, `allowed_tokens`, `allowed_spl_paid_tokens`, `disallowed_accounts`, `require_one_of_programs` |
| `[validation.fee_payer_policy.{system, system.nonce, spl_token, token_2022, alt}]` | `allow_*` booleans |
| `[validation.price]` | `type = free|margin|fixed` |
| `[validation.token_2022]` | blocked extensions |
| `[kora.usage_limit]` | usage limits |
| `[kora.lighthouse]` | only for sign-then-send flows |

**Allowlisting limits** [C via grep]: there is no instruction- or discriminator-level allowlist. The closest controls are `allowed_programs` + `require_one_of_programs` + the fee-payer policy.

[I] Set every fee-payer `allow_transfer`/`allow_approve`-style flag to `false`. The sample config sets them to `true`.

---

## 7. solana-actions

Example app: `solana-actions/examples/next-js` (Next 14.2.3, `@solana/actions ^1.6.4`, web3.js 1) [C].

**`src/app/actions.json/route.ts`**
- `GET` returns `ActionsJson{rules:[{pathPattern:"/*",apiPath:"/api/actions/*"},{pathPattern:"/api/actions/**",apiPath:"/api/actions/**"}]}` with `createActionHeaders()`.
- `OPTIONS = GET`.

**`src/app/api/actions/transfer-sol/route.ts`**
- `GET` returns `ActionGetResponse{type:"action", title, icon, description, label, links:{actions:[{label, href, parameters:[{name,label,required}]}]}}`.
- `OPTIONS` returns null with the headers.
- `POST` reads `ActionPostRequest.account`, builds a transaction with `feePayer = account`, and returns `createPostResponse({fields:{transaction, message}, signers?})`.
- Errors return `ActionError{message}` with status 400.
- Other routes in the example: `memo`, `stake`, `chaining-basics` (+`next-action`).

**Protocol details**
- **Transaction encoding:** base64, serialized with `requireAllSignatures:false` (`packages/solana-actions/src/createPostResponse.ts:112,145`).
- **CORS headers** (`packages/solana-actions/src/constants.ts`): `ACTIONS_CORS_HEADERS` sets allow-origin `*`, methods `GET,POST,PUT,OPTIONS`, allowed headers including `X-Accept-Action-Version` and `X-Accept-Blockchain-Ids`, and exposed headers `X-Action-Version, X-Blockchain-Ids`.
- **Chain id:** `BLOCKCHAIN_IDS.devnet = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`.

[I] With kit, write your own base64 of the unsigned wire transaction instead of using `createPostResponse`.

---

## 8. program-examples (Anchor 1.0.2)

| Pattern | Path | Notes |
|---|---|---|
| Token-2022 / `token_interface` [C] | `program-examples/tokens/token-2022/basics/anchor/programs/basics/src/lib.rs` | `InterfaceAccount<Mint>`, `Interface<TokenInterface>`, `mint::decimals`, `transfer_checked(CpiContext::new(token_program.key(), …), amt, mint.decimals)`. Extension examples under `tokens/token-2022/*` (transfer-hook, permanent-delegate, …) |
| Escrow/vault PDA + PDA-signed CPI [C] | `program-examples/tokens/escrow/anchor/programs/escrow/src/instructions/{make_offer,take_offer,refund_offer,shared}.rs` | Seeds `[b"offer", maker, id.to_le_bytes()]`; `take_offer.rs:104-128` does `new_with_signer` + `transfer_checked` + `close_account` |
| Also useful [C] | `tokens/token-fundraiser/.../instructions/{checker,refund}.rs`, `tokens/pda-mint-authority/.../instructions/{create,mint}.rs`, `tokens/token-swap` (AMM with LP) | — |
| Events [C] | none here (no `emit!`) | Use `anchor/tests/events` instead |

---

## 9. solora-anchor and stocklana-baskets

**`solora-anchor/programs/solora-pyth-price`** [C]: `anchor-lang 0.26.0`, `pyth-sdk-solana 0.7.0` (legacy push oracle), clockwork (defunct)
- **Accounts:**
  - `EventConfig` PDA `["event_config", authority, pyth_feed, currency_mint]`: `{interval_seconds, next_event_start}`.
  - `Event` PDA `["event", event_config, start_time.to_le_bytes()]`: `{start_time, lock_time = start+interval, wait_period = interval, lock_price, settle_price, outcome: Undrawn|Invalid|Up|Down|Same, up_amount/down_amount: u128, up_count/down_count, price_decimals (≤4), orders_settled, fee_bps, fee_burn_bps}`. The Event PDA also holds the funds.
  - `Order` PDA `["order", event, authority]`: `{outcome, amount}`.
- **Lifecycle:**
  1. `create_event`: cranked; splits initial liquidity 50/50, schedules threads, emits `EventCreated`.
  2. `create_order`.
  3. `set_lock_price`.
  4. `settle_event`:
     - errors before `lock+wait`;
     - if more than **15 s late, sets `Invalid`** (refund);
     - requires `get_price_no_older_than(now, 30)`; a negative price means `Invalid`;
     - compares prices after decimal truncation, then emits `EventSettled`.
  5. `settle_order`: parimutuel payout, with the fee taken on earnings only.
  6. `settle_expired_event`, then `close_accounts` once `orders_settled == counts`.

**`stocklana-baskets/programs/basket-vault/src/lib.rs`** [C]: `anchor-lang 1.2.0` / `anchor-spl 1.2.0`
- Imports `token_interface::{Burn, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked}`.
- Uses `InterfaceAccount<Mint>`, `Interface<TokenInterface>`, `mint::decimals = 6, mint::token_program = token_program` (~l.1009), and `token::token_program = token_program`.
- Transfers with `transfer_checked(CpiContext::new(token_program.key(), …), amt, mint.decimals)`.
- PDA signing: `CpiContext::new(..).with_signer(&[&[b"basket", creator, basket_id.to_le_bytes(), &[bump]]])`.
- Jupiter CPI via `invoke_signed` (`JUP6Lkb…`); `MAX_CONSTITUENTS = 10`.
- No hard-coded xStock mints: constituent mints are stored and checked against config.

[I] xStocks are Token-2022 while USDC is classic SPL Token. A single `token_program` field can't serve both, so use a separate `Interface<TokenInterface>` account per mint. Watch the xStocks scaled-UI-amount extension when displaying balances.

---

## Adopt / adapt / avoid

**Adopt**
- The `#[session_auth_or]` + `#[derive(Accounts, Session)]` + `Option<Account<SessionTokenV2>>` pattern, with the session key as a bounded SPL `approve` delegate. Your Grant PDA can enforce the cap on top.
- `kit/nextjs`'s plugin client (`walletSigner` + `solanaRpc` + `ClientProvider` + `kit-plugin-wallet/react` hooks), combined with `nextjs-anchor`'s `codama.json` and `setup` script.
- `token_interface` with `InterfaceAccount`/`Interface` + `transfer_checked` + `CpiContext::new(program.key(), …).with_signer(seeds)` (see stocklana-baskets and program-examples escrow).
- `#[event_cpi]`/`emit_cpi!` (`anchor/tests/events`), and `InitSpace` instead of hand-written `LEN`.
- LiteSVM Rust tests (the template's `tests.rs`) and Surfpool.
- The Pyth receiver builder flow (`addPostPriceUpdates` → `addPriceConsumerInstructions`, `closeUpdateAccounts:true`).
- From Solora: a window keyed by `start_time`, a strict settle window that falls back to `Invalid`/refund, and `orders_settled` counters for safe closing.
- The Actions `actions.json` + `OPTIONS` + `createActionHeaders` handler shape.

**Adapt**
- **binary-prediction engine:** track aggregate reserved liability in the LP reserve; put window/market into the Bet seeds; settle on a price with `publish_time` in `[window_end, window_end+grace]`, using `Account<PriceUpdateV2>` plus a `feed_id` check.
- **Switchboard's rebuild-and-hash-the-feed pattern,** if you use a keeper or custom stock feed. Parse without the `anchor` feature, or pick a version compatible with Anchor 1.x [I].
- **Kora `kora({…})` plugin:** `allowed_programs = [stocklana, token, token-2022, ATA, compute budget]`, `require_one_of_programs = [stocklana]`, and every fee-payer policy flag off.
- **Actions POST:** produce base64 wire transactions with kit instead of web3.js `createPostResponse`.
- **Anchor version:** choose 1.1.2 or 1.2.0 based on what `session-keys` and `ephemeral-rollups-sdk` resolve to.

**Avoid**
- binary-prediction's per-bet-only solvency and its settle-at-current-price.
- Deterministic XOR-derived session keypairs (session-keys `App.tsx`), and burner keys in localStorage.
- `try_deserialize_unchecked` on oracle accounts whose address isn't pinned.
- web3.js v1 / `@coral-xyz/anchor` clients, Clockwork, `pyth-sdk-solana` push feeds, Switchboard legacy `PullFeedAccountData` examples, and Anchor 0.26–0.31 code.
- `[registry]` in `Anchor.toml`.
- Parimutuel pools, if the house LP is the design.
