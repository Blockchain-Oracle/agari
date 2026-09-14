# S2 — `agari-events` engine (parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, with a Codama client and targeted money tests. Plan: `00-plan.md` §7.2 S2, §3.0–3.4, §8.

**Branch:** `stage/S2-events-engine` in worktree `../agari-wt/s2`. Merges to `main` at step boundaries that keep `main` gate-green (the spec is docs-only).

**D-number range:** D-006…D-009 (S1 holds D-010…D-019 while both stages run).

## Steps

- [x] Spec, frozen at the end of the step: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md` (D-006…D-009)
- [x] Workspace, common grid, seeds (start from `docs/plan/spikes/d002/`; pin `solana-program` 3.0.0)
- [x] State accounts; `Book` as keypair + `#[account(zero)]`; `Ledger` PDA
- [x] Admin instructions incl. `admin_add_policy_version` + `roller_open_window` (PROGRAM seats, version coverage check) (D-019)
- [ ] Prints: Pyth (receiver feature decided against a real devnet post), RedStone (threshold 5 inside `strict_sec`; measure tx bytes + CU for 5 packages), attested, `public_copy_open_from_prev`, cross-check prints + settle rules + void reasons
- [ ] Matching: four paths, Normal/IOC/FOK/PostOnly, self-match, `max_fills`, eager eviction with `max_evictions`, credit-first funding, PostOnly-after-expiry-skip, remainder cancel at fill cap, `placed_slot`
- [ ] Cancel, reduce, cancel-all, sweep-expired
- [ ] Complete sets; withdraw credit
- [ ] Settle (cross-check), void, redeem/redeem_for, release book, close ledger + mvault (donation-safe), close market + result after retention
- [x] `book_walk` + TS mirror + vectors
- [ ] Targeted tests (P§8 engine list) + randomized operation-sequence harness + deadline race tests per source
- [ ] CU profile (Surfpool `profileTransaction`; 10-fill IOC within budget; record)
- [ ] Codegen
- [ ] Devnet deploy + `init-events` (needs the deployer funded: see STATUS blockers)
- [ ] Surfpool drive (time travel): open → mint-pair → print (Pyth + RedStone check) → settle → redeem; plus a divergence void and a missing-print void
- [ ] The same drive on devnet in market hours with real Pyth trial (TSLA) and RedStone (NVDA) prints, plus one attested print on a test series

## Gate

`NO_DNA=1 anchor build` · `cargo test -p agari-events` · codegen diff clean · Surfpool drive passes · `acceptance.md` devnet signatures (window opened, direct fill, mint-pair fill, burn-pair fill, Pyth trial print, RedStone 5-signer print, cross-check settle, attested print, settle, redeem, void) · account sizes, rent and CU recorded (including RedStone print CU and transaction bytes).

**Rows:** resolves `C:05` §6 Q1 (market primitive); enables L-29…L-34.

## Findings

- **Spec split.** Four files: semantics (`events-engine.md`), layouts/errors/events (`events-accounts.md`), per-instruction checks (`events-instructions.md`), prints (`prints.md`). All engine accounts are zero-copy; every layout was computed by script with explicit padding.
- **Plan corrections (D-006).**
  - Ledger realloc is capped at 10,240 B per instruction, so growth is **≤ 116 seats per call**, not 150.
  - A 1,024-seat Ledger is **0.459 SOL**, not 0.39.
  - Market 456 B, MarketResult 256 B; per-Window churn 0.00492 SOL.
- **RedStone SDK facts (D-007).** A repeated signer is an error, not a skip; unknown signers, failed recoveries and zero values are skipped silently; SDK errors carry raw codes (509…, 1000+i). Calling `process_payload` with `threshold = N posted packages` gives an exact signer count and forces every posted package to verify.
- **DreamDEX self-match (D-008).** CancelTaker **reverts** `SelfMatchCancelTaker` per DreamDEX docs, overriding C:08 #10.
- **Return data** is cleared before every CPI, so `set_return_data(PlaceResult)` must run after `emit_cpi!` and the transfers.
- **Trial blob grounding.** Pyth equities use expo −5, conf ≈ 1.6 bps (TSLA), `prev_publish_time == T − 1`.
- **S2.2 workspace (2026-09-14):**
  - Program id `cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH`; keypair ensure-created at `~/.config/agari/programs/agari-events.json` and copied to gitignored `anchor/target/deploy/`.
  - Resolved: anchor-lang/anchor-spl 1.2.0, bytemuck 1.25.2 (`derive`, `min_const_generics`, required because `#[account(zero_copy)]` derives `::bytemuck::Pod` from the program crate), pyth-solana-receiver-sdk 2.0.0, redstone rev `05e3c9f` (both behind `agari-common` features), borsh 1.8.1; `solana-program` pinned 3.0.0 (the only version in `Cargo.lock`).
  - **Explicit error discriminants work in Anchor 1.2:** `anchor-syn` parses `Variant = N` and adds `ERROR_CODE_OFFSET`. The IDL lists 85 errors: InvalidMode 6000, NotProgramAuthority 6021, MarketNotTrading 6100, InvalidOrderArgs 6120, WrongPrintSource 6200, BadPrintSlot 6233, InsufficientCredit 6300, BadGrowAmount 6307.
  - `agari-common` stays engine-type-agnostic: `view::load_checked<T: Pod + Discriminator>` (owner → length → discriminator → alignment), `load_slice_checked`, and key-only binding checks. Products get engine types from `agari-events` with the `cpi` feature.
  - Cold `anchor build` ≈ 10.5 min in a fresh worktree (IDL host build included); `.so` 51,568 B with no instructions yet.
