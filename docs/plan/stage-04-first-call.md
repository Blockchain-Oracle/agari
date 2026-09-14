# S4 — First end-to-end call on devnet (M1)

**Goal:** a person with a Wallet Standard wallet (Phantom) takes a real call on devnet.
1. `/markets` signed out → Tutorial.
2. Connect → Get test funds (SOL top-up + tUSDC).
3. The ticket quotes off the live Book → a wallet-paid IOC fill → The Call share card.
4. Verdict at expiry → Claim (or "Paid automatically") → Portfolio rows update.

Also: journal recovery, Reels on the same stream, honest closed and paused states.

- **Plan:** `00-plan.md` §5, §7.2 S4.
- **Contract:** `docs/plan/specs/first-call.md`.
- **Wallets:** Privy is gone (D-023). The seam is `WalletSession = { address, signer: TransactionSigner, signMessage }`, fees are the wallet's own devnet SOL, and the sponsor co-sign is S7.

**Branch:** `stage/S4-first-call` in worktree `../agari-wt/s4`, cut from `stage/S3-venue-ops`. Lanes `slice/S4{a,b,c,d}-*` in `../agari-wt/s4{a,b,c,d}` merge into the stage branch in the order 4a.1 → 4a → 4b → 4c → 4d (spec §7). Nothing merges to `main` before S1's Phantom check and the S2/S3 gates.

**D-number range:** D-031…D-040.

## Steps

- [x] Foundation (stage owner, D-031…D-035):
  - `first-call.md` contract (D-031).
  - Context7: Kit 8.3 `sendAndConfirmTransactionFactory`, compute-unit estimate (adds `@solana-program/compute-budget` if needed), `@solana/wallet-account-signer` features.
  - `IntentRecord.lastValidBlockHeight?` port addition (D-entry).
  - Ops `GET /session`.
  - The three invariants re-pointed (`optional: true`).
  - `sol-faucet` role key created and funded.
  - `web/.env.local` vars (Handoff).
- [x] Runtime + boot facts (4a.1, merged first as `17e61a6`; 69 runtime vitests incl. every Book vector and a captured devnet Book): browser/server transport, `runtime/accounts.ts`, Book decode, pure mappers, venue, collateral, clock.
- [ ] Provider reads over chain + `/api/index/[...path]` (4a).
- [ ] Hooks, names unchanged: coordinator Book subscriptions, shared spot stream, `useStakeQuote` over the coordinated Book (4a).
- [ ] Submitter order lane: status gate → quote → expiry → funding → build (IOC) → simulate → journal → sign → send → confirm → book from `OrderExecuted` (4b).
- [ ] Tx lane `redeem` (full redeem per Window, crank-paid reconcile) + journal reconcile by signature and `lastValidBlockHeight` (4b).
- [ ] Signer seams: Wallet Standard signer (modify-and-sign, sending fallback) + keypair signer; no Privy (4b).
- [x] Faucet: SOL top-up chain adapter + server-side tUSDC mint claims, one challenge signature (4c, merged `b4aef58`; devnet claims wait for `sol-faucet` SOL).
- [ ] Sponsor → S7 (D-023): `/api/sponsor` unchanged; gate row restated (stage owner D-entry).
- [ ] Web rewiring: ticker picker, market-session chip, closed/paused/settling copy, verdict print-source labels, per-Window claims, seat-deposit note (4d).
- [ ] Drive `scripts/drive/first-call.ts` on devnet: faucet → IOC up fill → ops settle → redeem or crank → `verify-index` (4b, finished by the stage owner).
- [ ] Browser pass at 390/768/1440 in both themes: signed-out, first-run, unfunded, quote moved (requote), fill, nothing filled, unknown send (kill the tab mid-send), win/loss/void, claim and crank-paid, closed, paused.
- [ ] Tag `m1-first-call`.

## Gate

