# S15 — Public story, docs, submission

**Goal:** a stranger understands, verifies and installs Agari in five minutes: an editorial landing at `/`, story pages that tell Agari's facts (how it works, demo, pitch, download), a README with the proven-on-chain table, a docs site, OG images, the US geofence, "not investment advice" copy and a submission kit. Opened Tue 2026-09-15 18:20Z while S18's evidence boxes (devnet drives, closed-state browser pass, gate) collect on their timers (D-092).

- **Plan:** `00-plan.md` §7.2 S15. Open first: Masayume `web/src/features/{how-it-works,demo,pitch,install}`, `web/src/styles/**`, `README.md`, `docs/submission/*`, `/Users/abu/dev/hackathon/masayume-docs`, `C:00` §1, §3, §7, the `direct-demo-video` skill. The Masayume sources live only in the main checkout: `/Users/abu/dev/hackathon/stocklana/reference/masayume`.
- **Fidelity:** D-081. Masayume never finished a landing page (its `/` redirects to `/markets`, as ours does today) and never had OG images, so L-11 and L-23 are creative surfaces in Masayume's tokens (D-093). How it works, demo, pitch and download exist in Masayume and stay structurally exact; only the facts change.
- **Q-001:** answered yes on 2026-09-13, so L-11 and L-23 are built. `R:yosuku/app/page.tsx` stays closed (lineage only; the user never asked for that layout).
- **Deferral:** D-084 stands. Story pages describe S3–S7, S13 and S18 as shipped and name the deferred stages honestly.

**Branch:** `stage/S15-public-story` in worktree `../agari-wt/s15`, cut from `integration/w1` @ `b09eae9` (S18 merged). Web on **:3015** once built.
- **Lanes** (one agent each, own worktree, disjoint files, append-only export lines in shared index files with stage-owner approval):
  - `slice/S15a-landing` (`../agari-wt/s15a`, web 3151): L-11 landing, L-23 OG images, `layout.tsx` metadata.
  - `slice/S15b-story` (`../agari-wt/s15b`, web 3152): L-12 how it works, L-13 demo page, L-14 pitch, L-18 download, L-19 native (Blocked state), manifest identity.
  - `slice/S15c-docs` (`../agari-wt/s15c`, docs dev 3153): README, THIRD_PARTY_NOTICES, `docs/submission/*`, the `agari-docs` Fumadocs fork at `/Users/abu/dev/hackathon/agari-docs` (L-20, Y-06).
  - `slice/S15d-compliance` (`../agari-wt/s15d`, web 3154): geofence (`web/src/proxy.ts` + server routes), "not investment advice" copy, brand sweep of the remaining identity strings.
- **Stage owner:** S18's timed evidence (Tue 20:00Z prelist, 20:21Z devnet Phase B + C, closed-state browser pass, gate); program credibility (D-096) after tonight's upgrade; the demo recording Wed after the bell (D-097); merges 15a → 15b → 15c → 15d → stage → `integration/w1`.
- **Shared files** (append-only lines, stage-owner approval): `packages/core/src/copy/index.ts`, `web/src/lib/routes.ts`, `web/src/lib/copy.ts`, `web/src/styles/icons.css`, `THIRD_PARTY_NOTICES.md` (15c owns the body; 15a/15b append a section only when they vendor something).
- Nothing merges to `main` before the S1 Phantom check.

**D-number range:** D-092…D-099.

## Steps