- **S2.3 state (2026-09-14):**
  - `state/{config,series,policy,market,result,book,ledger,enums,view}.rs` match `events-accounts.md` §3 byte for byte.
  - `layout_tests.rs` asserts every struct size and every field offset in the spec tables, the account bytes and rent (config 856 / 4,998,720; series 1,368; market 456; result 256; ledger 96 → 8,552 and 1,024 → 90,216; +116 seats = 10,208 B, +117 exceeds 10,240; book 256 → 44,680 and 512 → 56,968), plus the checked splitters. **All matched the spec on the first run; no D-019 needed.**
  - `bytemuck` `min_const_generics` makes `[Level; 1000]` `Pod`; no by-value copies (Book and Ledger are only reached through `book_parts_mut`/`ledger_parts_mut` over borrowed data).
  - Enums are `#[repr(u8)]` with `TryFrom<u8>`; `MarketStatus` is derived, never stored.
  - `program_autofixer`: no issues on step 1 and state sources.
- **Size estimate.** A RedStone 5-package print transaction is ≈ 1,080 B of 1,232, so no ALT is needed (to be measured).
- **S2.4 admin + roller (2026-09-14):**
  - Instructions: `admin_init_config`, `admin_set_authorities`, `admin_set_mode`, `admin_register_series`, `admin_add_book`, `admin_add_policy_version`, `roller_open_window`. `lib.rs` is dispatch only; handlers in `instructions/{admin_init_config,admin_set_authorities,admin_series,roller_open_window}.rs`, pure rules in `instructions/{policy_rules,window_rules}.rs` (unit-tested), Borsh args in `instructions/args.rs`.
  - **`roller_open_window`: 31,385 CU, 641 transaction bytes** (LiteSVM 0.16, 13 accounts, 2 signers). `.so` 347,656 B.
  - IDL: 7 instructions; zero-copy accounts Book, GlobalConfig, Ledger, Market, Series; 7 events; 85 errors.
  - Tests: 15 program unit tests (policy validation, window rules incl. the D-003 split, authority rules, layouts) + 6 LiteSVM integration tests, all green: upgrade-authority init (`NotAdmin`), admin-only mode/authorities and `InvalidMode`, append-only validated versions (`PolicyVersionImmutable`, `UnknownPolicyVersion`, `BadPolicy` ×3), highest-covering version (Fri 19:55→20:00Z on v1, the 09-25 Gap on v2 only with `open_deadline = lock_at`, QQQ after 20:00Z → `SourceNotCovered`), PROGRAM seats 0/3 + bound Book (`generation 1`, free list emptied, `NoFreeBook`, second Book binds), `NotRoller` / partial 60 m and off-clock `BadAlignment` / Gap span `BadHorizon` / ReduceOnly `InvalidMode`.
  - `program_autofixer`: no issues.

- **Pure print verifiers (S2.5)** in `agari-common::print::{pyth, redstone, attested, median, normalize}` pass 21 targeted tests: the real archived Pyth trial update (TSLA 2026-09-11 16:00:00 ET accepts T, refuses T ± 1 s, a wrong feed, partial verification and a 1 bp cap), synthetic 5-key RedStone packages through the SDK's real recovery path (strict window, threshold after strict, duplicate → refused, unknown/malleated → below N, timestamp/feed/value exactness, malformed payloads refused before crypto), and the attested 158 B golden plus every offsets attack. **Remaining for the Prints box:** the instruction handlers (§4.0 slot/deadline rules, sysvar loading), the real RedStone fixture (`anchor/tests/vectors/prints/README.md`), the Pyth receiver-feature devnet post, and CU/transaction-size measurement.

