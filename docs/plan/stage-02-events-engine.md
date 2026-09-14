# S2 — `agari-events` engine (parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, with a Codama client and targeted money tests. Plan: `00-plan.md` §7.2 S2, §3.0–3.4, §8.

**Branch:** `stage/S2-events-engine` in worktree `../agari-wt/s2`. Merges to `main` at step boundaries that keep `main` gate-green (the spec is docs-only).

**D-number range:** D-006…D-009 (S1 holds D-010…D-019 while both stages run).

## Steps

- [x] Spec, frozen at the end of the step: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md` (D-006…D-009)
- [ ] Workspace, common grid, seeds (start from `docs/plan/spikes/d002/`; pin `solana-program` 3.0.0)
- [ ] State accounts; `Book` as keypair + `#[account(zero)]`; `Ledger` PDA
- [ ] Admin instructions incl. `admin_add_policy_version` + `roller_open_window` (PROGRAM seats, version coverage check)
- [ ] Prints: Pyth (receiver feature decided against a real devnet post), RedStone (threshold 5 inside `strict_sec`; measure tx bytes + CU for 5 packages), attested, `public_copy_open_from_prev`, cross-check prints + settle rules + void reasons
- [ ] Matching: four paths, Normal/IOC/FOK/PostOnly, self-match, `max_fills`, eager eviction with `max_evictions`, credit-first funding, PostOnly-after-expiry-skip, remainder cancel at fill cap, `placed_slot`
- [ ] Cancel, reduce, cancel-all, sweep-expired
- [ ] Complete sets; withdraw credit
- [ ] Settle (cross-check), void, redeem/redeem_for, release book, close ledger + mvault (donation-safe), close market + result after retention
- [ ] `book_walk` + TS mirror + vectors
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
- **Size estimate.** A RedStone 5-package print transaction is ≈ 1,080 B of 1,232, so no ALT is needed (to be measured).

## Handoff

- **Next step:** workspace, common grid, seeds.
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