- [ ] Foundation (stage owner): this file; D-092…D-097; STATUS; four lane worktrees with `pnpm install`.
- [ ] **15a Landing + OG** (`slice/S15a-landing`):
  - `/` becomes `features/landing/LandingPage.tsx` (+ `landing.css`, `copy.ts`): hero with the wordmark, one line, the live dial for the featured ticker built from 18a's `HeroAssetHead`/`HeroAssetChart`/session chip (open: live price + change; closed: last close + "opens in"), CTA "Open markets" → `/markets`, secondary "How it works"; a call in three steps (pick a Window, make the call, see it settle from the signed print); the three lanes (Regular 5m/15m/60m on the NYSE clock, Gap Fri close → Mon open, token 24/7) with 18c marks and the next Window per lane from `/session`; a proof strip (program id, venue config, the last settled Windows from the index, explorer links); the install strip (`InstallCta`); a footer with the devnet + tUSDC honesty line. Data through the existing markets hooks and keys; no new polling.
  - OG images (L-23, Y-14) with `next/og` `ImageResponse`: `app/opengraph-image.tsx` + `twitter-image.tsx` (site, 1200×630), `app/tickers/[symbol]/opengraph-image.tsx` (mark, symbol, name, last close + change; no price when the index is unreachable), `app/markets/[id]/opengraph-image.tsx` (mark, cadence, "Up or Down?", closes at). Fonts from `web/public/fonts` (licences already in the notices). `revalidate` 300; nothing fetches a data-provider key.
  - `app/layout.tsx`: `metadataBase`, `openGraph`/`twitter` defaults (15a owns `layout.tsx` this stage).
  - Acceptance: `/` at 320/390/768/1440 both themes, open and closed (closed after 20:00Z); every OG route returns a PNG (`curl -o`); `pnpm typecheck && pnpm build`; `21st review` zero errors on touched paths; `parity.md` rows L-11, L-23, Y-14 → Adapted.
