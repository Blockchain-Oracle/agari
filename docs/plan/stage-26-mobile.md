# Stage 26 — Agari on the phone (iOS TestFlight + Android APK)

**Goal:** a native Agari app on iOS (TestFlight) and Android (APK, then the Solana dApp Store) with every web feature, the Masayume phone layout as its authority, and phone-only extras: push, Live Activity, haptics, widgets. Plan: `~/.claude/plans/agari-mobile-s26.md`. Decision: D-128. Research: Expo SDK 57, EAS, TestFlight, wallets on iOS, mobile design references (2026-09-23).

## Steps

- [ ] **26.0 Foundations.** `mobile/` (Expo SDK 57) in the workspace; polyfills; Metro singleton pins; env with absolute URLs; invariants scan `mobile/`; on the iOS simulator the proof screen lists live Windows through `useLanes` and Ed25519 WebCrypto passes; EAS project and the first TestFlight build of the shell.
- [x] **26.1 Shell and design system.** Tokens → `theme.ts` (both themes), fonts, NativeTabs (Markets · Reels · Games · Portfolio · More), header, marquee, safe areas, app icon (Icon Composer `.icon`), splash, theme switch; a `mobile-design-literals` invariant.
- [ ] **26.2 Wallets.** Practice wallet; Phantom/Solflare deeplink signer; MWA signer (Android); Connect sheet; faucet and Add funds; session-key tap trading (Keychain seed, D-128); sponsored fees via `/api/sponsor`.
- [ ] **26.3 The core loop.** Markets → Window → Ticket (slide to confirm, haptics) → receipt → verdict → claim; share card.
- [ ] **26.4 Portfolio, activity, alerts.** Portfolio and Edge; Activity inbox; Expo Push (token registration + ops sender); Live Activity and widget; Android ongoing notification.
  - Built 2026-09-24: `/api/push/register` (wallet-signed `pushRegisterMessage`, device secret, sha256 kept) and secret-gated `/api/push/drain` (web's own `selectAnnouncements` + `notificationOf`, so a push says what the in-tab alert says), `push_devices`/`push_sent`, ops `push-clock` (in `all`; idles until `PUSH_DRAIN_SECRET`), More → Notifications, `AlertsHost` (tap routing, Live Activity, widget feed, real stock marks via the app group), Android ongoing notification.
  - Proven on the iOS simulator: real Expo token registered and changed from the phone; tap on a notification opens its path; Live Activity from a real devnet bet (TSLAx Down, tx `9S14vBP6gYFrxusoR5xrxdigaQ8UqirnEfvTPXYuGSLPxP9UeAamsjtRdmecydN1mkE4qK9sBHkfWRB7ST6vGSq`) in the Dynamic Island and on the Lock Screen, ended with the verdict (QQQx Down, "Lost"); Next Window widget small/medium with live timers. Local drain composed real fill, win+claim (folded) and paid messages for that wallet.
  - Fixed 2026-09-24 (`86bc7e05`, `2a5d401f`): a 24/7 xStock Window now shows the Switchboard Surge value it settles on (ops `switchboard-spot` → `/prices/latest` xStock rows; web/phone hooks take the Window's lane; `prints/<ticker>?basis=`), including the Live Activity's standing; the ticket's requote stays with its Window. Needs ops + web deploys.
  - Open: Expo answers `InvalidCredentials` — APNs key not on the EAS project (the user: `! pnpm dlx eas-cli@latest credentials -p ios`, push key for `xyz.useagari.app`); prod needs `PUSH_DRAIN_SECRET` on Coolify web and ops (same value) plus a deploy; Android ongoing notification unrun (no emulator here).
- [ ] **26.5 Reels and every game.**
- [ ] **26.6 Products.** Earn, Baskets, Short, Parlay, Strategies, Agents, Desk, private bets.
- [ ] **26.7 Explore and social.** Leaderboard, Stats, News, Tickers, profiles, Proof, Status, How it works, takes and room, Sensei, X link.
- [ ] **26.8 Ship.** TestFlight external (public link), APK on `/download`, Solana dApp Store, store copy and screenshots, privacy policy page, review notes.

**Gate per step:** `pnpm typecheck && pnpm invariants`, the app on the simulator (and the user's iPhone via TestFlight) in dark and light; money paths get devnet rows in `acceptance.md`.

## Handoff

- Worktree `agari-wt/s26` on `stage/S26-mobile`, branched from `integration/w1` @ `258c857`. Run the app: `cd mobile && pnpm expo run:ios --device "iPhone 17 Pro"` (first build ~10 min; Metro stays up after).
- The user does, once: `! pnpm dlx eas-cli@latest login` (Expo account), accept Apple's latest Program License Agreement, Apple ID + 2FA during the first `pnpm dlx testflight`, TestFlight + Phantom on their iPhone.
