# UI fidelity audit — 2026-09-14 (S4 lane 4e)

Agari `slice/S4e-fidelity` (base `a335841`, fast-forwarded to `stage/S4-first-call` @ `7fb6f24` with the S4 lanes and live devnet reads) against Masayume, the only design authority: the live app at <https://masayume.app> (deployed from `68f7a09`, the same commit as `reference/masayume`) and its source. Owner of this file: lane 4e. Lanes 4c and 4d read it from `../agari-wt/s4e`.

## 1. Method

- **Source diff.** `reference/masayume/web/src` against `web/src`, first raw, then with the brand normalised (`@masayume/`→`@agari/`, `Masayume`→`Agari`, `MasayumeMark`→`AgariMark`), so only real drift is left.
- **Live comparison.** Chrome DevTools on isolated contexts: masayume.app and Agari `next dev` on :3005, at 1440×900, 768 and 390×844 (mobile + touch), dark and light (`masayume_theme` / `agari_theme`).
- **Route fingerprints.** For every product route, both apps were loaded in same-origin iframes and compared on title, h1–h3, the top-level children of `<main>`, and "not live / unavailable / error" text.
- **The connect modal** was measured on masayume.app (computed styles of every node, hover/active rules from the stylesheet) and read from RainbowKit 2.2.11's source (`DesktopOptions`, `MobileOptions`, `ConnectDetail`, `GetDetail`, `ConnectModalIntro`, `ProfileDetails`, `Dialog`, `DialogContent`). Masayume ran it as `darkTheme` + `rainbowkit-theme.ts` (every colour a bridge token), `modalSize="compact"`.

## 2. Headline

Source parity of the shell is already near-total. The drift the user saw has three causes, in order of how much of the screen they explain:

1. **Data surfaces are empty, not restyled.** On this base the S4 reads (lane 4a) are not merged, so every data-driven surface shows its honest "not live" state: the ticker reads `AGARI NOT LIVE ON THIS NETWORK YET`, and the markets hero, ticket rail, lanes, word board, reels, surface, earn, parlay, range and moonshot are blank or refused. Masayume's live app shows prices, cards and odds in those same components. Most of "it doesn't look like Masayume" is this, and it closes with 4a/4d, not with CSS.
2. **The connect modal was a different component.** `WalletPicker` was a shadcn `Sheet` sliding in from the right, painted `bg-popover` (= `--color-surface-3`, #404040 in dark), with default shadcn type. Masayume opens RainbowKit's compact modal: a centred 368 px panel on `--color-surface-1`, radius 24, a bottom sheet on phones, sliding up with a 350 ms overshoot. This is the "opens on the sidebar" and "sidebar colours" complaint. **Fixed in `a337a64` (§5).**
3. **Leftover Masayume / Somnia / EVM copy** in chrome and content pages. The chrome, tutorial and install copy, and brand-only strings, are fixed in `3787560`; content pages are S15's.

One bug hid in the chrome itself (C-22): the header's **Connect could hydrate invisible**, a race that depended on load timing. Fixed in `a337a64`.

What is identical, verified:

- `web/src/styles/**`: 59 files, byte-identical.
- `app/layout.tsx`, `components/ui/**`, `lib/fonts.ts`, `providers/query-client.ts`: byte-identical.
- `components/shell/**` and `components/states/**` differ only in the brand mark and the wallet seam (plus two intentional honesty edits: `BootNotice` below the fixed chrome, and no retry on `not-deployed`).
- At 390 px, the header, bottom pill nav, "Everything" drawer, games hub, tutorial and theme toggle render pixel-equivalent apart from data and brand words.
- After brand normalisation, 275 files differ in total. Outside `features/markets`, `features/games`, `app/api` and `app/dev`, the differences are almost all chain-seam type changes and copy.

### Summary (38 findings; rows marked plain "Match" are not counted)

| Severity | Found | Fixed here | Open: owner |
|---|---|---|---|
| S1 | 5 | 2 (C-01 connect modal, C-22 invisible Connect) | C-07 ticker: 4a · `/markets`: 4a → 4d · `/reels`: 4d |
| S2 | 12 | 4 + C-02's modal (C-15, C-19, C-26, `/download`) | C-02 button: 4d · P-04, P-05: 4a/SO · duel: S12 · range/moonshot: S10b · parlay: S10a · earn: S8 · surface: S5/4a |
| S3 | 9 | 4 (C-08, C-09, C-23, `/native-auth`) | season: S12 · status: S5/S16 · how-it-works, demo, pitch: S15 |
| S4 | 12 | — | notes and data-gated checks: 4a, 4d, S5, S9, S11, S12, S15, SO (incl. P-11 `/api/sponsor`) |

- **By primary owner:**
  - **4e:** 11 findings, all fixed.
  - **4d:** 3, plus C-02's button follow-up; `/markets` also waits on 4a.
  - **4a / stage owner:** 7.
  - **4c:** 0.
  - **Later stages:** 15 (S5 3, S8 1, S9 1, S10a 1, S10b 1, S11 1, S12 3, S15 4).
  - **No owner:** 2 intentional or non-drifts (C-17, C-20).

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
| C-01 | Connect modal | RainbowKit compact modal (`providers/rainbowkit-theme.ts`, `AppProviders.tsx`) | `providers/wallet/WalletPicker.tsx` | Right `Sheet` on #404040 vs centred token-coloured modal / phone bottom sheet; no wallet rows with icons, groups, "Recent", intro, "Get a Wallet", connecting/retry or not-installed views | S1 | 4e | Fixed `a337a64` |
| C-02 | Account modal (connected `ConnectButton`) | RainbowKit `AccountModal` via `openAccountModal` (`features/markets/wallet/ConnectButton.tsx`) | `ConnectButton` renders an inert address label | No modal: no emoji avatar, Copy Address or Disconnect | S2 | 4e (modal), 4d (button) | Modal fixed `a337a64`; 4d wires `session.openAccount` (messaged) |
| C-03 | Header | `components/shell/header/Header.tsx` | same | Brand mark and word only | — | — | Match |
| C-04 | Header account pill and menu | `HeaderAccount.tsx` (RainbowKit `displayName`) | `HeaderAccount.tsx` (`shortHex` 4…4) | Same markup and classes; base58 short form instead of 0x | — | — | Match (Adapted) |
| C-05 | Money pill | `HeaderMoneyPill.tsx` | same | Imports only | — | — | Match |
| C-06 | App strip | `AppStrip.tsx` | same | "Solana devnet — test funds only" line (Adapted) | — | — | Match |
| C-07 | Marquee ticker | `Marquee.tsx` | same + failure headline | Masayume shows prices; Agari shows `AGARI NOT LIVE ON THIS NETWORK YET` because lanes/prices aren't read | S1 | 4a | Waits on reads |
| C-08 | Desktop nav menus | `DesktopNavMenu.tsx`, `nav-items.ts` | same | `nav-items.ts` still says "Install Masayume as a web app." and "Read the concise Masayume thesis." | S3 | 4e | Fixed `3787560` |
| C-09 | Mobile pill nav + "Everything" drawer | `MobileBottomNav.tsx` | same | Visually identical at 390 (checked); title "Everything in Masayume", aria "All Masayume destinations"; app-strip region "Install Masayume" | S3 | 4e | Fixed `3787560` |
| C-10 | Footer | `Footer.tsx` | same | Byte-identical | — | — | Match |
| C-11 | Grain, custom cursor, theme toggle | `GrainOverlay`, `CustomCursor`, `ThemeToggle` | same | Byte-identical; storage key `agari_theme` | — | — | Match |
| C-12 | Theme tokens, fonts, icons | `styles/**`, `lib/fonts.ts`, `styles/icons.css` | same | Byte-identical | — | — | Match |
| C-13 | Buttons, inputs, cards, badges, tabs, tooltip, switch | `components/ui/**` | same | Byte-identical | — | — | Match |
| C-14 | Toasts | `components/ui/toast.tsx`, `styles/toast.css`, `lib/toast.ts` | same | Byte-identical | — | — | Match |
| C-15 | Tutorial (first run) | `features/onboarding/*` | same | Same modal, dots and motion. Copy tells users to "Sign in with email", which is false since D-023 | S2 | 4e | Fixed `3787560` (Masayume's line with "any Solana wallet") |
| C-16 | Sensei dock and drawer | `features/sensei/*` | same | Drawer, bubbles, starters and input identical at 1440 (checked open). Mark and stock wording differ; the meter shows `···` because lanes are not read | S4 | 4a (data) | Match (chrome) |
| C-17 | States: loading, empty, error, stale, boundary | `components/states/*` | same | `BootNotice` sits inside `<main>` below the fixed chrome; `not-deployed` offers no retry (honesty, D-015) | S4 | — | Match (intentional) |
| C-18 | 404 | `app/not-found.tsx` → `/markets?note=moved` | same | The "That page moved" note renders inside the lanes region, which is empty without reads | S4 | 4d/4a | Re-check after reads |
| C-19 | Install / PWA | `features/install/*`, `public/manifest.webmanifest` | same | `/download` title reads "Get Masayume · Agari"; install copy promises "Sign in with email" | S2 | 4e | Fixed `3787560` |
| C-20 | Next dev indicator | — | `next dev` "N" badge | Dev server only; absent from `next build` | S4 | — | Not a drift |
| C-21 | Root layout, providers order | `app/layout.tsx`, `AppProviders.tsx` | same | `WalletShellProvider` replaces Wagmi + RainbowKit; the rest is in order | — | — | Match (Adapted) |
| C-22 | "Connect" invisible (header, ticket gate, portfolio) | RainbowKit shows Connect once mounted; wagmi's `isReconnecting` is true only for a stored connection | `WalletShellProvider`, `HeaderAccount`, `markets/wallet/ConnectButton` | Two layers, reported by 4a and 4d. (1) The Kit plugin hands hydration its live store, so the inert server button hydrated with live props and kept `invisible` / `aria-hidden` / `tabindex=-1`; the dev log said "attributes … didn't match … won't be patched up". (2) The shell mapped the plugin's `pending` to "restoring" before hydration and whenever discovery hadn't settled, so the controls were inert by design | S1 | 4e | Fixed: hydration gate in `a337a64`; in `f20b374`, SSR and hydration always render "Connect", and "restoring" only means a remembered `agari.wallet` reconnecting (≤ 3 s). ConnectButton shows Masayume's disabled "Connecting…" rather than hiding |
| C-23 | Header control while connecting | Stays "Connect" (RainbowKit shows progress in the modal) | Read "Connecting…" and disabled itself | Label and state drift | S3 | 4e | Fixed `a337a64` |
| C-25 | ThemeToggle in the mismatch report | `ThemeToggle.tsx` (`mounted` placeholder) | byte-identical | Named only because React's mismatch diff prints the header's siblings as context; the mismatched node was HeaderAccount's button. No warning after C-22 | — | — | Match |
| C-26 | Stock prices rounded to whole dollars outside markets | `usd0` / `oracleToWholeUsd` (BTC/ETH scale) | sensei snapshot, drawer and trade cards; share call and trade cards; takes composer and reel card; duel face; practice live pill; parlay line | A $251.37 stock read "$251"; the Sensei prompt saw a price on its line | S2 | 4e | Fixed `7949b0b` with 4d's `usdLine` rule (whole from $1,000, cents below). Range bands (`range/format.ts`, cents-scale prints) left to S10b |
| C-24 | Brand mark | `MasayumeMark.tsx` (正夢 crescent) | `AgariMark.tsx` is the same glyph, renamed | A logo is allowed to differ; Agari (上がり) has no mark of its own yet | S4 | S15 | Open |

## 5. Connect and account modals (C-01, C-02)

Rebuilt in `web/src/providers/wallet/` (`a337a64`) over our own base-ui `Dialog`, keeping the D-023 seam (`useWalletSession().connect()` opens it; the Kit wallet plugin discovers, connects and remembers). Measurements below are from masayume.app (dark) and RainbowKit 2.2.11.

**Connect states (`f20b374`), verified in fresh isolated contexts on the merged stage code:**

- The SSR HTML carries a visible `Connect` in the header and in the portfolio ConnectButton, and there are no hydration warnings.
- A remembered wallet that is missing shows the ticket "Connecting…" (disabled) for up to 3 s, then "Connect". The header stays "Connect" throughout.
- A remembered wallet that is present reconnects silently to the address pill.
- A new connection closes the modal and shows the pill.

**Verified on Agari, dev and `next start`.** At 1440, every node of the list, "What is a Wallet?", "Get a Wallet", "Opening…" and RETRY views sits at the same x/y/w/h as masayume.app's, to the pixel. Checked with a spec-conformant Wallet Standard test wallet (WebCrypto Ed25519) injected in the page:

- Installed group, Recent tag, and connect → modal closes → header pill.
- The account modal, and Disconnect → header back to Connect.
- A rejected connect shows RETRY.
- The phone bottom sheet, icon strip and Get step at 390.
- Light theme at 768.

**Two pipeline notes, both shared with Masayume's build:** the CSS pipeline drops a `backdrop-filter` declared next to its `-webkit-` twin (masayume.app's `.modal-scrim` has lost its blur the same way), so the modal declares it unprefixed only. `base.css`'s `:focus-visible` ring is suppressed on the popup, as RainbowKit's inline `outline: none` did.

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
| Account modal | 74 px emoji avatar (82 on phones), 18 px 800 `4…4` address, "Copy Address"/"Copied!" and "Disconnect" tiles on `--color-surface-2` | same; native balance line omitted until a SOL balance read exists (SO) |

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
| `/download` | Title "Get Masayume"; "Sign in with email" | S2 | 4e | Fixed `3787560` |
| `/trade-from-x`, `/claim` | "X sign-in is temporarily unavailable" (no X keys) | S4 | S11 | Env |
| `/native-auth` | Body said "Masayume has no native build today" | S3 | 4e | Fixed `3787560` |
| Legacy `/bell`, `/beta`, `/markets-live`, `/pool`, `/markets/[id]` | Same redirects | — | — | Match |

**Brand copy that read Masayume.** Where only the name was wrong, the string was fixed in `3787560`:

- alerts "while Masayume is open"
- takes "stored by Masayume"
- private "Nobody at Masayume"
- edge "Masayume readout"
- earn "Masayume MM"
- surface crumb and lead (which also named DreamDEX)
- strategies "Masayume Ledger" and "Let Masayume run it", plus the Agents crumb
- native-auth
- the news bot User-Agent

**Left for S15**, because the sentences themselves describe Somnia/EVM and need rewriting, not renaming:

- `how-it-works/content.ts`
- `demo/copy.ts` and `DemoVideo.tsx`
- `pitch/*`
- the Masayume demo video

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
| P-10 | Bundle size | 58 JS files, 3,492 KB decoded / 934 KB brotli on `/markets` | 34 files, 1,952 KB decoded / 608 KB gzip | ≈ 44 % less JS (see §8) | — |
| P-11 | `/api/sponsor` on every page load | `SessionKeyProvider` → `useSponsorStatus()` (one GET, no poll), mounted in `AppProviders` | same: `features/session/SessionKeyProvider.tsx:40`, mounted by `providers/AppProviders.tsx` for every route. The route answers a constant `configured:false` until S7 | Wasted request (parity with Masayume, whose route did have a relayer to report) | SO (S7): fetch only when a session key is being enabled, or behind a sponsor-enabled flag |

## 8. Build and bundle

- **`pnpm build`** (web, Next 16.3.4 Turbopack, on `3787560`): compiled in 21.0 s under a load average of 12 (other lanes were building); 68/68 static pages. Next 16 no longer prints per-route sizes, so bundles were measured in the browser.
- **`/markets`, cold cache, 1440 dark, resource timing:**

| | masayume.app (Vercel) | Agari `next start` |
|---|---|---|
| JS files | 58 | 34 |
| JS decoded | 3,492 KB | 1,952 KB |
| JS transferred | 934 KB (brotli) | 608 KB (gzip) |
| CSS decoded | 700 KB | 685 KB |
| Preloaded fonts | 4 (Sora, Inter, JetBrains Mono subsets) | the same 4 files |

- **Caveats:**
  - Agari's `/markets` renders its not-deployed state, so the lazily loaded `lightweight-charts` chunk (one `next/dynamic`) is not fetched. That is about 160 KB on Masayume.
  - Masayume's figure includes wagmi, viem and RainbowKit on every page.
  - The two servers compress differently, so the decoded sizes are the comparable figure.
- **Prod console:** no hydration warning after C-22; only Next's "preloaded but not used" warnings for prefetched route CSS and `/app/bet-screen.png`.

## 9. Items for other owners

- **4d (`features/markets/**`):**
  - `wallet/ConnectButton.tsx` connected state: render a `Button variant="secondary"` that calls `useWalletSession().openAccount()` (Masayume's `openAccountModal`), not an inert label.
  - `/markets` with no live market: Masayume still shows the hero + ticket rail layout; check `MarketsScreen` against it once 4a reads are in.
  - `/reels` empty card height and copy.
  - The `?note=moved` line renders only inside populated lanes.
- **4a / stage owner:** P-04 live price transport, P-05 book coordinator and endpoint health, the SOL balance read for the account modal, and the ticker/lanes reads (C-07).
- **Stage owner:**
  - P-11: the `/api/sponsor` GET on every route, from `SessionKeyProvider` in the shared providers.
  - P-09: the dead `@coinbase/cdp-sdk` alias in `web/next.config.ts`.
  - `THIRD_PARTY_NOTICES.md` still describes Masayume. A "Wallet modals" section (RainbowKit MIT, Solana Wallet Adapter icons Apache-2.0) was added in `a337a64`.
  - D-023's wording ("WalletPicker (a sheet above the fixed chrome, z 1000)") is superseded: it is now a centred modal / phone bottom sheet at z 1000, with `useWalletSession().openAccount()` added to the seam.
- **4c:** nothing drifted in `features/funding/**` beyond Adapted copy; re-check `AddFunds` and `CreditWelcome` motion after funding lands.
- **Later stages:** S15 copy (how-it-works, demo, pitch, native-auth, strategies/surface/earn/edge/takes/private brand words), S12 season env and arena, S10a/b parlay/range/moonshot explainers that could render without the program, S8 earn explainer, S5 surface and status probes.

## 10. Fix log

| Commit | Change |
|---|---|
| `6d90995` | this audit, first version |
| `a337a64` | C-01 connect modal, C-02 account modal + `openAccount`, C-22 header hydration, C-23 header label; wallet artwork in `web/public/wallet/`; notices |
| `f20b374` | C-22 second layer: Connect on the first paint; restoring only for a remembered wallet; ConnectButton's "Connecting…" rung; modal lists install links without waiting for discovery |
| `7949b0b` | C-26 stock price rule in Sensei, share cards, takes, duel, practice, parlay |
| `3787560` | C-08, C-09, C-15, C-19 copy; brand-only strings in alerts, takes, private, edge, earn, surface, strategies, native-auth, news UA |
| stage `dd74b14` | C-02 button: the connected ticket/portfolio button opens the account modal |
| stage (S4 merge review) | P-04 and P-05 were measured on a base without lane 4a. On `stage/S4-first-call` `useAssetPrice` subscribes to the ops spot stream (`runtime/spot-stream.ts`, SSE push, poll only as fallback) and `subscribeBook` is a ref-counted `accountNotifications` coordinator (`runtime/coordinator.ts`): both resolved. Masayume's endpoint `health.ts` (multi-RPC failover) has no Agari equivalent yet: deferred to S16 (one public devnet endpoint in S4, D-035). P-09: the dead `@coinbase/cdp-sdk` resolve alias and its stub removed from `web/next.config.ts`; build green |