- **Full gate:** `pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0`. The three re-pointed invariants find their files.
- **Drive:** `scripts/drive/first-call.ts` passes on devnet.
- **Manual end-to-end:** a fresh Phantom (Wallet Standard) wallet on devnet during NYSE hours (replaces "fresh-Privy", D-023).
- **Acceptance rows (`acceptance.md`):**
  - faucet SOL top-up;
  - tUSDC mint;
  - **wallet-paid IOC fill: fee payer = the user's wallet, SOL from the faucet top-up.** Replaces "sponsored fill (fee payer = sponsor)"; sponsored fills move to S7 (D-023; D-entry proposed in spec §4);
  - ops settle;
  - claim (`user_redeem`, or the settler's `redeem_for` if it paid first; both are recorded).
- **Journal recovery shown:** a send killed mid-flight reconciles by signature on reopen, and nothing is resent.
- **Then:** run S16 once.

**Rows:** L-04, L-08, L-09, L-10, L-22, L-24, L-25, L-26, L-29…L-34; Partial L-44, L-46.

## Findings

- **Lane 4c (faucet, merged `b4aef58` from `slice/S4c-faucet` @ 54f92c8), proven on a Surfpool fork with the real route handlers and adapter:**
  - **One signature, both assets:** the challenge covers SOL and 10,000 tUSDC. The SOL top-up sent 20,000,000 lamports. tUSDC: 10,000,000,000 base units minted with fee payer `sol-faucet`, 10,000 lamports fee, `[createIdempotent, mintToChecked]`.
  - **Quotas:** a bad signature gets 403; replaying the same id returns the same signature; cooldown 429 for both assets; the 11th tUSDC claim per connection gets 429.
  - **Recovery:** a lost ack reconciles to confirmed without a re-broadcast; a process killed before send re-sends identical bytes once; a never-sent claim past its last valid block height goes to `reverted` with the quota kept.
  - **Tests:** funding vitests 25/25; the Postgres script 6/6 (16 concurrent tUSDC claims mint once).
  - **UI:** Masayume's funding components are unchanged apart from copy. The flow ran end to end with a scripted Wallet Standard wallet: one `signMessage`, zero transaction signatures.
  - **Env:** `SOL_FAUCET_ENABLED` now accepts `1` (the old code needed `true`).
  - **Local quota:** outside Vercel every local claim shares the connection bucket `local-development` (10 per day per asset), so clear `tusdc_faucet_claims`/`sol_faucet_claims` rows when testing repeatedly.
  - **Postgres script:** accepts `FAUCET_TEST_DATABASE_URL` (loopback).

## Handoff

- **Lanes** (spec §7):
  - **4a reads:** web on port 3001; read-only devnet.
  - **4b writes:** Surfpool 8960/8961.
  - **4c faucet:** Surfpool 8970/8971, DB `agari_s4c`.
  - **4d surfaces:** web on port 3004.
  - Lanes report back; only the stage owner edits manifests, the lockfile, `packages/core/src/ports/**`, `packages/markets/src/{env,index}.ts`, `web/src/providers/**`, `web/src/lib/env.ts`, `services/ops/**`, `scripts/invariants/**`, `web/.env.local` and `docs/plan/**`.
- **Local env:**
  - `web/.env.local` is a symlink to `/Users/abu/dev/hackathon/stocklana/web/.env.local`, shared by every worktree.
  - `reference/` exists only in the main checkout.
  - Presence as of 2026-09-14:

    | Variable | State | Action |
    |---|---|---|
    | `DATABASE_URL` | set, and equals the soak indexer DB `postgres://abu@localhost:5432/agari` | lanes read it, never write it; 4c overrides with `agari_s4c` in its shell |
    | `HELIUS_API_KEY` | set | server-only; the browser must not use it |
    | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | set | dead since D-023; the stage owner removes them |
    | `NEXT_PUBLIC_SOLANA_CLUSTER`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_WS_URL` | absent | defaults are devnet + public devnet, which is the S4 decision; leave unset |
    | `NEXT_PUBLIC_AGARI_VENUE_ID` | absent | set from `scripts/deploy/addresses.devnet.json` `venue.config` |
    | `NEXT_PUBLIC_AGARI_EVENTS_PROGRAM_ID` | absent | set from `programs.agari_events` |
    | `NEXT_PUBLIC_AGARI_INDEXER_URL` | absent | set `http://localhost:3000/api/index` (absolute: `packages/markets/src/env.ts:22`; lanes on another port use theirs) |
    | `NEXT_PUBLIC_PRICE_FEED_URL` | absent | set `http://localhost:8787` (ops base) |
    | `SOL_FAUCET_ENABLED`, `SOL_FAUCET_PRIVATE_KEY`, `FAUCET_MINT_AUTHORITY_PRIVATE_KEY` | absent (web and root) | the stage owner sets them from `~/.config/agari/devnet/{sol-faucet,faucet-mint-authority}.json`; never print them |
    | `SOL_FAUCET_RPC_URL` | absent | defaults to public devnet |

- **Web dev against devnet:**
  - `pnpm --filter web exec next dev -p <lane port>` in the lane worktree.
  - Chain reads go to public devnet from the browser; `/api/index/*` reads the soak's Postgres; spot and session come from ops on `:8787`.
- **Live soak (from `../agari-wt/s3`):**
  - `curl -s localhost:8787/health` (actors, roller lane states, indexer lag); `curl -s localhost:8787/prices/latest`; SSE at `localhost:8787/prices/stream`.
  - Index DB: `psql postgres://abu@localhost:5432/agari` (`idx_*` tables).
  - At 19:39Z on 09-14: 36 live Markets, the seed maker quoting TSLA/NVDA/AAPL 5m and 15m, indexer lag ≈ 2 s, 301 Windows opened and 265 resolved, **but only 4 fills (all from the S2 drive)**. S4 makes the first taker fills.
  - Regular Windows exist only 13:30–20:00Z on session days. Off-hours, write proofs use a Surfpool fork with a drive-opened Window (D-027 pattern).
- **Surfpool:** `NO_DNA=1 surfpool start --network devnet --no-deploy --no-tui -p <port> -w <ws>` from a directory without `Anchor.toml`. Fund keys with `-k ~/.config/agari/devnet/<role>.json`. A fork reads devnet's config, Series, Books and live maker quotes lazily (D-027).
- **Spec §8 answered at the foundation (the recommended defaults):** server-sent tUSDC mint (D-034); public devnet browser RPC (D-035); settler 300 s claim grace, live in the soak (D-032, `13121f8`).
- **Env set at the foundation:** `NEXT_PUBLIC_SOLANA_CLUSTER`, `NEXT_PUBLIC_AGARI_VENUE_ID`, `NEXT_PUBLIC_AGARI_EVENTS_PROGRAM_ID`, `NEXT_PUBLIC_AGARI_INDEXER_URL` (`http://localhost:3000/api/index`; a lane on another port overrides it in its shell), `NEXT_PUBLIC_PRICE_FEED_URL` (`http://localhost:8787`), `SOL_FAUCET_ENABLED=1`. Faucet keys come from the role files (spec §4). `sol-faucet` = `HL3ZUNsPqWpeNJwi2JgjVuLSHit2jW8ymMz3kVENYveC` (unfunded until the user sends devnet SOL).
- **Ops:** `GET localhost:8787/session` → `{ nowSec, status, label, calendar: { fromDate, toDate, unknownDates, upcoming }, lanes }` once the soak restarts on this code.
