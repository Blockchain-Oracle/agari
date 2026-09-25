# Mobile takeover status

## 2026-09-25 (afternoon) — pass done, onboarding, release, films (READ THIS FIRST)

- **Side-by-side pass done** (every route, both themes, web vs app). Fixed classes, each gated by an invariant:
  gradient stop alpha (`stopPaint`, `mobile-svg-stop`), SVG never repaints on prop change (`useSvgClock`/`useSvgTween`
  + a 0.001 width nudge, `mobile-svg-motion`), iOS clips lineHeight < fontSize (`mobile-tight-leading`). Also: an
  arcade run drops on blur, the status bar is owned by the root, leaderboard "refreshing" vs "retrying", the hedge
  card compact, section heads wrap, More is an 82 % side panel, pull to refresh everywhere (`usePullRefresh`).
- **Onboarding** (`/onboarding`, first launch): brand intro (mark, AGARI, 上がり hanko + chime), four swipeable pages,
  ElevenLabs sounds (`assets/sounds/onboard-*.mp3`).
- **Deployed 09-25:** web + ops at 04579d2b (push-clock and switchboard-spot live; `PUSH_DRAIN_SECRET` set on both),
  then web + docs again with /download and the docs page.
- **Android:** APK on GitHub release `android-v0.1.0` (EAS build ece6a36d, preview profile, remote keystore);
  SHA-256 `96f512678f289a0c0ce201c303d7f663d46e67e9d365654bf4151e4113af6447`, 178.7 MB. The first EAS build failed
  on `babel-preset-expo` not being a direct dependency (fixed 5f353d09). QR: `~/dev/hackathon/agari-release/`.
- **iOS:** App Store Connect app "Agari – Call the Close" (6816116543). Build 9 (0.1.0) uploaded with `xcrun altool`
  (EAS's submit queue stalled; key copied to `~/.appstoreconnect/private_keys/`), VALID, internal testing ready.
  Public group "Agari Beta" (`https://testflight.apple.com/join/g3MnDrr7`) holds build 9, beta review submitted
  09-25 (WAITING_FOR_REVIEW); the link is live on /download. Signing: ASC key `~/.config/agari/apple/AuthKey_852363VPL4.p8`
  (issuer 911e920f-…, team 86C6ZFJ6V6); builds need `EXPO_NO_CAPABILITY_SYNC=1` (App Groups + Push set by hand).
  APNs key 9XH4KQF4M5 (Sandbox & Production) is the project's push key on EAS; copy in `~/.config/agari/apple/`.
- **Films** (outside the repo, `~/dev/hackathon/agari-video`, HyperFrames): `agari-launch` (20 s 16:9 launch film,
  real simulator footage, ElevenLabs music + SFX, 240 fps render blended to 60) is on /download; `agari-loop` (14 s
  square UI morph loop, 1440², loops seamlessly) done. Both MP4s: `~/dev/hackathon/agari-release/films/`.
- **Next:** iOS TestFlight + its link on /download, marketing.

## 2026-09-25 — web's phone layout, mobile UX, tap-trading proven (READ THIS FIRST)

- **Direction (owner, 09-25):** the app is web's phone layout (useagari.xyz at 402 px) ported literally — not a native reinterpretation — with real mobile UX where a phone does better. Source per screen: `node mobile/scripts/webdump.mjs <url> dark|light main --shot x.png` plus the web component and its CSS. Icons are lucide (`lucide-react-native` pinned to web's 1.38.0); every web font weight is loaded.
- **Shell:** web's marquee + header (mark, AGARI 上がり, theme ring, Connect / balance pill + address menu) above every screen, web's floating pill dock, More → web's right drawer. No iOS glass header or system tab bar. Tokens `mobile/src/theme/chrome.ts`.
- **Mobile UX decisions:** ticket, Add funds, connect, account rise as one shared `components/drawer/BottomDrawer.tsx`; the placed call's receipt shows in the drawer; Sensei is web's right drawer; arcade runs are full-screen and sideways (the 640×360 replay world stays fixed); the leaderboard is mobile-first (sticky filters, podium, dense tappable rows, rank bar above the dock).
- **Removed from the app (owner):** web's install strip, News, Pitch, Demo, Print proof, Stats, Market Surface, Download, and the /more and /notifications nav entries (notifications are enabled in place on Activity).
- **Tap-trading (S26.2 session key):** seed in the Keychain (`mobile/src/wallet/session-key-store.ts`), signer in `packages/markets/src/sessions/mobile/`. Proven on devnet 10:33Z: `5sR3h6kf…` is `ActorPlaceFor` signed by the phone key + sponsor, owner not a signer (rows in `docs/evidence/acceptance.md`). Web shared the cap bug fixed in `99a0b67f` (`capQuoteToGrant`).
- **Web fixes made on the way (need a web deploy to reach useagari.xyz):** X card readable in dark theme (`eae85fae`), Sensei/card strike chip never clipped (`95f7fe45`), failed claim no longer says Paid (`05d31758`), fallback reason shown (`d4faca28`), X handle fallback @useagari (`20da4501`), Activity nav copy.
- **Next:** a full side-by-side pass of every remaining screen in both themes on the simulator; more mobile-UX improvements where a phone deserves them; then S26.8 (TestFlight, APK). Simulator tips: turn off Expo's "Tools button" (it sits over the ticket's +1), tap by accessibility label (`idb ui describe-all`), 24/7 5m quotes land ≈2.5 min after open.


