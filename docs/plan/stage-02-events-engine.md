# S2 — `agari-events` engine (parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, with a Codama client and targeted money tests. Plan: `00-plan.md` §7.2 S2, §3.0–3.4, §8.

**Branch:** `stage/S2-events-engine` in worktree `../agari-wt/s2`. Merges to `main` at step boundaries that keep `main` gate-green (the spec is docs-only).

**D-number range:** D-006…D-009 (S1 holds D-010…D-019 while both stages run).

## Steps

- [x] Spec, frozen at the end of the step: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md` (D-006…D-009)
- [x] Workspace, common grid, seeds (start from `docs/plan/spikes/d002/`; pin `solana-program` 3.0.0)
- [x] State accounts; `Book` as keypair + `#[account(zero)]`; `Ledger` PDA
- [x] Admin instructions incl. `admin_add_policy_version` + `roller_open_window` (PROGRAM seats, version coverage check) (D-019)
- [x] Prints: Pyth (receiver feature decided against a real devnet post), RedStone (threshold 5 inside `strict_sec`; measure tx bytes + CU for 5 packages), attested, `public_copy_open_from_prev`, cross-check prints + settle rules + void reasons (D-021, D-027)
- [x] Matching: four paths, Normal/IOC/FOK/PostOnly, self-match, `max_fills`, eager eviction with `max_evictions`, credit-first funding, PostOnly-after-expiry-skip, remainder cancel at fill cap, `placed_slot` (D-020)
- [x] Cancel, reduce, cancel-all, sweep-expired (D-020)
- [x] Complete sets; withdraw credit
- [x] Settle (cross-check), void, redeem/redeem_for, release book, close ledger + mvault (donation-safe), close market + result after retention (D-021, D-022)
- [x] `book_walk` + TS mirror + vectors
- [x] Targeted tests (P§8 engine list) + randomized operation-sequence harness + deadline race tests per source
- [x] CU profile (Surfpool `profileTransaction`; 10-fill IOC within budget; record)
- [x] Codegen (D-025)
- [x] Devnet deploy + `init-events` (D-024, D-026)
- [x] Surfpool drive (time travel): open → mint-pair → print (Pyth + RedStone check) → settle → redeem; plus a divergence void and a missing-print void (D-027)
- [x] The same drive on devnet in market hours with real Pyth trial (TSLA) and RedStone (NVDA) prints, plus one attested print on a test series (D-027; RedStone ran as the TSLA check, NVDA voided unprinted)

## Gate

`NO_DNA=1 anchor build` · `cargo test -p agari-events` · codegen diff clean · Surfpool drive passes · `acceptance.md` devnet signatures (window opened, direct fill, mint-pair fill, burn-pair fill, Pyth trial print, RedStone 5-signer print, cross-check settle, attested print, settle, redeem, void) · account sizes, rent and CU recorded (including RedStone print CU and transaction bytes).

**Rows:** resolves `C:05` §6 Q1 (market primitive); enables L-29…L-34.

**Gate passed 2026-09-14 15:35Z** (acceptance.md). The rebuilt `.so` equals the deployed bytes. Tests: 52 native, 32 common, 34 LiteSVM. Codegen is clean, and the fast + web gates pass. Both drives and every listed devnet signature are recorded.
- **Parity:** no rows advance; S2 owns none, and L-29…L-34 advance when S4/S6 build their UI.
- **Main:** this branch contains S1 (7203d64), so it merges to `main` after S1's gate (the user's Phantom check).

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

- **Matching (S2.7).** The core is pure (`matching::Venue`, D-020).
  - Native tests pass: all eight §2.2 worked examples to the base unit (including `mvault = locked + backing` after the mint and payouts summing to `mvault` under Up and void), one test per fill row, and the edges.
  - The randomized harness runs 12 seeds × 2,500 operations with the §8.3 invariants checked after every one: 30,000 ops, ≈ 10,000 refused, ≈ 3,300 fills.
  - Mutation check: a one-base-unit refund error and a missed `open_orders` decrement were each caught within 60 operations.
  - `book/walk.rs` implements `WalkLevel`/`WalkNode` for the engine's `Level`/`OrderNode` (`walk_bids`/`walk_asks`); a native test walks a Book built by `place`, including the expiry and rested-age filters.