- **Book walks (S2.6).** `agari-common::book_walk` (`levels`, `top_of_book`, `outcome_levels`, `vwap_over_depth`, `exit_walk`, `quote_stake`) and `packages/core/src/market/book-math.ts` agree on 49 shared vectors (`anchor/tests/vectors/book.vectors.json`: 9 hand-checked cases asserted by the generator, 40 seeded random books). Walks follow FIFO node refs, jump between bitmap bits, and stop after `nodes.len()` steps on a corrupt or cyclic level. The crate stays engine-free: walks are generic over `WalkLevel`/`WalkNode`.

- **S2 lane P prints + settle (2026-09-14):**
  - **Instructions:** `public_record_print_{pyth,redstone,attested}`, `public_copy_open_from_prev`, `public_settle_window`, `public_void_expired`. Handlers live in `instructions/{record_print_sources,copy_open_from_prev,resolve_window}.rs`; the shared §4.0 rules are in `print_rules.rs`, and the pure settle/void decisions in `resolve_rules.rs` (4 unit tests).
  - IDL: 13 instructions, `MarketResult` account, `PrintRecorded`/`WindowResolved` events. `.so` 493,632 B.
  - **Pyth receiver decided (D-021):** both devnet receivers verify the archived trial update Full on a Surfpool devnet fork; the default feature `rec5EK…` is kept.
  - **Cost:**
    - RedStone, 5 packages: **148,365 CU / 1,040 B**, no ALT and no compute-limit instruction needed.
    - RedStone, 3 packages: 93,226 CU / 796 B.
    - Attested: 9,181 CU / 678 B.
  - **LiteSVM tests, 12 new, all green:**
    - **Pyth:** real fixture at T; T − 1 / T + 1 refused; wrong receiver owner 3007; check slot without check → `WrongPrintSource`; second print → `PrintAlreadyRecorded`.
    - **RedStone:** 4 of 5 inside strict refused; 5 ok; 3 refused at `close + 299`, ok at `+300`.
    - **Attested:** early (`PrintTooEarly`), unknown attestor, no ed25519, signature over another price, offsets attack, ok.
    - **Copy-open:** before the previous close → `PrintsMissing`; self → `PrintNotAdjacent`; time gap → `PrintNotAdjacent`; copy; second copy → `PrintAlreadyRecorded`; past the open deadline → `PrintTooLate`; across a version switch → `PrintNotAdjacent`.
    - **Settle:** `CrossCheckPending` at `close + 120`, single-source at `+121` with the full `MarketResult`; a present diverging check with the other missing → void `CrossCheckDivergence`; agreeing checks settle at once; tie → Up; lower close → Down.
    - **PD-6 races** at `deadline` and `deadline + 1`: intraday Pyth, attested and RedStone (T + 900), the Gap open (`lock_at`), and the check bound (close + 120 against single-source settlement).
  - `program_autofixer`: no issues.
  - **Prints box not ticked:** the devnet evidence (a real Pyth trial post and a RedStone 5-signer print in `acceptance.md`) and the real archived RedStone fixture remain; `data/archive/redstone/` was still empty at 08:22Z, before the 13:30Z open.

## Handoff

- **Next step:** matching (four paths, order types, self-match, caps, eviction, funding) on the harness.
  - **Harness** (`anchor/tests`, isolated workspace + own `Cargo.lock`, litesvm 0.16.0; D-019). Run `NO_DNA=1 anchor build` first, then `cargo test --manifest-path anchor/tests/Cargo.toml`.
    - `Harness::new()` deploys agari-events **upgradeable** (authority = `admin` key 1), funds `admin`/`roller` (key 2)/`stranger` (key 3), creates the 6-dp mint and a treasury.
    - Flows: `setup_config(fixtures::authorities())`, `register_series(fixtures::series_args(ticker, cadence, basis))`, `add_policy(series, index, version)`, `add_book(series, 256|512)`, `open_window(series, book, fixtures::regular_window(..) | gap_window_0925(..))`, `warp_to(unix_ts)`, `fresh_key()`, `create_token_account(..)`.
    - `send(ixs, signers)` → `Ok(Sent { compute_units, tx_bytes })` or `Err(custom_code)` (panics with logs on a non-custom failure); `ok(..)` expects success.
    - Readers: `config_state`, `series_state`, `market_state`, `book_state`, `ledger_state` (header + seats), `token_account`; `ix::window_accounts(series, index)`.
    - Fixtures: D-003 timestamps (`FRI_1950`, `CLOSE_0925`, `GAP_LOCK_0927`, `OPEN_0928`), `tsla_v1/v2`, `qqq_v1`, `gap_version`, PROGRAM seats at 0 and 3.
  - Matching adds book/ledger slice helpers: reach Book nodes and Ledger seats through `state::{book_parts_mut, ledger_parts_mut}` on `try_borrow_mut_data()` (the discriminator is written, so those checks pass after listing), never `AccountLoader::load_mut` for slices. Add `user_place_order` builders and mint/fund helpers (`spl_token::instruction::mint_to` from the admin mint authority) to the harness.
  - Anchor account validation (signer, owner/type, `init`, `#[account(zero)]`) runs before handler checks; tests assert the spec's handler codes, not Anchor's (D-019).
  - The IDL now lists Book/Ledger/Market/Series/GlobalConfig as accounts; Codama still decodes Book nodes and Ledger seats by hand from `events-accounts.md` §3.8–3.9 (2d).
  - A fresh worktree's cold `anchor build` takes ≈ 10.5 min; a first `cargo test` in `anchor/tests` ≈ 1.5 min.
