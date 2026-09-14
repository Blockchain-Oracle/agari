# S2 — `agari-events` engine (parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, with a Codama client and targeted money tests. Plan: `00-plan.md` §7.2 S2, §3.0–3.4, §8.

**Branch:** `stage/S2-events-engine` in worktree `../agari-wt/s2`. Merges to `main` at step boundaries that keep `main` gate-green (the spec is docs-only).

**D-number range:** D-006…D-009 (S1 holds D-010…D-019 while both stages run).

## Steps

- [ ] Spec, frozen at the end of the step: `docs/plan/specs/events-engine.md` (+ split files if needed) and `docs/plan/specs/prints.md`
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

- Nothing yet.

## Handoff

- Nothing yet.