Updated 2026-09-23 on `codex/mobile-takeover`. This is an implementation and verification record, not a release claim. The checkout is shared with other mobile work, so rerun the checks after the final changes settle.
The web/docs `main` checkout was checked clean at `03b30abb`; no push, deployment, store submission, or publication was performed.

## Native route inventory

The five tabs have native screens: Markets (discovery, Window detail, ticket), Reels, Games, Portfolio, and More. More and Games navigate to the following app routes. The route list is exhaustive for `src/nav/items.ts`; it records screen implementation, not proof of a complete live transaction.

| Area | Native routes present |
| --- | --- |
| Games | `/games`, `/games/practice`, `/games/duel`, `/games/lucky`, `/games/range`, `/games/moonshot`, `/games/line-rider`, `/games/candle-hop`; also `/games/history`, `/games/rank`, `/games/duel/[matchId]` |
| Automate | `/strategies`, `/agents`, `/desk`, `/trade-from-x`; also strategy and desk detail/editor routes |
| Trade | `/baskets`, `/short`, `/earn`, `/parlay`, `/sensei` |
| Proof | `/proof`, `/leaderboard`, `/activity`, `/stats`, `/surface`, `/portfolio/edge`; also proof and trader detail routes |
| Learn | `/news`, `/how-it-works`, `/status`, `/download`, `/demo`, `/pitch`; also article detail |
| Account | `/claim`, `/account`, `/funds`, `/connect` |

The Docs entry is an external website. Explorer records, full source articles, wallet installation, and X post composition are external destinations. They are distinct from product navigation.

## Data and account boundaries

| Screen family | Source of displayed state | Limit |
| --- | --- | --- |
| Markets, Reels, Window, Ticket | Shared venue, lane, book, quote, and balance reads | A quote can move before signing; review shows the cap used in the transaction. |
| Portfolio, Funds, Claims | Wallet and vault balance sheet, positions, reserve shares, claimables, and fill history | The balance-sheet scan has a bounded ledger horizon; it is not a full historical proof of every escrow or credit entry. |
| Baskets, Short, Parlay, Range, Moonshot, Earn | Shared market and reserve reads plus this wallet's product positions | Undeployed, paused, failed, and empty states must stay distinct. Live write receipts need device acceptance. |
| Proof, Leaderboard, Activity, Stats, Status, News | Chain/index or application API reads | Network failure is shown as failure; these are not local sample records. |
| Practice, Lucky, Duel, arcade | Shared deterministic game rules; Lucky and Duel use live service/chain state; arcade boards use the score API | Practice is explicitly unstaked. A local arcade score is marked local until server posting succeeds. |
| Onboarding, Demo, Pitch | Product guidance and labelled illustrations | Concept visuals are not account balances or proof of a trade. |

The Portfolio separates wallet funds, Trading Balance, escrow/credit pools, Window bets, Short positions, other product stakes, provider shares, claims, and settled history. Unanswered reads show loading or unavailable states rather than fabricated zeroes.

The native review surfaces quote, maximum loss, and a deliberate confirmation before the wallet signs. A successful simulator rendering does not prove a physical wallet handoff or chain receipt.

## Verified in this checkout

- `pnpm typecheck` passed across the workspace, including mobile and web, after the current route set compiled.
- `pnpm invariants` passed with zero errors and warnings, including the no web handoff invariant.
- `pnpm exec vitest run packages/core/src/games/practice.test.ts packages/core/src/games/arcade/arcade.test.ts` passed 30 tests.
- `expo export --platform ios` and `expo export --platform android` completed on the current route set and produced bundles; the iOS bundle includes all 26 arcade sound files.
- The iOS development app installed and launched on the iPhone 17 Pro Max simulator. Full screen and interaction acceptance is pending; the Mac locked during simulator control.

## Notifications, Live Activity and widget (2026-09-24)

- More → Notifications registers this install with one wallet signature and changes or stops it with the device secret it got back. The server words each push with web's in-tab lifecycle notifications.
- Simulator-verified: real Expo token registration, kinds change from the phone, a tapped notification opening its screen, the Live Activity from a real devnet bet through to its verdict, and the Next Window widget with real stock marks.
- Not yet delivered through Expo: APNs credentials are missing on the EAS project (`InvalidCredentials`). Android's ongoing notification has not been run.

## Remaining gates

1. **X sign-in and recovery for a new account:** the web OAuth callback writes an HTTP-only browser cookie. The native fetch session does not receive that cookie. Existing wallet bindings can be read, but new in-app X sign-in needs an explicit, secure server-to-app session handoff before this route can be called complete. No mobile-only cookie workaround is claimed.
2. **iOS journey acceptance:** inspect all listed routes and complete onboarding, ticket review, game rounds/results, portfolio/claim states, recovery, light/dark, larger text, and network errors on an unlocked simulator. So far the simulator installation and shell launch are confirmed; full routes are not.
3. **Physical-device checks:** Phantom/Solflare iOS approval, Android Mobile Wallet Adapter and wallet return, headset routing over wired and Bluetooth, silent switch, interruption and resume, and haptic feel require a compatible device or emulator and real wallet apps. No Android device or emulator was connected during this pass.
4. **Live chain acceptance:** no stake, trade, payout, claim, or recovery write was sent during this pass. Verify exact quotes, wallet approvals, receipts, and post-signing state on the intended devnet environment before release review.

Do not publish or claim release readiness while any gate above remains open.
