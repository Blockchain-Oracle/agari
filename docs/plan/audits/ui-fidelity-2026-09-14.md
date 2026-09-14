# UI fidelity audit — 2026-09-14 (S4 lane 4e)

Agari `slice/S4e-fidelity` (base `a335841`) against Masayume, the only design authority: the live app at <https://masayume.app> (deployed from `68f7a09`, the same commit as `reference/masayume`) and its source. Owner of this file: lane 4e. Lanes 4c and 4d read it from `../agari-wt/s4e`.

## 1. Method

- **Source diff.** `reference/masayume/web/src` against `web/src`, first raw, then with the brand normalised (`@masayume/`→`@agari/`, `Masayume`→`Agari`, `MasayumeMark`→`AgariMark`), so only real drift is left.
- **Live comparison.** Chrome DevTools on isolated contexts: masayume.app and Agari `next dev` on :3005, at 1440×900, 768 and 390×844 (mobile + touch), dark and light (`masayume_theme` / `agari_theme`).
- **Route fingerprints.** For every product route, both apps were loaded in same-origin iframes and compared on title, h1–h3, the top-level children of `<main>`, and "not live / unavailable / error" text.
- **The connect modal** was measured on masayume.app (computed styles of every node, hover/active rules from the stylesheet) and read from RainbowKit 2.2.11's source (`DesktopOptions`, `MobileOptions`, `ConnectDetail`, `GetDetail`, `ConnectModalIntro`, `ProfileDetails`, `Dialog`, `DialogContent`). Masayume ran it as `darkTheme` + `rainbowkit-theme.ts` (every colour a bridge token), `modalSize="compact"`.

## 2. Headline

Source parity of the shell is already near-total. The drift the user saw has three causes, in order of how much of the screen they explain:

1. **Data surfaces are empty, not restyled.** On this base the S4 reads (lane 4a) are not merged, so every data-driven surface shows its honest "not live" state: the ticker reads `AGARI NOT LIVE ON THIS NETWORK YET`, and the markets hero, ticket rail, lanes, word board, reels, surface, earn, parlay, range and moonshot are blank or refused. Masayume's live app shows prices, cards and odds in those same components. Most of "it doesn't look like Masayume" is this, and it closes with 4a/4d, not with CSS.
2. **The connect modal was a different component.** `WalletPicker` was a shadcn `Sheet` sliding in from the right, painted `bg-popover` (= `--color-surface-3`, #404040 in dark), with default shadcn type. Masayume opens RainbowKit's compact modal: a centred 368 px panel on `--color-surface-1`, radius 24, a bottom sheet on phones, sliding up with a 350 ms overshoot. This is the "opens on the sidebar" and "sidebar colours" complaint. **Being fixed in this lane (§5).**
3. **Leftover Masayume / Somnia / EVM copy** in chrome and content pages.

What is identical, verified:

- `web/src/styles/**`: 59 files, byte-identical.
- `app/layout.tsx`, `components/ui/**`, `lib/fonts.ts`, `providers/query-client.ts`: byte-identical.
- `components/shell/**` and `components/states/**` differ only in the brand mark and the wallet seam (plus two intentional honesty edits: `BootNotice` below the fixed chrome, and no retry on `not-deployed`).
- At 390 px, the header, bottom pill nav, "Everything" drawer, games hub, tutorial and theme toggle render pixel-equivalent apart from data and brand words.
- After brand normalisation, 275 files differ in total. Outside `features/markets`, `features/games`, `app/api` and `app/dev`, the differences are almost all chain-seam type changes and copy.

## 3. Severity and owners

- **Severity:**
  - **S1:** the user named it, or it changes the look of every page.
  - **S2:** a visible drift on one surface.
  - **S3:** copy or detail drift.
  - **S4:** a note or check-later item.
- **Owners:**
  - **4e:** shared chrome, `components/**`, `styles/**`, `providers/wallet/**`, `features/{onboarding,sensei}` and presentational fixes in non-markets features.
  - **4d:** `features/markets/**`.
  - **4c:** `features/funding/**`, `features/markets/faucet/**`.
  - **4a:** reads.
  - **SO:** the stage owner, for providers, env, `packages/**` and config.
  - **Later stages** as named in plan §7.

## 4. Global chrome

| # | Item | Masayume | Agari | Difference | Sev | Owner | Status |
|---|---|---|---|---|---|---|---|
| C-01 | Connect modal | RainbowKit compact modal (`providers/rainbowkit-theme.ts`, `AppProviders.tsx`) | `providers/wallet/WalletPicker.tsx` | Right `Sheet` on #404040 vs centred token-coloured modal / phone bottom sheet; no wallet rows with icons, groups, "Recent", intro, "Get a Wallet", connecting/retry or not-installed views | S1 | 4e | In progress (§5) |
| C-02 | Account modal (connected `ConnectButton`) | RainbowKit `AccountModal` via `openAccountModal` (`features/markets/wallet/ConnectButton.tsx`) | `ConnectButton` renders an inert address label | No modal: no emoji avatar, Copy Address or Disconnect | S2 | 4e (modal), 4d (button) | In progress (§5); 4d wires `session.openAccount` |
| C-03 | Header | `components/shell/header/Header.tsx` | same | Brand mark and word only | — | — | Match |
| C-04 | Header account pill and menu | `HeaderAccount.tsx` (RainbowKit `displayName`) | `HeaderAccount.tsx` (`shortHex` 4…4) | Same markup and classes; base58 short form instead of 0x | — | — | Match (Adapted) |
| C-05 | Money pill | `HeaderMoneyPill.tsx` | same | Imports only | — | — | Match |
| C-06 | App strip | `AppStrip.tsx` | same | "Solana devnet — test funds only" line (Adapted) | — | — | Match |
| C-07 | Marquee ticker | `Marquee.tsx` | same + failure headline | Masayume shows prices; Agari shows `AGARI NOT LIVE ON THIS NETWORK YET` because lanes/prices aren't read | S1 | 4a | Waits on reads |
| C-08 | Desktop nav menus | `DesktopNavMenu.tsx`, `nav-items.ts` | same | `nav-items.ts` still says "Install Masayume as a web app." and "Read the concise Masayume thesis." | S3 | 4e | In progress |
| C-09 | Mobile pill nav + "Everything" drawer | `MobileBottomNav.tsx` | same | Visually identical at 390 (checked); title "Everything in Masayume", aria "All Masayume destinations" | S3 | 4e | In progress |
| C-10 | Footer | `Footer.tsx` | same | Byte-identical | — | — | Match |
| C-11 | Grain, custom cursor, theme toggle | `GrainOverlay`, `CustomCursor`, `ThemeToggle` | same | Byte-identical; storage key `agari_theme` | — | — | Match |
| C-12 | Theme tokens, fonts, icons | `styles/**`, `lib/fonts.ts`, `styles/icons.css` | same | Byte-identical | — | — | Match |
| C-13 | Buttons, inputs, cards, badges, tabs, tooltip, switch | `components/ui/**` | same | Byte-identical | — | — | Match |
| C-14 | Toasts | `components/ui/toast.tsx`, `styles/toast.css`, `lib/toast.ts` | same | Byte-identical | — | — | Match |
| C-15 | Tutorial (first run) | `features/onboarding/*` | same | Same modal, dots and motion. Copy tells users to "Sign in with email", which is false since D-023 | S2 | 4e | In progress |
| C-16 | Sensei dock and drawer | `features/sensei/*` | same | Mark and stock wording only; the dock's live read is empty without lanes | S4 | 4a (data) | Match (chrome) |
| C-17 | States: loading, empty, error, stale, boundary | `components/states/*` | same | `BootNotice` sits inside `<main>` below the fixed chrome; `not-deployed` offers no retry (honesty, D-015) | S4 | — | Match (intentional) |
| C-18 | 404 | `app/not-found.tsx` → `/markets?note=moved` | same | The "That page moved" note renders inside the lanes region, which is empty without reads | S4 | 4d/4a | Re-check after reads |
| C-19 | Install / PWA | `features/install/*`, `public/manifest.webmanifest` | same | `/download` title reads "Get Masayume · Agari"; install copy promises "Sign in with email" | S2 | 4e | In progress |
| C-20 | Next dev indicator | — | `next dev` "N" badge | Dev server only; absent from `next build` | S4 | — | Not a drift |
| C-21 | Root layout, providers order | `app/layout.tsx`, `AppProviders.tsx` | same | `WalletShellProvider` replaces Wagmi + RainbowKit; the rest is in order | — | — | Match (Adapted) |

## 5. Connect and account modals (C-01, C-02)

Being rebuilt in `web/src/providers/wallet/` over our own base-ui `Dialog`, keeping the D-023 seam (`useWalletSession().connect()` opens it; the Kit wallet plugin discovers, connects and remembers). Measurements below are from masayume.app (dark) and RainbowKit 2.2.11.

| Part | Masayume (measured) | Agari |
|---|---|---|
| Overlay | `--color-scrim`, `backdrop-filter: blur(4px)`, fade 150 ms | same |
| Panel (≥ 768 px) | 368 px content-box + 1 px `--color-hairline` border, `--color-surface-1`, radius 24, no shadow, centred; `slideUp` 350 ms `cubic-bezier(.15,1.15,.6,1)` + fade 150 ms | same |
| Panel (< 768 px) | full-width bottom sheet, radius 24 24 0 0, no border, 200 px under-bleed for the overshoot | same (by width; RainbowKit decides by user agent) |
| Header | 18/24 800 title centred, 28 px close circle on `--color-surface-2`, 1 px hairline border, hover ×1.1, press ×0.9 | same |
| Groups | 14/18 700, margin 16 6 8; "Installed" in accent, others `--color-ink-secondary` | Installed (Wallet Standard) and Browser (Phantom, Solflare, Backpack when absent) |
| Wallet row | 40 px, padding 5, radius 8, hover `--color-surface-2`, press ×0.95; 28 px icon radius 6 with hairline ring; 16 px 700 name; "Recent" 12 px accent | same (recent = last connected wallet) |
| Footer | hairline, 16 24 padding, "New to Ethereum wallets?" + accent "Learn More" | "New to Solana wallets?" + "Learn More" |
| What is a Wallet? | 48 px illustrations on #d0d5de, 14/18 copy, primary "Get a Wallet", "Learn More" link | same art (RainbowKit, MIT); Solana wording; link to solana.com/learn/what-is-a-wallet |
| Get a Wallet | 48 px icon rows, "Browser Extension", secondary "GET", "Not what you're looking for?" | Phantom / Solflare / Backpack with their download pages |
| Connecting | 44 px icon, "Opening X...", "Confirm connection in the extension", conic spinner, "RETRY" on failure | same |
| Not installed | "X is not installed" + "INSTALL" | same |
| Phone layout | 60 px icon strip, "What is a Wallet?" paragraph, two large outline buttons | same |
| Account modal | 74 px emoji avatar (80 on phones), 18 px 800 `4…4` address, "Copy Address"/"Copied!" and "Disconnect" tiles on `--color-surface-2` | same; native balance line omitted until a SOL balance read exists (SO) |

## 6. Routes

Chrome is shared (§4). Rows list what differs inside `<main>` at 1440 dark, from fingerprints plus screenshots; "data" means the component is the same but has nothing to render until reads land.

| Route | Difference | Sev | Owner | Status |
|---|---|---|---|---|
| `/` | Redirects to `/markets` on both | — | — | Match |
| `/markets` | Hero card empty, no ticket rail, lanes say "Not live on this network yet", word board empty. Masayume: BTC hero, chart, ticket, 2 live cards per cadence, "Just ask" board | S1 | 4a → 4d | Data |
| `/reels` | Card shows "no live venue to read right now." with a loading dot; Masayume: live reel card with chart, UP/DOWN, "Take" FAB | S1 | 4d | Data |
| `/portfolio` | Same connect gate and X wallet card | — | — | Match |
| `/portfolio/edge` | Same | — | — | Match |
| `/games` | Season card missing (SEASON_* env unset); cards otherwise identical | S3 | S12 | Env |
| `/games/practice`, `/games/line-rider`, `/games/candle-hop`, `/games/history`, `/games/lucky` | Same structure; prices empty | S4 | 4a | Data |
| `/games/duel` | "Unavailable" instead of "Connect a wallet to duel" (arena not deployed) | S2 | S12 | Blocked by program |
| `/games/rank` | Ladder empty (no DB rows) | S4 | S12 | Data |
| `/games/moonshot`, `/games/range` | Refused "RangeReserve is not deployed on this network yet"; Masayume shows "Take aim", "Your rounds", "How a moonshot pays". The reserve name is EVM wording | S2 | S10b | Blocked by program |
| `/parlay` | Refused "ParlayReserve is not deployed…"; Masayume shows the builder and "How a parlay pays" explainer, which need no chain | S2 | S10a | Blocked by program |
| `/earn` | Refused "MarketMakerVault is not deployed…"; Masayume shows "Supply the vault" and "Where the capital is" | S2 | S8 | Blocked by program |
| `/surface` | Only the h1; Masayume shows The book, Depth, Slippage, Term structure | S2 | S5 / 4a | Data |
| `/strategies`, `/agents` | Same structure; agents say "The chain endpoint isn't answering" | S4 | S9 | Data |
| `/leaderboard`, `/stats` | Same page; "The indexer isn't answering" / "couldn't reach the chain, retrying…" | S4 | S5 | Data |
| `/status` | 4 probes vs 6 | S3 | S5/S16 | Adapted |
| `/news` | Same | — | — | Match |
| `/how-it-works` | Same layout; copy is still Somnia/EVM ("Connect any EVM wallet…", "ERC-6909 outcome tokens on Somnia") | S3 | S15 | Copy |
| `/demo` | h1 "See Masayume work.", Somnia copy, the Masayume demo video; venue read unavailable | S3 | S15 | Copy |
| `/pitch` | Somnia thesis, `SomniaMark`, "Built on Somnia" | S3 | S15 | Copy |
| `/download` | Title "Get Masayume"; "Sign in with email" | S2 | 4e | In progress |
| `/trade-from-x`, `/claim` | "X sign-in is temporarily unavailable" (no X keys) | S4 | S11 | Env |
| `/native-auth` | Body says "Masayume has no native build today" | S3 | S15 | Copy |
| Legacy `/bell`, `/beta`, `/markets-live`, `/pool`, `/markets/[id]` | Same redirects | — | — | Match |

**Brand copy still reading Masayume** (user-visible, outside chrome, for S15 unless noted):

- `features/alerts/copy.ts` "while Masayume is open": 4e, in progress.
- `takes/copy.ts`, `private/copy.ts`, `edge/copy.ts` "Masayume readout", `earn/copy.ts` "Masayume MM", `surface/copy.ts` crumb and lead, `strategies/copy.ts` and `StudioForm.tsx` "Let Masayume run it".
- `app/native-auth/page.tsx`; `api/news` User-Agent.

## 7. Performance

| # | Pattern | Masayume | Agari | Verdict | Owner |
|---|---|---|---|---|---|
| P-01 | Query client defaults | `staleTime` 5 s, `refetchIntervalInBackground: false`, focus refetch, retry 1 | byte-identical | Match | — |
| P-02 | Persisted read cache | IndexedDB `boot.collateral`, `boot.venue`, `bookParams` | same, namespace `agari.read-cache.v…` | Match | — |
| P-03 | `useReadingQuery` | infra-only retry, boot-fact gating | same, plus a failed boot fact answers at once instead of loading forever | Match (better) | — |
| P-04 | Live price | SDK WebSocket `useWatchPrice`/`useLivePrice`, 5 s poll only as fallback | 5 s poll only (`useAssetPrice`; comment says SSE from price-relay replaces it) | Regression: every price view polls | 4a / SO |
| P-05 | Live book | `runtime/coordinator.ts` ref-counted pool watches (205 L) + endpoint `health.ts` | `subscribeBook` is a no-op stub; no `health.ts` | Regression: book depth only refreshes on poll | 4a / SO |
| P-06 | Lazy bundles | 1 `next/dynamic` (price chart) | same | Match | — |
| P-07 | Fonts | `next/font/google` Sora, Inter, JetBrains Mono, Noto Serif JP | byte-identical | Match | — |
| P-08 | Wallet stack in the bundle | wagmi + viem + RainbowKit on every page | Kit wallet plugin only | Smaller | — |
| P-09 | `next.config.ts` | `@coinbase/cdp-sdk` stub alias (RainbowKit baggage) | still present, now dead | Noise (plan §5 "Removed noise") | SO |
| P-10 | Bundle size | measured in §8 | measured in §8 | see §8 | — |

## 8. Build and bundle

Filled in from `pnpm build` before the lane's final commit.

## 9. Items for other owners

- **4d (`features/markets/**`):**
  - `wallet/ConnectButton.tsx` connected state: render a `Button variant="secondary"` that calls `useWalletSession().openAccount()` (Masayume's `openAccountModal`), not an inert label.
  - `/markets` with no live market: Masayume still shows the hero + ticket rail layout; check `MarketsScreen` against it once 4a reads are in.
  - `/reels` empty card height and copy.
  - The `?note=moved` line renders only inside populated lanes.
- **4a / stage owner:** P-04 live price transport, P-05 book coordinator and endpoint health, the SOL balance read for the account modal, and the ticker/lanes reads (C-07).
- **Stage owner:** P-09 dead `@coinbase/cdp-sdk` alias in `web/next.config.ts`; `THIRD_PARTY_NOTICES.md` still describes Masayume.
- **4c:** nothing drifted in `features/funding/**` beyond Adapted copy; re-check `AddFunds` and `CreditWelcome` motion after funding lands.
- **Later stages:** S15 copy (how-it-works, demo, pitch, native-auth, strategies/surface/earn/edge/takes/private brand words), S12 season env and arena, S10a/b parlay/range/moonshot explainers that could render without the program, S8 earn explainer, S5 surface and status probes.

## 10. Fix log

| Commit | Change |
|---|---|
| (pending) | this audit |
