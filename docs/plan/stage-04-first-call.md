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
- [x] Provider reads over chain + `/api/index/[...path]` (4a, merged `34729da`; live-session browser proof at the 09-15 open).
- [x] Hooks, names unchanged: coordinator Book subscriptions, shared spot stream, `useStakeQuote` over the coordinated Book (4a).
- [x] Submitter order lane: status gate → quote → expiry → funding → build (IOC) → simulate → journal → sign → send → confirm → book from `OrderExecuted` (4b).
- [x] Tx lane `redeem` (full redeem per Window, crank-paid reconcile) + journal reconcile by signature and `lastValidBlockHeight` (4b).
- [x] Signer seams: Wallet Standard signer (modify-and-sign, sending fallback) + keypair signer; no Privy (4b).
- [x] Faucet: SOL top-up chain adapter + server-side tUSDC mint claims, one challenge signature (4c, merged `b4aef58`; devnet claims wait for `sol-faucet` SOL).
- [ ] Sponsor → S7 (D-023): `/api/sponsor` unchanged; gate row restated (stage owner D-entry).
- [x] Web rewiring: ticker picker, market-session chip, closed/paused/settling copy, verdict print-source labels, per-Window claims, seat-deposit note (4d, merged `09753ec`; full gate incl. `pnpm build` green, 198 vitests).
- [x] Masayume fidelity audit + shared chrome fixes, incl. the centered connect modal (4e, merged through `80342e6`; D-036). Data-gated rows re-checked at the 09-15 open.
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

- **Lane 4e final (merged `80c4b0d`):**
  - `f20b374`: Connect renders on the first paint; "restoring" only for a remembered wallet.
  - `7949b0b`: stock prices whole dollars from $1,000 up, cents below, in share cards, Sensei and takes.
  - Audit update C-26/P-11 (committed by the stage owner after 4e stopped on a network error).
  - Full gate after the merge: typecheck, invariants, 198 vitests, build.
