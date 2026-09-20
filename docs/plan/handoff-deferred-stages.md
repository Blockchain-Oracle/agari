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

## Scope: all of it, in full (the user, restated 2026-09-20, D-113)

An earlier version of this section said the remaining programs "do not both fit" with the deadline, recommended an order "by value per unit of risk", and told the session to offer the user the option of taking unfinished pages out of the nav. **That advice is withdrawn.** The user's standing rule is that the deadline is never a reason for anything and is never to be raised: no cut, no hidden page, no thinner version, no "which ones should we drop". Following the old text is what made a session recommend hiding Private desk and the Duel arena on 2026-09-20, and the user's answer was unambiguous.

Every deferred feature gets built in full, with the full money gate, to the same quality as the rest. Done so far: S11 Blinks, S10b Range + Moonshot, S8 Earn, S10a Parlay, S9 agents and strategies. **Remaining, all to be built: S10c Boost (`agari-leverage` + the `leverage-keeper` actor), S10d Private desk (`agari-private`), S12b Duel arena (the arena program + `game-room` and `duel-settler`), and S12a's off-chain games where they still run on stubs.** Order them by dependency, not by what "fits": Boost first because its toggle sits on the main ticket, then Private desk, then the arena. Start the next one without asking.

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