- [ ] **15b Story pages** (`slice/S15b-story`):
  - L-12 `/how-it-works`: Masayume's page structure, Agari's facts: sessions (three lanes, the NYSE clock, the session words of D-087, pre-open calls per D-088), basis (Pyth + RedStone signed prints, min oracles 3, the settlement print at the Window close against the open), halts (D-057 words), voids (stake returned as venue credit with the reason line), money (tUSDC on devnet, Trading Balance and grants per S7).
  - L-14 `/pitch`: slides copy → Agari (problem, product, proof from `acceptance.md`, why Solana, what is next); one lineage slide "built from Masayume's source" is allowed; `useVenueUsage` reads Agari's index.
  - L-13 `/demo`: `proofs.ts` → confirmed devnet signatures from `docs/plan/acceptance.md`; `DemoVideo` renders an honest "recording Wed 16 Sep during NYSE hours" state while `web/public/video/agari-demo.mp4` is absent (D-097); copy → Agari.
  - L-18 `/download`: `install/copy.ts`, `web/public/manifest.webmanifest` (name, short_name, description, colours), `PhoneShot` uses an Agari capture (take one of `/markets` at 390 from the lane's dev server and save it under `web/public/demo/`).
  - L-19 `/native-auth`: keep the honest Blocked state from 18e; wording check only.
  - Acceptance: the five routes at 320/390/768/1440 both themes; `grep -ri masayume` over the owned paths returns only the lineage credit; `pnpm typecheck && pnpm build`; `21st review` zero errors on touched paths; `parity.md` L-12, L-13 (honest state), L-14, L-18 → Adapted, L-19 → Blocked.
- [x] **15c README, notices, submission, docs site** (`slice/S15c-docs`):
  - `README.md` (new): what Agari is in one paragraph; "Proven on-chain" table grouped from the confirmed rows of `acceptance.md` with explorer links; program ids with IDL and build-hash lines the stage owner fills after tonight (D-096); trust assumptions (price signers and min oracles, roller/settler/relay keys, what the server holds and never holds); honest limitations (devnet, tUSDC, Pyth trial to ≈ 09-27, deferred stages per D-084); why Solana (factual); run locally (env *names* only); architecture map; notices link.
  - `THIRD_PARTY_NOTICES.md`: verify the sections against what the tree actually borrows (Masayume/Yosuku, Phoenix and sokoban only if the engine or the games took from them, simple-icons, fonts, sounds, wallet modals, agent portraits); add what is missing, remove nothing that is real.
  - `docs/submission/`: `description.md`, `submission-checklist.md`, `public-release-audit.md` (secret scan over the tree: `git grep` for key patterns, `.env*` ignored, keypairs outside the repo), `demo-media-provenance.json` skeleton.
  - `agari-docs`: copy `/Users/abu/dev/hackathon/masayume-docs` to `/Users/abu/dev/hackathon/agari-docs` (fresh `git init`, no history); rewrite the content Agari ships (start, trading incl. new pages for sessions and lanes, pre-open calls, halts and voids; architecture incl. programs and price sources; explore; help; status); games, agents and builders collapse to one honest "after the hackathon" page each; real captures from `:3000` at 1440 and 390 into `public/`; `pnpm build` green in that repo; no deploy (user go, S16).
  - Acceptance: README links resolve (relative paths exist; absolute URLs answer `curl -I`); zero secrets in the audit; docs build green; `parity.md` L-20, Y-06 → Adapted.
- [ ] **15d Compliance + brand** (`slice/S15d-compliance`):
  - Geofence (D-095): `web/src/proxy.ts` (Next 16 proxy, researched with Context7 first) reads `x-vercel-ip-country`; `US` (or `AGARI_REGION_OVERRIDE=US` locally) sets request header `x-agari-region: restricted` and cookie `agari.region=restricted` (SameSite=Lax, readable by the client); matcher skips static assets. `web/src/lib/region.ts` → `useRegionRestricted()`; funded actions (ticket CTA and schedule CTA, faucet claim, sponsor, private desk, trade-from-x) render Masayume's disabled state with "Not available in your region" and a link to `/how-it-works`. `web/src/lib/region.server.ts` → the `api/sponsor`, `api/faucet`, `api/private/*`, `api/x/*` routes answer `451 { error: "region_restricted" }`. Browsing stays open.
  - "Not investment advice": `packages/core/src/copy/advice.ts` (`ADVICE_COPY.notAdvice`, one index line) on the Sensei panel footer, `/agents`, `/strategies`, the share-card footer line and the share sheet. The landing footer takes it at merge (stage owner).
  - Brand sweep: review every `masayume` hit outside `pitch`, `demo`, `dev/**` and code comments (`providers/wallet/*`, `features/ticker-hub/copy.ts`, `app/strategies/page.tsx`, `app/api/sensei/route.ts`); fix user-visible ones, keep lineage; record what stays and why in `docs/plan/audits/identity-2026-09-15.md`.
  - Acceptance: with the override, `/markets` at 390/1440 shows the restricted ticket and `curl -X POST :3154/api/faucet` → 451; without it nothing changes; `pnpm typecheck && pnpm build`; `21st review` zero errors on touched paths.
- [ ] **Program credibility** (stage owner, after the 20:21Z devnet sequence; D-096): `anchor build --verifiable` for `agari-events` and `agari-vault` (Docker 29 is present; `solana-verify` is not installed); on-chain IDL for both; the sha256 of the deployed binaries and the build command in the README; explorer links.
- [ ] **Demo** (stage owner, Wed 09-16 after the 13:30Z bell; D-097): `direct-demo-video` runbook, captured during NYSE hours on `:3000`; `web/public/video/agari-demo.mp4`; `docs/submission/demo-media-provenance.json` filled.
- [ ] **Browser pass** (stage owner at merge): `/`, `/how-it-works`, `/demo`, `/pitch`, `/download`, `/native-auth` at 320/390/768/1440 both themes; audit rows in `docs/plan/audits/`.
- [ ] **Gate:** `pnpm typecheck && pnpm invariants && pnpm build`; `21st review` zero errors on touched paths; README links resolve; zero "masayume" identity hits outside notices, the pitch lineage slide and code comments; the demo exists or its honest state is recorded; `parity.md` L-11…L-14, L-18…L-20, L-23, Y-06, Y-14 updated with evidence.

## Findings

- Masayume's own `/` is a redirect to `/markets` ("lands in Epic 4"), so the landing page is Agari's to design (D-093).
- No `README.md` exists in the repo yet; `THIRD_PARTY_NOTICES.md` has seven sections.
- `masayume-docs` holds 62 content files in nine sections; only a subset describes surfaces Agari ships this week.

## Handoff

- Resume from the first unchecked box. The user's blocking items: devnet SOL for the token Series, the Phantom check, the S16 deploy go (web, ops, docs).
- Lane reports go to the stage owner; every devnet signature goes in `acceptance.md`.