- **Engine must add** (state/book.rs, a few lines): `impl agari_common::book_walk::WalkLevel for Level { head }` and `impl WalkNode for OrderNode { lots, expire_ts, placed_slot, is_live = flags & NODE_FLAG_LIVE != 0, next }`, then build `BookSide { bits: &book.bid_bits / &book.ask_bits, levels: &book.bids / &book.asks, nodes }`. Regenerate vectors with `node anchor/tests/vectors/gen-book-vectors.mjs` whenever walk semantics change.
- **Prints handlers** convert `agari_common::print::PrintError` 1:1 into `EventsError`, build `PythPolicy`/`RedStonePolicy`/`AttestedPolicy` from the version's `PrintPolicy`, and normalize with `print::normalize::normalize`.

- **Earlier handoff (S2.1), done in S2.2/S2.3:** workspace, common grid, seeds.
  - Start from `docs/plan/spikes/d002/`.
  - Add the oracle crates, then `cargo update -p solana-program@5.0.0 --precise 3.0.0`.
  - Enable `anchor-lang` feature `event-cpi`.
  - Assert every layout in `events-accounts.md` §3 with `size_of`/`offset_of` tests.
  - Confirm Anchor 1.2 `#[error_code]` honours explicit discriminants (6000/6100/6200/6300 ranges).
- **Prints step must:**
  - decide the Pyth receiver feature by a real devnet post (`prints.md` §4.1);
  - measure RedStone 5-package CU and transaction bytes on Surfpool.
- **Fixture blocker.** `data/archive/redstone/` was **empty** at spec time (no session since the archiver started 09-13). Check it holds TSLA/NVDA packages from the 2026-09-14 session before the prints step; the Pyth fixture exists (`data/archive/pyth/2026-09-11.jsonl`).
- **Before `init-events`:** the RedStone signers in `price-sources.json` must equal the D-002 adapter list (already confirmed identical).
- **Deliberate deferrals:**
  - Switchboard verifier and instruction → S6 (rules frozen in `prints.md` §4.4).
  - Admin transfer instruction (none in the plan) → not built; raise a D-entry if needed.
  - PD-2(b) oracle-model bound → product programs (S10); the engine provides `placed_slot` + rested-only walks.
  - RedStone `TSLA` 09:30 feed semantics → S6 (Gap lane).
- **Known risk.** A RedStone **check** policy needs all 5 signers for its whole 120 s window (strict 300 s > 120 s), so one offline signer means single-source settlement (flagged), never a false void.
- **After lane P (prints + settle):**
  - **Redeem/closure** read `Market.state`/`payout_yes`/`payout_no` (set by settle/void) and require `MarketResult` to exist for `public_close_market`; the result PDA is `["result", market]` with `rent_payer` = the resolver.
  - `public_release_book` can key off `Market::status(now) ≥ Locked || is_terminal()`; a void may land before `lock_at`.
  - The print-test world (`anchor/tests/src/prints.rs` `World`) gives Series + books + Windows + real prints in a few calls; redeem tests can settle a Window with two attested prints (`attested_pair`) and then redeem.
  - **Real RedStone fixture:** add it per `anchor/tests/vectors/prints/README.md` once today's session is archived. The on-chain handler test can reuse `redstone_payload`'s wire layout with the D-002 production signers.
  - **Devnet evidence:** post a real Pyth trial update to `rec5EK…` + `public_record_print_pyth`, plus a RedStone 5-signer print, and record both in `acceptance.md` once the deployer is funded.
