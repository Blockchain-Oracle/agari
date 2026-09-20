# S13 — Social and assistant

**Goal:** Masayume's assistant and social layer runs on Solana devnet data and looks exactly like Masayume (D-036). The additive social surfaces are built in the same visual language.
1. **Sensei** knows the stock, the NYSE session, earnings and your positions. It keeps the Brake, refuses investment advice, and hands a trade card to the ticket.
2. **Takes** are signed with an ed25519 wallet signature and verified on the server. They carry cashtags and are woven into Reels.
3. **The Room** opens only for a real on-chain position (a bettors registry written from the index, the index's "ever bet", or the Ledger seat), per Window and per ticker.
4. **News, alerts and marquee:**
   - Finnhub news and earnings;
   - basis- and session-aware cents alerts;
   - a marquee that is honest off-hours, with a sentiment cell.
5. **A-3a:** profiles, follows, friends board.
6. **A-3c:** ticker hub, activity feed, lifecycle notifications that fire.

- **Plan:** `00-plan.md` §0 (Q-001…Q-003), §5, §7.2 S13.
- **Contract:** `docs/plan/specs/social-assistant.md`.
- **Fidelity:** D-036. The replica standard is masayume.app side by side at 390/768/1440 in both themes.
- **Wallets:** D-023's `WalletSession.signMessage` through `signText`. There are no transactions in S13 beyond the ticket fills used as proofs.

**Branch:** `stage/S13-social-assistant` in worktree `../agari-wt/s13`, cut from `stage/S4-first-call` @ `c5ddb60`.
- **Lanes:** `slice/S13{a-sensei,b-room-takes,c-wire,d-social}` in `../agari-wt/s13{a,b,c,d}` (web ports 3131–3134).
- **Merge order** into the stage branch: 13c.1 → 13b.1 → 13a → 13c → 13b → 13d (spec §5).
- Nothing merges to `main` before the S4 gate.
- Runs in parallel with S5 (`/leaderboard`, boards) and S6 (earnings flags, token lane); spec Q-S13-8 and Q-S13-9 cover those seams.

**D-number range:** D-071…D-080.

## Steps

- [ ] Foundation (stage owner, D-071…D-073): (open: no record of the three Context7 checks. Done: spec frozen with its defaults D-071; `schema-social.ts` wired into `SCHEMA_SQL` a7fe56f; `follows` and `idx/social-activity` exported, `take-tags` and `idx/social-gate` reached through `takes.ts` and `bettors.ts`; `LifecycleWatcher` mounted dd7866a; env presence in the Handoff table)
  - Freeze `social-assistant.md` (D-071).
  - Take the spec §6 defaults or record the user's answers (D-072). Q-S13-1 sentiment source, Q-S13-5 Web Push and Q-S13-6 Finnhub licence need the user.
  - Context7:
    - AI SDK 7 `generateText` `reasoning` on the configured `AI_MODEL`;
    - Next 16 route-handler caching (`fetch` revalidate / `unstable_cache`);
    - Finnhub `/calendar/earnings`, `/news`, `/company-news` free-tier limits.
  - `packages/db`:
    - `schema-social.ts` (empty SQL) appended to `SCHEMA_SQL`;
    - export stubs for `follows`, `take-tags`, `idx/social-gate` and `idx/social-activity` in `index.ts` / `index-store.ts`.
  - `web/src/providers/AppProviders.tsx`: mount a `LifecycleWatcher` stub (renders null) beside `AlertsWatcher`.
  - Check presence (names only): `FINNHUB_API_KEY`, `AI_MODEL` + one credential, `ROOM_TOKEN_SECRET`, `DATABASE_URL`.
  - Create the lane worktrees.
- [x] 13c.1 Finnhub client `web/src/lib/finnhub.server.ts` (spec §3.1), merged first. **(done: a3c6222)**
- [x] 13b.1 Freezes: **(done: 681f3c9; the scoped token is tested in `web/src/features/room/gate.test.ts`)**
  - `take_tags` SQL;
  - `listTakes({ limit, symbol?, authors? })`, `parseCashtags`;
  - the room id grammar and `holdsPosition(address, roomId)`;
  - scoped `mintToken`/`readToken`;
  - `TickerRoomButton`, `localFillSignatures()`.
- [x] 13a Sensei: **(done: 6dab2d9, earnings line ab3bb0a; p50 3,460 ms and p95 4,630 ms over n = 20 on a production build, D-072, fe5f032)**
  - stable prefix (ticker registry, session rule, advice line; Brake last);
  - additive request fields (session, positions, record);
  - per-turn session, positions, record and earnings lines;
  - advice tripwire;
  - rate gate.
- [x] 13b Room: **(done: 681f3c9, 9e4dc7c; `gate.server.ts` runs registry → index → seat, `api/room/bet` writes the registry only after finding the fill in the index, initials are the first two characters exactly)**
  - three-step gate (registry → index "ever bet" → Ledger seat);
  - index-verified `POST /api/room/bet`;
  - ticker rooms and the sheet switch;
  - avatar initials fix;
  - limits.
- [x] 13b Takes and Reels: cashtags into `take_tags`; `?symbol` and `?authors`; author links to `/u`; off-hours reel with takes; limits. **(done: 8fd418d; route check 2026-09-19 `GET /api/takes`: stored wallet-signed takes served with their cashtags)**
- [x] 13c News: Finnhub wire with `?symbol`; `/api/earnings`. **(done: 52eacd2; route check 2026-09-19: `GET /api/news?symbol=TSLA` returns tagged Finnhub articles, `GET :3000/api/earnings` returns the seven stocks' report dates)**
- [x] 13c Alerts: integer-cents targets with `usdLine`; `basis` field; session and staleness gate; frozen notification exports. **(done: df9eada, a3c6222)**
- [x] 13c Marquee: registry assets, `OPENS` cell off-hours, `/api/sentiment` + cell. **(done: b5912c1; "REOPENS WED 09:30 ET" seen at 390/768/1440 in `audits/s18-browser-pass-2026-09-15.md` §2)**
- [x] 13d Follows: over `game_follows`; social session token; profile `/u/[address]`; `FriendsBoard`. **(done: 2d9a92f, 93ca7ef, 8b0bbec)**
- [x] 13d Activity: index feed queries; `/activity`; ticker hub `/tickers/[symbol]`; the Explore nav item. **(done: f8b1412, a74c52e; route check 2026-09-19 `GET /api/activity/ticker/TSLA` returns indexed fills)**
- [x] 13d `LifecycleWatcher`: fill (not from this tab), settled win/loss/void, claimable, paid automatically, copied (empty until S9/S14). **(done: bee2ed4, mounted dd7866a; own-tab fills are suppressed through `localFillSignatures()`. No fired notification is on record; that is the devnet-proofs box below)**
- [ ] Friends tab mounted on `/leaderboard` together with S5 (Q-S13-8, D-entry). (open: `FriendsBoard` is mounted only on `/activity`, in `web/src/features/activity/ActivityScreen.tsx`; nothing under `web/src/features/leaderboard` names it, and no D-entry records the Q-S13-8 handoff)
- [ ] Devnet proofs in NYSE hours; every fill used gets an `acceptance.md` row: (open: `acceptance.md` has no S13 row: no signed-take and tampered-copy pair, no Room refusal then admission, no registry write, no Sensei transcript set, no fired alert or settle notification. A lane test take is stored and served by `/api/takes`)
  - signed take accepted, and tampered/stale copies refused;
  - Room refused without a position and admitted after a real fill (each gate step logged);
  - registry written from the index;
  - Sensei transcript set: live read, trade card → ticket, advice refusal, Brake, off-hours, earnings;
  - an alert fired;
  - a settle notification fired.
- [ ] Browser pass at 390/768/1440 in both themes against masayume.app: (open: no S13 pass exists under `docs/plan/audits/`. `s18-browser-pass-2026-09-15.md` §6 covers `/news`, `/reels`, `/tickers/TSLA` and the disconnected `/activity`; Sensei, Room, Takes, alerts and the profile are not covered)
  - Sensei, Room, Reels, Takes, alerts, news, marquee: exact;
  - profile, activity and ticker hub: reviewed for Masayume visual language.
  - Update the audit doc (D-036 upkeep).
- [ ] Measure: no new browser RPC per tab (first-call §1 budget); Sensei p50/p95 latency; feed query p95 on the soak DB. (open: Sensei latency is recorded, D-072, fe5f032. The RPC-per-tab check against the first-call §1 budget and the feed query p95 on the soak DB are not)

## Gate

- **Full gate:** `pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0` (programs unchanged).
- **Signed take verifies server-side:** a wallet-signed take posts. A one-byte-tampered caption and a stale signature are refused.
- **Room gated by an on-chain position:** a wallet with no position is refused (403); the same wallet is admitted after a real devnet IOC fill (acceptance row). A `$TICKER` room follows the same rule.
- **Sensei:**
  - a trade card opens the ticket with that side chosen;
  - a request for investment advice about shares or xStocks is refused with an offer of a Window read;
  - the Brake answers a tilt sequence;
  - p50 ≤ 4 s.
- **Notifications fire:** a devnet settlement of the test wallet's Window raises a toast and a system notification in an open tab, and appears in `/activity`. A crank-paid seat shows "Paid automatically".
- **Fidelity:** the D-036 browser pass above, with no unrecorded drift.

**Rows:** L-04, L-17, L-41, L-42, L-43, L-44, L-45, A-3a, A-3c.

## Findings

## Handoff

- **Lanes** (spec §5):

  | Lane | Worktree | Web port | Notes |
  |---|---|---|---|
  | 13a Sensei | `../agari-wt/s13a` | 3131 | Live answers need `AI_MODEL` + credential (set) |
  | 13b Room · Takes · Reels | `../agari-wt/s13b` | 3132 | Takes and rooms need a Wallet Standard wallet for signatures |
  | 13c News · alerts · marquee | `../agari-wt/s13c` | 3133 | Finnhub key server-only |
  | 13d Social | `../agari-wt/s13d` | 3134 | Notification proof needs a Window the test wallet traded |

  - Lanes report back. Only the stage owner edits:
    - manifests and the lockfile;
    - `packages/core/src/ports/**`, `packages/markets/src/{env,index}.ts`, `packages/db/src/{index,index-store,schema}.ts`;
    - `web/src/providers/**`, `web/src/lib/env.ts`, `web/.env.example` and env files;
    - `services/ops/**`, `scripts/invariants/**`, `docs/plan/**`.
- **Local env:**
  - `web/.env.local` and the root `.env.local` are symlinks into the main checkout, shared by every worktree.
  - `reference/` exists only in the main checkout (`/Users/abu/dev/hackathon/stocklana/reference/masayume`).
  - Presence as of 2026-09-15 (never print values):

    | Variable | State | Used by |
    |---|---|---|
    | `DATABASE_URL` | set (the soak's `agari` DB) | social tables + index reads; nobody writes `idx_*` (Q-S13-10) |
    | `FINNHUB_API_KEY` | set | 13c client; shared 60/min with ops, so the web stays ≤ 10/min |
    | `AI_MODEL`, `OPENAI_API_KEY` | set | Sensei via `resolveModel` direct path |
    | `AI_GATEWAY_API_KEY` | empty | not needed |
    | `ROOM_TOKEN_SECRET` | set | room and social session tokens survive restarts |
    | `NEXT_PUBLIC_AGARI_INDEXER_URL` | set per S4 Handoff | build-time; lanes on another port override it for `next build` |

- **Web dev against devnet:**
  - Run `pnpm --filter web exec next dev -p <lane port>` in the lane worktree.
  - Spot and session come from ops on `:8787`; lists from `/api/index/*` over the soak DB.
- **Time:**
  - Regular Windows exist only 13:30–20:00Z on session days.
  - Posting a take and the Room's chain-seat step need a live Window; off-hours proofs use indexed history (ever-bet gate, profiles, activity, off-hours reel and marquee).
- **Signatures:** a scripted Wallet Standard test wallet (lane 4c's) drives take, join and social signatures headlessly; Phantom is used for the manual pass.
- **Masayume side-by-side:** masayume.app (deployed from `68f7a09`) with `masayume_theme`, against Agari's `agari_theme`, in isolated Chrome contexts (audit §1 method).