- **Cancels (S2.8).** `user_cancel_orders` (≤ 16 handles; stale skipped, another seat's live handle `NotOrderOwner`), `user_reduce_order` (in place, priority kept), `user_cancel_all` (scan ≤ `max_scan`, ≤ 32 removed) and `public_sweep_expired` (expired only, or everything at or after `lock_at` or once terminal; nothing to do is a success) work in every status and mode (D-009). All four share `matching::evict::remove_node`, the one refund rule. The cancel family and the sweep take `series` for the cash unit (D-020).
- **Sets and cash (S2.9).** `user_mint_complete_set` (Normal mode, Trading; claims a seat, pulls `lots × 1000 × cu` + bond credit-first), `user_merge_complete_set` (Trading, any mode; credit back, optional withdraw) and `user_withdraw_credit` (any status or mode; `0 < amount ≤ credit`) move `backing_lots` exactly. Every payout goes only to a token account owned by the signing authority (`WrongTokenOwner` otherwise, AD-5).
- **LiteSVM (S2.7–S2.9, `anchor/tests/events_orders.rs`, 8 tests).** Real token movements and `PlaceResult` return data for example 3 (mint pair, `mvault` = 7,720,000 + 2 bonds); an IOC with no fill reverts its evictions on chain and the sweep then refunds them; refusal codes 6100/6106/6108/6109/6111/6119/6305; credit and cancel refunds pay only the owner's token account; reduce, cancel-all and the post-lock sweep; exact mint/merge; Halted and ReduceOnly block buys and mints but never cancel or withdraw.
- **Compute and size (LiteSVM, legacy tx, 1 signer, no compute-budget ix):** resting Normal order 16,218 CU / 544 B; **10-fill IOC 29,781 CU / 544 B** (plan budget 60–90k); cancel 9,648 CU / 400 B; mint complete set 13,628 CU / 487 B. `.so` 494,888 B with 15 instructions. The Surfpool `profileTransaction` pass (CU profile box) is still to do.
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

- **Redeem (S2.12, D-022).** `user_redeem` and `public_redeem_for`, with the money core pure in `matching/redeem.rs`.
  - Native: example 8 pays to the base unit under Up (A 7,970,000 / D 250,000), Down (3,970,000 / 4,250,000) and void (5,970,000 / 2,250,000) with a 250,000 bond; Σ == mvault. The post-settlement randomized run (12 seeds × 1,500 trading ops, then a drain, a random outcome and every seat redeemed in random order, some PROGRAM partials first) redeemed 72 seats and paid 9,143,962 base units with the mvault model equal to what is still owed after every redeem and exactly 0 at the end. A planted one-unit overpayment failed all four tests.
  - LiteSVM (`events_redeem.rs`, 3 tests): the same three outcomes with real tokens plus a product's partial redeem on PROGRAM seat 5 (the mvault ends at 0); refusals `MarketNotTerminal`, `OpenOrdersRemain`, `InvalidOrderArgs`, `PartialRedeemNotAllowed`, `SeatMismatch` (another's seat, and a second redeem); a crank pays A only to A's ATA (a non-ATA account → `WrongTokenOwner`, a PROGRAM seat → `ProgramSeatNotPublic`) with the ATA created in the same transaction.
  - **Cost (LiteSVM, legacy tx, 1 signer):** `user_redeem` full 13,936 CU / 480 B; partial 13,644 CU / 489 B; create ATA + `public_redeem_for` 28,988 CU / 584 B.