- **Devnet faucet evidence (09-15 05:15Z)** through the running app on :3010: SOL top-up `5WpKEWoP…` (20,000,000 lamports) and tUSDC mint `23Ge127U…` (10,000 tUSDC, fee payer `sol-faucet`), one challenge signature, no wallet transaction (acceptance.md). The very first `GET /api/faucet` after the dev server started answered `configured: false`, then `ready: true` for both assets on the next call. Watch for this on a cold start (likely a lazy module/key load).
- **Indexer URL:** `NEXT_PUBLIC_AGARI_INDEXER_URL=/api/index` (same-origin path, `fefedf6`) after the user hit a cross-origin `indexer-down` running the app on another port.
- **Lane 4e (audit, merged through `80342e6`):**
  - **Audit:** 36 findings in `docs/plan/audits/ui-fidelity-2026-09-14.md`.
    - **By severity:** S1 5, S2 11, S3 9, S4 11.
    - **By owner:** 4e 10 (all fixed), 4d 3, 4a/SO 6, later stages 15.
  - **Already identical:** `styles/**` (59 files), `app/layout.tsx`, `components/ui/**`, fonts and the query client are byte-identical to Masayume. The header, pill nav, drawer, Sensei drawer and how-it-works match at 390/768/1440 apart from data and words.
  - **What caused the drift the user saw:**
    1. Data surfaces empty before 4a.
    2. The connect sheet (shadcn Sheet, `bg-popover` #404040 in dark), now a pixel-matched RainbowKit compact modal (368 px panel, blurred scrim, 350 ms overshoot, phone bottom sheet).
    3. Leftover Masayume/Somnia copy.
  - **Performance:**
    - Query client, persisted cache, lazy chart and fonts match Masayume.
    - `/markets` loads 34 JS files / 1,952 KB decoded vs Masayume's 58 / 3,492 KB. Agari's empty state skipped the ≈ 160 KB chart chunk, so the real gap is smaller.
    - P-04/P-05 are resolved on stage by 4a.
    - Endpoint failover (`health.ts`) → S16.
  - **Open, data-gated (09-15 open):**
    - `/markets` with no live Window should keep Masayume's hero + ticket-rail layout (4d).
    - `/reels` empty card.
    - `?note=moved` in populated lanes.
    - The account modal's SOL balance read (4a/SO).
- **Lane 4e (partial merge `68129f6` @ 3787560) + `dd74b14`:**
  - **Merged:** the audit doc `docs/plan/audits/ui-fidelity-2026-09-14.md`; Masayume's RainbowKit connect and account modals over Wallet Standard (replacing the right-side sheet the user saw); shell and copy fixes.
  - **Connected ticket button:** now opens the account modal (`session.openAccount`).
  - **Browser check (lane 4d, two fresh Chrome contexts, no wallet extension):** header and portfolio Connect are visible from first paint at 1440 and 390, with no hydration badge. `/dev/wallet` Connect opens the new modal. The ticket button is checked at the 09-15 open (no live Windows off-hours).
- **Lane 4d (markets surfaces, merged `09753ec` from `slice/S4d-surfaces` @ fc9b093):**
  - **Session chip:** reads ops `/session` once a minute, shared (hero + lanes header; hidden in the 390 hero to keep Masayume's phone layout).
  - **Closed / paused:** closed copy on hero, lanes, word board, between-rounds and reels. A paused ticker gets Yosuku's between-rounds card with "Paused: no signed price source".
  - **Ticker picker:** Masayume's leaderboard asset tabs; `agari.ticker`; the rail pages by eight.
  - **Verdict:** "RedStone price at 10:35:00 ET" (+ single source); settling copy covers the 5–17 s close print and the 2-minute check.
  - **Claims:** one per Window with "Paid automatically" + crank signature.
  - **Ticket:** seat-deposit footnote; nothingFilled copy. Masayume's ticket has no Max chip (+1/+5/+20), so the bond headroom sits in the over-balance check.
  - **Fidelity fix:** prices showed 8 decimals / whole dollars (the oracle scale changed from cents to 10⁻⁸), so the hero axis read "252.20000000" and headlines "needs +$0". Now whole dollars from $1,000 up, cents below, axis at 2 dp.
  - **Comparison:** masayume.app side by side with local fixture data, computed styles of every node in hero, ticket, market card, lane tabs, section header and word card at 1440 dark and 390 light. Remaining differences are intended: stock monograms, the chip, 3 cadences instead of 5, data-driven states.
  - **Still differs:**
    - Range / 2×–3× leverage / Public–Private stay disabled until their programs deploy.
    - "All" on the word board shows ≈ 26 questions with nine tickers.
  - **Follow-ups:**
    - **Blocking, 4e:** the Kit wallet plugin never leaves `pending` in fresh Chrome contexts, so Connect stays invisible, plus a Header hydration mismatch. Also queued after `openAccount`: `ConnectButton` → `session.openAccount`.
    - The seat bond comes from `SeriesFacts.seatBond`, not a launch-grid constant (`ticket/seat-deposit.ts`).
    - A provider `getRedemption` should replace the web fetch of `/wallet/:w/actions`.
    - `features/share/trade-card.ts` and `features/sensei/units.ts` still round stock prices to whole dollars.
- **Lane 4b (writes, merged `76382c9` from `slice/S4b-writes` @ 504783b)**: the three re-pointed invariants find their files and pass; 115 vitests after the merge.
  - **Fork proofs** (Surfpool 8960, the drive passed 4 runs in a row on TEST-ATT-5m #3–#6):
    - **Up IOC:** 3,194 lots @ 400, cost 1,277,600 = the quote; wallet paid cost + 250,000 bond; 17,708 CU / 586 B.
    - **Down IOC:** no second bond.
    - **Simulation 6110:** requote with nothing sent; the accepted requote filled.
    - **Landed 6110** (send without preflight after the book emptied): `nothingFilled`, seat and tUSDC untouched.
    - **SIGKILL after journaling the signature:** reconciled as landed, 0 re-sends, fill counted once.
    - **Redeem:** paid 4,445,000 = the seat (lots + bond); 14,141 CU / 522 B.
    - **Crank-paid:** the rival's redeem returned the settler's `redeem_for` signature without sending.
  - **Kit / wallets:**
    - Kit 8.3's `setTransactionMessageComputeUnitLimit` suffices; `@solana-program/compute-budget` is unused and can be removed.
    - A wallet that replaces the blockhash makes Kit report `lastValidBlockHeight = u64::MAX`, so the lane journals head + 150 as the bound.
    - `submitter/events.ts` is a small browser-safe decoder, because `ops/**` is server-only. Sharing one decoder with the indexer is a later cleanup.
  - **Cost-cap buffer (open, needs the user):** Masayume's 5m buffer (15,661 bps) sizes lots at the padded price, so a 2 tUSDC stake at 400 spent 64% of the stake. Proposed: a small Solana buffer (D-entry after the user's answer).
  - **Drive:** `scripts/drive/first-call*.ts` (4 files); the devnet path is written but unrun, and needs NYSE hours and a funded `sol-faucet`.
  - **Not proven:** preflight-refusal requote, 6115 rebuild, unsigned-intent reconcile through the index, sending-only wallets and 4001 rejection (the last two need a real wallet in the browser pass).
- **Lane 4a (reads, merged `34729da` from `slice/S4a-reads` @ 98cfe72); 113 markets+funding vitests after the merge:**
  - **Provider methods:** every method ran in Node against devnet, the soak index and ops (20:45–21:10Z, off-hours):
    - `syncClock` (offset −510 ms); `loadCollateral` tUSDC 6 dp; `resolveVenueId`.
    - Settled lists with winners and print sources; `getResolution`/`getOnchain` (Resolved, and a closed drive Market read as Voided).
    - `getOpeningPrice`; `getPriceHistory` (28 NVDA points); released Books read empty.
    - Wallet history/holdings/balance sheet/claimables for the drive and maker wallets.
  - **Browser:** `/markets` shows the honest "No live Windows"; four `useAssetPrice` share one EventSource.
  - **RPC:**
    - Measured: production build, signed out, off-hours, 3 RPC in 102 s + 7 index requests + 1 SSE.
    - Computed for a live session: ≈ 13–17 RPC/min signed out, ≈ 33/min signed in (budget ≤ 60).
    - Book coordinator: 3 Books = 3 `getMultipleAccounts`, then websocket only.
  - **Cache:** Masayume's TanStack keys, staleTimes and invalidation, unchanged.
    - Index GETs are shared in flight and for 1 s. Account reads in one event-loop turn batch into one `getMultipleAccounts`.
    - Series/config/ATAs are cached for life; mode is cached ≤ 15 s.
    - Hidden tabs drop Book sockets after 30 s and the spot stream after 60 s.
  - **Additive / naming:**
    - Collateral decimals come from `GlobalConfig.collateral_decimals`.
    - Additive `SeriesFacts.policySources` and `BookState.generation/orderCount`.
    - `VenueSource` keeps `inferred` (the spec's `derived` would need the `/status` copy to change; cosmetic, left).
  - **Book notifications:** ≈ 76 KB base64 per change. `base64+zstd` would need a decoder dependency; not taken in S4.
  - **Build-time env:** `NEXT_PUBLIC_AGARI_INDEXER_URL` is baked at build time (set per port for `next build`).
  - **Not seen live (session closed):** 9-ticker lanes, maker quotes in live Books, UI opening prints, live stake quotes, in-session RPC/min. Proof at the 09-15 13:30Z open.
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
