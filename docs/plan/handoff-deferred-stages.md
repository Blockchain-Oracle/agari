# Handoff — finishing the deferred stages (S8–S12, S14)

Written 2026-09-19 for a fresh session. The user's instruction: **nothing in the app should say "not live"; finish what we started.**

Read `CLAUDE.md` first, then `docs/plan/STATUS.md`. This file only covers the deferred work.

## What is actually missing

Every deferred feature already has its pricing logic in `packages/core` (with tests) and its screens in `web/src/features`. What none of them has is **an on-chain program and the write path to it**. `anchor/programs/` holds exactly two: `agari-events` and `agari-vault`.

| Stage | Feature | Program needed | Core | Markets | Web | Ops |
|---|---|---|---|---|---|---|
| S8 | Earn (maker vault) | `agari-maker` | 4 files, 1 test | 1 | `features/earn` 9 | `MAKER_MODE=vault` mode missing |
| S9 | Agents / strategies | `agari-strategy` | 11 files, 2 tests | 4 | 47 | `strategy-runner` stub |
| S10a | Parlay | `agari-parlay` | 5, 1 test | 1 | 17 | — |
| S10b | Range + Moonshot | `agari-range` | 10, 2 tests | 4 | 20 | — |
| S10c | Boost / leverage | `agari-leverage` | 5, 1 test | 1 | 6 | `leverage-keeper` stub |
| S10d | Private desk | `agari-private` | 4, 1 test | 2 | 17 | — |
| S11 | Trade from X + Blinks | none (off-chain) | — | — | `features/x` | `x-relay` stub |
| S12 | Games | arena program (12b) | 34, 16 tests | 3 | 32 | `game-room`, `duel-settler` stubs |

So the remaining work per feature is: **write the Anchor program → wire the `packages/markets` writes → wire/finish the ops actor → gate it on devnet → tick parity**. The hardest design work (pricing vectors, UI) is already done and tested.

## Be honest about the size

This is six or seven new Solana programs. The original plan gave each of them a whole stage for a reason. The deadline is **Fri 2026-09-25 20:00 UTC** and the user's standing rule is that *the deadline never justifies a compromise or a half-built thing*. Those two facts do not both fit.

So do not promise all of it. Recommended order, highest value per unit of risk first:

1. **S11 — Trade from X + Blinks.** No new program at all; it is an off-chain relay plus a Blinks endpoint over the existing `agari-events`. Blocked only on the user's X API keys (`Q-008`, B-3). Cheapest real win.
2. **S12a — Games (off-chain and ticket-lane).** 34 core files and 16 tests already exist; Lucky/Practice/arcade ride the existing Window lane. Only 12b (arena) needs a program — leave 12b out.
3. **S10b — Range + Moonshot.** The most core logic already written and vectored (10 files, 2 tests).
4. **S8 — Earn / maker vault.** The ops maker already exists in `seat` mode; `vault` mode plus `agari-maker` is a contained addition, and `/earn` is a strong judge-facing page.
5. **S9, S10a, S10c, S10d** — only if the ones above are genuinely finished and gated.

**The alternative the user should be offered explicitly:** for anything that will not be finished properly, take it out of the nav rather than ship a page that advertises a feature the venue does not have. An app with fewer, working things beats one with many "coming soon" plates. That is the user's call, not ours — ask.

## Hard rules that apply to every one of these

- `anchor/programs/*` is money code. **S2's gate is hard for money** (`00-plan.md` §7): no financial program ships without the randomized-sequence, deadline-race and failure-surface tests the engine has. Do not skip this to hit a date.
- Only `packages/markets` imports `@solana/*` and sends transactions. `packages/core` stays pure. Integer money only, no floats.
- Files ≤ 400 lines. pnpm only. One commit per step with `Stage:` / `Parity:` trailers.
- Every devnet transaction gets a row in `docs/plan/acceptance.md`, verified with `getSignatureStatuses` before it is written.
- Each new surface gets a `/dev` fixture page (D-081).
- Gate: `pnpm typecheck && pnpm invariants`, then `pnpm exec vitest run` (1,463 tests green as of this handoff), then `NO_DNA=1 anchor build`.

## Live infrastructure you must not break

- **The soak runs from a pinned worktree**, `/Users/abu/dev/hackathon/agari-wt/live` at tag `soak-7`, supervised by its own gitignored `data/soak/run.sh`. Never edit code there; move it with `git checkout --detach soak-N`.
- **A cutover is deliberately held.** D-098 (fatal actor start failure), D-099 (quote probe while a token lane is halted) and D-105's `/prestocks/latest` `move` field are built and gated in `integration/w1` but **not deployed**, because Switchboard's quote gateway has been answering 500 since 10:35Z. Restarting ops during that outage clears the in-process halt streaks, the roller reopens xStock Windows and they void on missing prints. **Re-probe before any cutover** (`fetchTokenQuote` on `TSLAX/USD`, `minOracles` 3, queue `EYiAmGSd…`); cut over only when it succeeds. Moving the `live` pin also arms an accidental cutover at the next unplanned ops exit, so the pin and the ops restart move together.
- `:3000` serves the `live` build, `:3018` serves `s18`, dev runs on `:3005` from `w1`. Never `pnpm build` in `w1` for `:3000`.
- A detached `caffeinate -ims` keeps the Mac awake; without it the machine sleeps on battery and every actor looks like it crashed (see `ops-watchdog-fires-on-slow-network`). Before blaming the network for a stall: `pmset -g log | grep -E ' (Sleep|Wake)  '`.

## Bookkeeping that is genuinely behind

Worth an hour and visible to judges, because `docs/plan/parity.md` is named in the submission checklist as execution-quality evidence:

- **`parity.md`: 92 rows, only 16 past `Pending`.** The features are built and their routes answer 200; the ledger was never advanced. Reconcile it against what actually ships.
- **Stage checkboxes are stale** for S5 (0/13) and S13 (0/16) although the work exists — e.g. S5 lists `scripts/drive/traders.ts` and S13 lists `web/src/lib/finnhub.server.ts`, both of which are in the tree and working.

## Repository

<https://github.com/Blockchain-Oracle/agari> — private (`Q-007`), MIT, default branch `integration/w1` (the trunk, 527 commits). `main` is pushed but stays gated on the S1 Phantom check and the S3 gate. Push with `git push origin integration/w1`.

## Explicitly parked by the user (2026-09-19)

Demo video, app domain, the S16 deploy go, and the Monday Phantom check. Do not spend time on them.