- **Closure (S2.13, D-022).** `public_release_book`, `public_close_ledger`, `public_close_market`, `product_add_dependent`/`product_release_dependent`, `public_grow_ledger`. The IDL now has 29 instructions and 20 events; `.so` 726,056 B.
  - LiteSVM (`events_closure.rs`, 4 tests):
    - **Ledger close:** refused before terminal, with unredeemed seats (`LedgerNotEmpty`), with the wrong rent payer (`LedgerMarketMismatch`) or treasury (`WrongTokenOwner`). A 123,456 donation to the mvault changes no payout, goes to the treasury at close, and the Ledger and mvault rent returns exactly to the roller's payer.
    - **Market close:** a product dependent registers (a stranger can't: `NotProgramAuthority`); release refused while trading (`MarketNotLocked`) and with orders (`OpenOrdersRemain`); close refused without the release (`BookNotReleased`), the ledger close (`LedgerNotClosed`), with dependents (`DependentsRemain`), one second early (`RetentionNotElapsed`) and with swapped payers. A second dependent release → `MathOverflow`. After everything, Market and MarketResult close to their own payers with exact lamport deltas, and a product claiming afterwards finds no MarketResult (PD-7).
    - **Recycling:** the released Book binds Window 1 with `generation + 1`, a new order reuses node 0 with a larger seq, and A's old handle is skipped.
    - **Growth:** `+117` and `+0` → `BadGrowAmount`; `+116` × 8 reaches 1,024 and `+1` more is refused; the payer funds exactly the rent delta; seat 1,000 is claimable by hint; growth after `lock_at` → `MarketNotTrading`.
  - **Cost (LiteSVM, legacy tx, 1 signer):** release book 5,326 CU / 310 B; close ledger 14,081 CU / 475 B; close market 9,125 CU / 376 B; grow +116 9,710 CU / 346 B.
  - **Rent returned:** LiteSVM charges the mainnet default of 6,960 lamports per byte, not devnet's measured 5,080. Measured: Ledger (96 seats) + mvault 62,452,080; Market 4,064,640 + MarketResult 2,672,640; +116 seats 71,047,680. Each equals `(bytes + 128) × 6,960`, i.e. `events-accounts.md` §3's devnet figures (44,094,400 + 1,488,440; 2,966,720 + 1,950,720; 51,856,640) at 6,960.

- **Devnet deploy (2026-09-14, D-024).**
  - **Program:** `agari-events` `cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH` (program data `2sSGMUci…qnzeD`, authority = deployer, slot 498,252,588), from `36f1384`, built for SBPF v0. The on-chain bytes equal the tested binary (764,200 B, sha256 `310e14d7…c44309`); rent 3.883 SOL.
  - **Attempts:**
    1. v3 binary, refused locally.
    2. v0 upload via Helius `--use-rpc`: the buffer `9GZyxo…rftw` was created, then writes stopped at "Max retries exceeded".
    3. Resumed into that buffer (keypair derived from its recovery phrase and matched to the address, then deleted), sending to validators directly: done in 17 s.
  - **Balance:** deployer 10 → 6.112 SOL.
  - **Still open in the deploy step:** `init-events` (config, tUSDC mint, TSLA/NVDA series, books), IDL publish, codegen.

- **Codegen (S2 codegen, D-025).** `pnpm codegen` renders `@agari/clients/agari-events` from the checked-in `packages/clients/agari-events/idl.json`: 29 instruction builders, 6 account decoders, 21 events, 5 PDAs, the 85 errors. Program sources are unchanged since the deployed `36f1384`, so the IDL matches the chain.
- **init-events + IDL (2026-09-14, D-026).**
  - **Devnet venue:** config `42GFppq2…`, tUSDC `5i61C4kH…`, treasury `ChRVcHdm…`; TSLA-5m `FK9jirQB…` (v1 Pyth + RedStone check, v2 RedStone) and NVDA-5m `HC5DZDHn…` (v1 RedStone), each with 2 × 512-node Books. Everything is in `scripts/deploy/addresses.devnet.json`.
  - **Cost:** init 1.183 SOL (a devnet Book is 290,047,680 lamports) and the IDL 0.0569 SOL. Deployer 4.872 SOL left.
  - **Measured:** config init + authorities 15,534 CU / **1,090 B** (the largest; fixed-size arrays, so it never grows); TSLA register + 2 versions 19,791 CU / 664 B; NVDA register + 1 version 12,777 CU / 516 B; Book create + add 4,879 CU / 474 B.
  - The on-chain IDL equals `packages/clients/agari-events/idl.json`. No deploy or metadata buffers remain.
  - A Surfpool devnet fork ran the whole script first (mainnet rent 1.621 SOL). The re-run was a no-op, and planted drifts were refused with field diffs.
- **Surfpool drive (2026-09-14, D-027).** `pnpm drive:events --cluster localnet` ran on a Surfpool devnet fork with real 14:30/14:35Z prices, 41 transactions, all green:
  - **TSLA window:**
    - Pyth trial open 358.31339 / close 358.98500; RedStone checks from 5 signers 358.32860904 / 359.02901824 (724 B payloads), so cross-checked → **Up**.
    - Fills on real tokens: mint pair (A BUY_YES 10,000 @ 620 × D BUY_NO 4,000 @ 600 IOC), direct YES (D 1,000 @ 710 vs A's ask @ 700), burn pair (D SELL_NO 1,000 @ 720 vs the same ask).
    - After sweep + redeem: A **7,370,000**, D **1,550,000**, each equal to the seat-derived expectation. The mvault went 8,920,000 → 0.
  - **TEST window (Series 900):** attested prints (361.91 / 362.62, 1% high) were checked by the same RedStone packages → **void `CrossCheckDivergence`**; 750,000 each (500,000 + bond) and the mvault → 0.
  - **NVDA window:** a resting bid and no prints; the clock jumped to `T + 902` → **void `MissingPrint`**; 750,000 refunded, mvault → 0.
  - **Bugs the drive found and fixed:** `ANY_SEAT` from a seated authority (`SeatMismatch`), and a Book stranded on an aborted run's Window (now `recycleBooks`).
- **Devnet drive (2026-09-14 14:37–15:00Z, D-027).** `pnpm drive:events --cluster devnet` ran the same cycle on devnet: 40 transactions, all confirmed, one row each in acceptance.md. It covers every devnet item on the gate list.
  - **TSLA:** Window opened; mint-pair, direct YES and burn-pair fills; Pyth trial prints 358.20432 / 358.75; RedStone 5-signer checks 358.18500933 / 358.78391019; cross-check settle → Up; redeems 7,370,000 + 1,550,000 = mvault.
  - **TEST (Series 900):** attested prints; void `CrossCheckDivergence`; 750,000 × 2.
  - **NVDA:** void `MissingPrint` at `T + 909`; 750,000.
  - **Measured on devnet** (with the Kit planner's compute-budget instruction):

    | Transaction | CU | Bytes |
    |---|---|---|
    | `roller_open_window` | 31,616–46,607 | 683 |
    | RedStone 5-package print | **149,097** | **1,082** (of 1,232) |
    | Pyth record | 6,953 | 353 |
    | Attested pair | 9,366 | 720 |
    | Place order, resting | 14,063–16,415 | 682 |
    | Mint-pair IOC | 17,754 | 682 |
    | Direct IOC | 17,614 | 682 |
    | Burn IOC | 15,522 | 682 |
    | Settle | 12,486 | 386 |
    | Divergence void | 15,353 | 386 |
    | `public_void_expired` | 14,478 | 386 |
    | Sweep | 3,334–6,918 | 386 |
    | Redeem | 14,104–14,142 | 618 |
    | Pyth VAA verify (receiver SDK) | 84,592 | 766 |
    | Pyth `post_update` | 31,823 | 830 |

  - **Cost:** payer 0.3915 SOL (Series 900 + Book 0.2352). The three Windows' Market/Ledger/mvault rent is refundable through the closure instructions. Deployer 4.481 SOL left.
- **Prints box closed (2026-09-14):**
  - **Real RedStone fixture:** `redstone-tsla-1789396800.{json,hex}` (the 14:40Z devnet boundary) verifies in `agari-common` against the D-002 production signers. `cargo test -p agari-common --all-features --lib redstone` runs 8 tests, all green. The print tests need `--all-features` (the oracle crates are feature-gated); without it the filter silently runs 0.
  - **Devnet evidence** (acceptance.md): a real Pyth trial post to `rec5EK…` + `public_record_print_pyth` (the receiver choice holds on devnet itself, not just a fork), and the RedStone 5-signer print at 149,097 CU / 1,082 B.
- **CU profile (2026-09-14).** `pnpm drive:events --cluster localnet --phases profile` on a fresh Surfpool devnet fork: 10 makers rest `BUY_NO 1,000 @ 500…509` on TSLA-5m Window #2, then one `BUY_YES 10,000 @ 600 IOC` (max_fills 16) is profiled with `surfnet_profileTransaction` and sent.
  - **Result:** **29,938 CU, 642 B** for **10 fills** (the Market's `trade_count` +10), a third of the plan's 60–90k budget. It agrees with LiteSVM (29,888 CU).
  - **Surfpool 1.5.0 quirk:** `surfnet_profileTransaction` takes `[tx]` or `[tx, tag: string]`. The documented config object as the second parameter is refused ("expected a string").
  - The devnet table above covers every other instruction the drives send.
- **P§8 engine list, audited against the code (2026-09-14).** Every S2-scope item has a named test:
  - **Fill paths and exact cash:** `matching/tests/paths.rs` (8) plus examples 1–4.
  - **Order behaviour:**
    - Eviction credit and PostOnly over an expired top: example 7.
    - IOC zero-fill revert: `edges.rs` and LiteSVM `an_ioc_that_fills_nothing…`.
    - Remainder cancelled at the fill cap: example 6 and `skip_cap…`.
  - **Prints, all sources:** wrong source, first print wins, unknown version, the roller's coverage check, append-only versions (`events_admin`, `events_prints`).
  - **Pyth:** uniqueness window, feed, Partial, owner 3007, confidence, the real blob only at its own T.
  - **RedStone:** the real golden (new, 14:40Z production signers); timestamp, unknown or malleated signer, duplicate refused (D-007); 3/4 inside strict then after; tamper; wrong feed.
  - **Attested:** offsets attacks and the cutoff.
  - **Cross-check:** pending, single-source, divergence void, and copy-open across versions. **New:** copy-open carries the check close only inside the check window (`copy_open_carries_the_check_close_only_inside_the_check_window`); until now no test used a version with a check.
  - **Settlement and closure:** redeem 1/0 and void ½; a stale handle on a recycled book; donation-safe close; retention and dependents; ledger growth; bond refund; a full ledger refuses by name.
  - **Randomized sequences:** `random.rs`, two runs with the §8.3 conservation checked after every operation.
  - **PD-6 races:** per source at `T + 900`, the Gap open at `lock_at`, and the check bound (`events_settle`).
- **Not in S2:** Switchboard (S6), PD-2 cross-slot manipulation and product claims after close (S10), indexer (S3), sponsor (S7).
- **One accepted exception (D-021):** the attested `CpiNotAllowed` refusal needs a calling program. Add it in S10, when product programs make CPI calls.

## Handoff

- **Next (after both drives, D-027):**
  - **S2 gate:** every box is ticked. Run the gate list, record it, and advance `parity.md` (C:05 §6 Q1; enables L-29…L-34). The merge to `main` waits for S1's gate, because this branch contains S1.
  - **S10 note:** add the attested CPI-refusal test once a product program can CPI.
  - **Closure on devnet:** the three drive Windows still hold Market/Ledger/mvault rent. A settler pass (`public_release_book` for TSLA/TEST/NVDA; the drive recycles Books before opening, not after), then `public_close_ledger`, and `public_close_market` after 6 h, reclaims it. It belongs to the S3 settler; run it by hand only if SOL gets tight.
  - **Re-running the drive:** `set -a; source ../../stocklana/.env.local; set +a; pnpm exec tsx scripts/drive/events-cycle.ts --cluster devnet | sed "s/$HELIUS_API_KEY/<redacted>/g"` (PYTH_API_KEY and HELIUS_API_KEY live in the main worktree's `.env.local`). It must run in NYSE hours; the Pyth trial covers TSLA until the 09-25 close.
- **Earlier next (after init-events, D-026, done):**
  - **Surfpool drive** (`scripts/drive/events-cycle.ts`, through `@agari/markets/deploy`): start `surfpool start --network devnet --no-deploy --no-tui` from a directory without `Anchor.toml` and fund the deployer with `-k ~/.config/agari/devnet/deployer.json`. The fork now reads the real devnet config, Series and Books, so the drive uses `addresses.devnet.json` and funds only the roller, relay and user keys. Don't run `init-events --cluster localnet` against a fresh fork: the forked config carries cluster tag 103, which is drift against localnet's 104.
    - Flow: open a TSLA or NVDA Window (`roller_open_window`, policy version by prints.md §2.3), mint tUSDC to two users (faucet authority), mint-pair fill, record prints, settle, redeem. Then a divergence void and a missing-print void.
    - Time travel: Surfpool `surfnet_timeTravel`.
    - Prints: the TSLA Pyth fixture is at 2026-09-11 20:00Z, and version v1 covers it. RedStone packages need the archive: check `data/archive/redstone/` has TSLA/NVDA from the 09-14 session.
  - **Targeted-tests and CU-profile boxes** are still open (below).
  - `init-events` must be re-run (it's idempotent) after any `price-sources.json` version append. It fails loudly on edits to existing versions.
- **Next steps after redeem and closure (done, D-022):**
  - **Targeted-tests box:** check the P§8 engine list against what exists (native: worked examples, fill matrix, edges, two randomized runs; LiteSVM: admin, orders, prints, settle, redeem, closure; PD-6 races per source). Add only what is missing.
  - **CU profile box:** the Surfpool `profileTransaction` pass (the LiteSVM numbers in Findings are the baseline).
  - **Codegen** (2d): Codama client for the 29 instructions; Book nodes and Ledger seats still decoded by hand.
  - **Devnet deploy + `init-events`** (needs the deployer funded), then the Surfpool and devnet drives, which now have every instruction they need.
  - **Not built:** `user_release_seat` (§4.4; closure doesn't need it, D-022).
  - **Harness for redeem/closure:** `anchor/tests/src/settlement.rs` `Traded::new()` (example 3 on an attested 5m Window + a product on PROGRAM seat 5, `key(40)`), `resolve(Outcome::{Up,Down,Void})`, `sweep()`, `crank_send`, and builders `redeem_ix`, `redeem_for_ix`, `crank_redeem_ixs` (ATA + redeem), `release_book_ix`, `close_ledger_ix`, `close_market_ix`, `dependent_ix`, `grow_ledger_ix`.
- **Earlier next step (done):** settle (cross-check), void, redeem/redeem_for, release book, close ledger + mvault, close market + result (lane P's settle/void merge first).
  - **Harness** (`anchor/tests`, own `Cargo.lock`, litesvm 0.16.0; D-019). Run `NO_DNA=1 anchor build` first, then `cargo test --manifest-path anchor/tests/Cargo.toml`.
    - Admin/roller: `Harness::new()`, `setup_config`, `register_series`, `add_policy`, `add_book`, `open_window`, `warp_to`, `fresh_key`, `create_token_account`; `send`/`ok` → `Sent { compute_units, tx_bytes }` or the custom code; readers `config_state`, `series_state`, `market_state`, `book_state`, `ledger_state`, `token_account`.
    - Trading (`tests/src/trade.rs`, S2.7–S2.9): `trading_window()` (NVDA 5m RedStone Window 0, clock 10 s into trading, seat bond 250,000), `funded_user(tusdc)` → `(key, token account)`, `place(&w, &user, &token, order_args(..))` → `(PlaceResult, Sent)`, `send_returning`, `token_amount`, and builders `place_order_ix`, `cancel_orders_ix`, `cancel_all_ix`, `reduce_ix`, `sweep_ix`, `mint_set_ix`, `merge_set_ix`, `withdraw_credit_ix`.
  - **Reuse for redeem and close:**
    - Payouts out of `mvault` go through `instructions::venue_io::TokenMove::pay` with `MarketSigner::of(&market)` (Market PDA seeds); pulls through `TokenMove::pull`. Bindings: `venue_io::{bind_market, bind_tokens}`.
    - Seats: `matching::seats::{owned_seat, sweep_credit}`, `Seat::is_drained`, `SEAT_FLAG_BONDED` + `ledger.seat_bond` for the bond refund. `public_redeem_for` pays `seat.owner`'s ATA, so it needs its own token check (address == ATA of `(seat.owner, collateral_mint)`), not `bind_tokens` (which requires owner == signer).
    - Orders must be gone before redeem: `matching::orders::sweep_expired(venue, max, drain_all = terminal || now ≥ lock_at)`.
    - Book and Ledger slices: `state::{book_parts_mut, ledger_parts_mut}` on `try_borrow_mut_data()`; build a `matching::Venue` for anything that touches both.
  - **Randomized harness** (`matching/tests/random.rs`): add redeem and close ops once they exist, and keep checking §8.3 (and the post-settlement form) after every op.
  - Anchor account validation (signer, owner/type, `init`, `#[account(zero)]`) runs before handler checks; tests assert the spec's handler codes (D-019).
  - The IDL lists Book/Ledger/Market/Series/GlobalConfig; Codama still decodes Book nodes and Ledger seats by hand (`events-accounts.md` §3.8–3.9, 2d).
  - A fresh worktree's cold `anchor build` takes ≈ 10.5 min; a first `cargo test` in `anchor/tests` ≈ 1.5 min. A wiped `~/.cache/solana` makes the next `anchor build` re-download platform-tools v1.57 (anchor-cli 1.2.0's default); a wiped `target/deploy` needs `~/.config/agari/programs/agari-events.json` copied back as `agari_events-keypair.json` (anchor otherwise generates a mismatching key).
- **Book walks over the engine (done S2.7):** `agari_events::book::{walk_bids, walk_asks}(&book, nodes)` give `agari_common::book_walk::BookSide` over the real Book. Regenerate vectors with `node anchor/tests/vectors/gen-book-vectors.mjs` whenever walk semantics change.
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
