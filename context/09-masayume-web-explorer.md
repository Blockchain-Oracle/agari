# 09 — Masayume web app + shared packages (implementation-level map for the Agari port)

> **Source:** planning-session explore agent, 2026-09-13; transcribed by the main session after plan approval. Referenced by `docs/plan/00-plan.md` §5 as C:09.
>
> **Paths:** Masayume is `/Users/abu/dev/hackathon/sommina-events` @ `68f7a09` (`reference/masayume`). Every path below is relative to that root.
>
> **Tags:** `[C]` = confirmed from source, `wc` or grep. `[I]` = inferred. Nothing was modified.

## 1. Stack & versions [C]

Sources: the `pnpm-workspace.yaml` catalog, `web/package.json` and the root `package.json`.

| Area | What Masayume uses |
|---|---|
| Monorepo | pnpm 11.24, Node ≥22; workspaces `web`, `packages/*`, `services/*`, `scripts` |
| Framework | Next 16.3.4, React/react-dom 19.2.8, TypeScript ^5.9 |
| Styling | Tailwind ^4.1 via `@tailwindcss/postcss`, `tw-animate-css` ^1.4, `class-variance-authority`, `clsx`, `tailwind-merge` ^3.6 |
| UI primitives | shadcn ^4.19, style `"base-nova"`, over `@base-ui/react` ^1.7. **No Radix, no vaul.** |
| Data | `@tanstack/react-query` ^5.90, zod ^4.1, `idb-keyval` ^6.3. **No zustand, jotai or SWR.** No form library; forms are hand-rolled. |
| Motion | `motion` ^12.43, used in only 3 files (`features/games/motion.ts`, `games/stage/SwipeDeck.tsx`, `funding/CreditWelcome.tsx`). Everything else is CSS (50 `@keyframes`). No GSAP, no Lenis. |
| Charts | `lightweight-charts` ^5.2, only in `features/markets/hero/PriceChart.client.tsx`. Sparklines (`lanes/CardSpark.tsx`) are SVG; share cards and arcade use canvas 2D. |
| Wallet | wagmi ^2.19, viem ^2.38, `@rainbow-me/rainbowkit` ^2.2.11. `packages/markets` pins `@somnia-chain/markets-sdk` to exactly 0.28.1. |
| AI | `ai` ^7.0.87 + `@ai-sdk/{anthropic ^4.0.46, openai ^4.0.53, google ^4.0.59}`; `@anthropic-ai/sdk` ^0.122 also listed. |
| X/Twitter | Web: a hand-written OAuth 1.0a signer (`features/x/oauth1.server.ts`), no library. Only `services/ops` uses `rettiwt-api` 7.1.3, `sharp` and `opentype.js`. |
| DB | `postgres` (postgres.js) ^3.4.9 with raw SQL. No ORM. |
| Other | `lucide-react` ^1.38; `@dicebear/core` + `notionists` (agent portraits); `qrcode-generator` 2.0.4 (share stub). |
| Analytics | None: no dependency, no env var. |
| Tests | vitest ^4; 76 `*.test.ts` files across web and packages. |

## 2. Design system [C]

### CSS organization

About 17.5k lines total: 13,506 in `web/src/styles/` (59 files) plus 3,982 in 27 feature-local CSS files. Nearly all of it is global CSS.

`web/src/styles/index.css` imports, in order:
1. `yosuku/index.css`, which does `@import "tailwindcss" source(none)`, then `part-01…18.css`, then `@source` over app, components, features, lib and providers.
2. `tw-animate-css`.
3. `bridge.css`.
4. `tokens.css`.
5. 36 per-surface files: shell, navigation, markets-hero, ticket, ticket-composer(-light), modal, reel*, toast, tutorial, word-board, market-card, room*, history, edge*, leaderboard-theme, take*, share-card, alerts, news, status, how-it-works, demo, pitch*, error, download, stats.
6. `base.css`.

Two further conventions:
- `styles/yosuku/part-01…18.css` (5,871 L) is Yosuku's `globals.css` split byte-identically to stay under 400 lines. Its header says to regenerate the split, not hand-edit a part.
- Feature-local CSS uses plain imports (e.g. `features/games/games.css`, `duel/duel.css`, `x/x.css`). There is exactly one CSS Module: `features/session/SessionDetails.module.css`.

### Palette (`part-01.css`, `@theme` / `:root`)

```
--color-bg:#050505  --color-vermilion:#E04D26  --color-vermilion-d:#B83A1B
--color-profit:#34D399  --color-loss:#FB7185  --color-off-blue:#60A5FA
gray-50 #FAFAFA … gray-950 #0A0A0A (Tailwind neutral ramp)
--ease: cubic-bezier(.4,0,.2,1)  --ease-out: cubic-bezier(.22,1,.36,1)  --ease-bounce: cubic-bezier(.34,1.56,.64,1)
```

### Semantic bridge (`bridge.css`)

**Surfaces**

| | Surface 1 / 2 / 3 | Hairline | Strong border |
|---|---|---|---|
| Dark | `--ms-surface-1/2/3` = #171717, #262626, #404040 | `rgb(255 255 255/.1)` | `/.22` |
| Light | #F6F0E4, #ECE3D2, #FBF7EE | `rgb(20 18 16/.12)` | — |

**`@theme inline` names**
- Surfaces and ink: `--color-ground/surface-1..3/hairline/border-strong/ink/ink-secondary/ink-muted/ink-disabled`.
- Accent: `--color-accent` (vermilion) with `-hover/-pressed/-dim/-wash` built by `color-mix`.
- Direction: `--color-profit-wash/loss-wash`.
- Fonts: `--font-body/data/stamp/heading`.

**Literal colors:** `--color-cream:#F4EEE3`, `--color-cream-ink:#141210`, `--color-cream-hairline:#D9CBB0`, `--color-scrim:#040302b8`, `--color-warning:#F2994A`, `--color-info:#60A5FA`. The receipt is a paper island in both themes.

**Scales**

| Scale | Values |
|---|---|
| Type | display 40, headline 26, title 18, body 15, caption 13, label-micro 11 (`.16em`), data 14, data-lg 20, data-hero 40, stamp 28, stamp-hero 64 (weight 900) |
| Radii | `sm 4`, `md 8`, `lg 12`, `xl 24`, `full`. Yosuku classes also use 22px cards and pill buttons. |
| Spacing | `--spacing:4px`, gutter 16 / 24 desktop, section 64 / 96, touch target 44 |

shadcn aliases (`--color-background/primary/card/popover/border/ring…`) all map onto the bridge.

### Component-tier tokens (`tokens.css`)

- Components: ticket, market-card, reel-card (max-width 460), balance-plate, claim-plate, receipt, capability-receipt, verdict-stamp (−4deg rotation), button-primary (48px), button-up/down, input, badges, countdown, banzuke-row.
- Shadow: `--receipt-shadow` ("the app's ONE drop shadow"), plus `--glow-live`.
- Chrome: `--ticker-height:32px`, `--pill-nav-offset`/`--pill-nav-clearance` (safe-area aware), `--toast-offset`, `--content-reading:640px`, `--content-wide:1200px`, nav panel colors for dark and light.
- Offsets and z-order: `--appstrip` offset 34px (28px mobile), defined in `yosuku/part-02.css`. Z-order: strip 900, ticker 850, header 800.

### Fonts, theme, icons, sound

- **Fonts (`lib/fonts.ts`, `next/font/google`):**
  - Sora 400/600/700/800 (`--font-sora`), Inter (`--font-inter`), JetBrains Mono 400/500/600 (`--font-jetbrains`), Noto Serif JP 500/700 (`--font-noto-serif-jp`).
  - These variable names are a contract with the Yosuku CSS.
  - The pixel font m6x11plus is loaded by `@font-face` in `features/games/games.css`, only inside the games frame.
  - `@utility numbers` sets the data font with tabular numerals.
- **Dark/light theme:**
  - Driven by `data-theme` on `<html>`. `lib/theme.ts` uses storage key `masayume_theme`: stored choice first, then OS preference, else dark.
  - `THEME_INIT_SCRIPT` is inlined in the layout to prevent a flash.
  - 395 `[data-theme="light"]` selectors; `base.css` sets `color-scheme`.
- **Motion:** `base.css` kills all animation and transition under `prefers-reduced-motion`. `lib/motion.ts` exports `usePrefersReducedMotion()`.
- **Icons:** lucide in 57 files. Custom marks: `components/icons/AssetMarks.tsx` (e.g. `TUsdcMark`), `components/shell/MasayumeMark.tsx`, `styles/icons.css`.
- **Sound and haptics (games only):**
  - `features/games/audio.ts`: `SfxName` covers 10 Kenney mp3s in `public/sounds`, plus a WebAudio synth bed (`bed.ts`) and `installAudioUnlock`.
  - `feedback.ts`: `navigator.vibrate`.
  - `GameSettingsSheet.tsx`: sound/haptics/motion toggles.
- **Chrome effects:** `CustomCursor.tsx` (body class `cursor-custom`) and `GrainOverlay.tsx`.

## 3. App shell & navigation [C]

**Root layout (`app/layout.tsx`)**
- `<html suppressHydrationWarning>`, body with `fontVariables`.
- The theme script, then `<AppStrip/>` **outside** the providers.
- Then `AppProviders` → `TooltipProvider` → `Toaster limit={1}` → `ShellChrome`.

**Provider order (`providers/AppProviders.tsx`)**
1. `WagmiProvider`: `ssr:true`, `cookieStorage`, `fallback(http…)`. Wallets: injected, Rabby, Brave, plus MetaMask/WalletConnect/Rainbow only when a WalletConnect project id exists.
2. `QueryClientProvider`: staleTime 5s, `refetchIntervalInBackground:false`, retry 1. `usePersistedReadCache` (IndexedDB).
3. `PerfProbe`.
4. `RainbowKitProvider`: theme, `initialChain=SOMNIA_SHANNON`, compact modal.
5. `MarketsProvider env`.
6. `UserSessionProvider`: `useWalletClient` → `SubmitterSessionProvider enabled={isRightChain}`; exposes `useOwnerWalletClient`.
7. `MarketsBoot`: boot facts. Failure shows an `ErrorState` banner, stale shows a `StaleTick`; exposes `useBoot()`.
8. `SessionKeyProvider`, wrapping `AlertsWatcher`, `WriteRecovery`, `SessionRecovery` and `children`.

**`ShellChrome` (`components/shell/ShellChrome.tsx`)**
- Renders `Marquee`, `Header`, `GrainOverlay`, `CustomCursor`, `main.page-shell`, `Footer`.
- `ISLAND_ROUTES=["/trade-from-x"]` get only cursor + `main.page-island` + `MobileBottomNav`.

**Header (`components/shell/header/`)**
- `Header.tsx`, `DesktopNavMenu.tsx` (base-ui `Menu`), `HeaderMoneyPill.tsx`.
- `HeaderAccount.tsx`: RainbowKit `ConnectButton` render-prop, `useDisconnect`, `useBalancePlate`.
- `MobileBottomNav.tsx`: a base-ui Dialog `Sheet` drawer built from `MOBILE_NAV/MOBILE_OVERFLOW/MOBILE_DRAWER_SECTIONS`.
- `nav-items.ts` (334 L): `NAV_ITEMS`, `NavGroup` ids `games|build|explore`, lucide icons, `match.paths`. Also `nav-items.test.ts` and `useFloatingMenus.ts`.
- Possible legacy duplicates [I]: `components/chrome/` has `AppShell`, `PillNav`, `TopHeader`, `nav-items.ts`, `Ticker`, `LiveTicker`.

**Routing**
- No route groups, no `middleware.ts`/`proxy.ts`, no `loading.tsx`.
- Only two layouts: root, and `app/games/layout.tsx` (`GamesShell`: back link, economic label, sound/haptics/motion, active match).
- `/` → `redirect(MARKETS_PATH)`.
- Legacy redirect pages: `bell`, `beta`, `markets-live`, `markets/[id]`, `pool`.
- 37 product `page.tsx` outside `/dev`, plus 22 `/dev` fixture pages.
- Pages are thin server shells, e.g. `markets/page.tsx` renders `<Suspense fallback={<LoadingState shape="plate"/>}><MarketsPage/></Suspense>`.

**`next.config.ts`**
- Redirects `/docs` and `/docs/:path*` → `DOCS_URL`.
- `transpilePackages`: brain, core, markets (not db).
- Turbopack `resolveAlias` maps `@coinbase/cdp-sdk` to `lib/optional-dependency-stub.cjs`. This is RainbowKit baggage and can be dropped on Solana.

**Metadata and typing**
- Title template `%s · ${BRAND.name}`, `appleWebApp`, `manifest.webmanifest` (bg #050505, theme #E04D26, start `/markets`), icons.
- **No OG images:** no `opengraph-image`, no `ImageResponse`.
- Next typed routes via `LayoutProps<"/">`; typecheck = `next typegen && tsc --noEmit`.

## 4. Component families [C]

### `web/src/components` (65 files, 3,196 L)

| Folder | Size | Contents |
|---|---|---|
| `ui/` | 10 files, 735 L | shadcn/base-ui: badge, button, input, separator, sheet (base-ui Dialog), skeleton, switch, tabs, toast (base-ui `createToastManager`), tooltip |
| `shell/` | 19 files, 1,346 L | app shell and header |
| `chrome/` | 13 files, 356 L | possible legacy duplicates (see §3) |
| `states/` | 9 files, 346 L | `BlockedButton`, `BoundaryScreen`, `EmptyState`, `ErrorBoundary`, `ErrorState({diagnosis,retry})`, `LoadingState({shape})`, `ReadingBoundary`, `StaleTick({asOfMs,reason})` |
| `data/` | 8 files, 223 L | `Countdown`, `CountdownRing`, `Hash`, `Money`, `Odds`, `UtcTime`, `useNowMs` |
| `receipt/` | 5 files, 130 L | `ProofLink`, `Receipt`, `ReceiptRow`, `ReceiptStub` |
| `icons/` | 1 file, 60 L | `AssetMarks.tsx` |

### `web/src/features` (607 files, 47,818 L)

**games** (109 files, 13,673 L): duel 26 files / 4,216 L; lucky 2,460; arcade 1,927; moonshot 839; practice 787; stage 695.

**markets** (146 files, 7,178 L)

| Subfolder | Lines | Key files |
|---|---|---|
| `hero/` | 1,003 | `HeroMarket`, `HeroCadenceTabs`, `HeroQuestion`, `PriceChart(.client)`, `DepthStrip`, `DistanceReadout`, `OraclePrice`, `useChartSeries`, `useOracleSpot`, `useTopOfBook` |
| `ticket/` | 1,531 | `Ticket.tsx` (309 L), `TicketDock` (rail/drawer), `StakeInput`, `QuickChips`, `SideSegments`, `ReadoutStrip`, `AccountGate`, `PublicPrivate`, `LeverageChips`, `PlacedCall`, `useQuote`, `usePlaceBet`, `useTicket`, `ticket-guards.ts` |
| `verdict/` | 500 | `LiveVerdict`, `VerdictCard`, `VerdictStamp`, `ClaimWinnings`, `PnlFigure` |
| `claims/` | 563 | `ClaimPlate`, `ClaimProgress`, `ClaimSuccessReceipt`, `useClaimAll` |
| `balance/` | 219 | `BalancePlate(View)`, `PoolRow`, `useBalancePlate` |
| `portfolio/` | 823 | `PortfolioScreen`, `BetsPanel`, `plate/LedgerPlate` |
| `history/` | 653 | history rows, `HistoryReceipt` |
| `reels/` | 579 | `ReelsScreen`, `ReelCard`, `ReelChart`, `useActiveReel` |
| `lanes/` | 505 | `MarketCard`, `CardSpark`, `CadenceLanes`, `BetweenRounds` |
| `word-board/` | 144 | "Just ask" board |
| `faucet/` | 244 | faucet |
| `wallet/` | 61 | connect button |

**strategies** (48 files, 3,743 L): `CreatorStudio`, `StudioForm`, `CopyDrawer`, `LiveDesk`, `MemoryMarket`, `AgentPortrait`.

**Other features, by line count:** x 2,757, parlay 1,976, session 1,757, range 1,714, private 1,464, pitch 1,343, vault 1,059, share 1,027 (1600×900 canvas PNG: `canvas.ts`, `call-card.ts`, `trade-card.ts`, `stub.ts` QR), surface 1,025, sensei 944 (`SenseiDock`, `SenseiDrawer`, `SenseiTradeCards`, `Typewriter`, `useSenseiChat`, `useSenseiSnapshot`), room 941, funding 846 (`AddFunds`, `CreditWelcome`), earn 777, demo 704, leaderboard 680, takes 625, how-it-works 598, edge 502, status 455, leverage 435, stats 411, alerts 389, install 277, onboarding 243 (`Tutorial`), news 203, recovery 66, perf 58.

### Overlays and toasts

- **Modals and drawers:**
  - base-ui `Sheet` is used only by the mobile nav, `HistoryReceipt` and a dev fixture.
  - Most overlays are bespoke `createPortal` components (11 feature files, e.g. `SessionModal`, `DuelResultModal`) or bespoke drawers (`AddFunds`, `CopyDrawer`), styled by `styles/modal.css`.
- **Toasts:** `lib/toast.ts` `notify` helper [I on exact API], `components/ui/toast.tsx`, `styles/toast.css`.

## 5. Data layer [C]

**Reads**
- TanStack Query via `useReadingQuery(queryKey, read, {pollMs, enabled, staleTimeMs, needs})` in `packages/markets/src/react/useReadingQuery.ts`.
- Every result is a `Reading<T>` (`@masayume/core/schemas`): ok or error with a `Diagnosis`, plus `stale`/`staleReason`/`asOfMs`.
- Only infrastructure failures (`indexer-down`, `rpc-down`, `send-unknown`, `unknown`) throw and retry, at most 2 times.
- Reads gate on boot facts: `collateral`, `venue`, `clock`.

**Query keys (`react/keys.ts`)**
- Shape: `[QUERY_KEY_SCOPE (from SDK), "masayume", family, …]`.
- Families:
  - boot / collateral / venue / clock
  - lanes, market, marketsLite, opening, assetPrice, priceHistory, bookParams, resolution
  - positions → holdings, claimables, history, vault → vaultHoldings, balanceSheet, walletCollateral, nextWindow
  - parlay*, range*, maker*, leverage*, private*, arena*
  - onchain and fee reuse SDK keys
- Persisted to IndexedDB: only `boot.collateral`, `boot.venue` and `bookParams` (`providers/persist.ts`).

**Hooks exported by `@masayume/markets/react`** (107 web imports)

| Group | Hooks |
|---|---|
| Providers and session | `MarketsProvider`, `SubmitterSessionProvider`, `useSigner`, `useSubmitter`, `useUserSession` |
| Boot | `useMarketsBoot`, `useBootFacts` |
| Market reads | `useAssetPrice`, `useBook`, `useBooks`, `useStakeQuote`, `useTick`, `useLanes`, `useMarket`, `useMarketsLite`, `useOpeningPrice`, `usePriceHistory`, `useOnchain`, `useBookParams`, `useNextWindow`, `useResolution`, `useSettlementFee`, `useClock` |
| Account reads | `useHoldings`, `useWalletCollateral`, `usePositions`, `useClaimables`, `useWalletHistory`, `useBalanceSheet`, `useVaultSnapshot`, `useVaultHoldings` |
| Products | `useParlayReserve`/`useMyParlays`, `useRangeReserve`/`useMyRanges`, `useMakerVault`/`Windows`/`History`/`Shares`, `useLeverageReserve`/`Mark`/`useMyLeveragePositions`, `usePrivateDesk`/`Budget`/`Slot`, `useArenaState`/`Match`/`Credit`/`Quote` |
| After writes | `invalidateAfterWrite(scope)` |

**Transport**

Polling constants (`packages/core/src/constants`):

| Constant | Value |
|---|---|
| `MARKETS_POLL_MS` | 15s |
| `PRICE_POLL_MS`, `ONCHAIN_POLL_MS` | 5s |
| `OPENING_PRINT_POLL_MS`, `VERDICT_POLL_MS` | 3s |
| `CLOCK_RESYNC_MS` | 60s |
| `SETTLED_HISTORY_POLL_MS` | 300s |
| `REQUOTE_MS` | 12s |
| `QUOTE_DEBOUNCE_MS` | 350ms |
| `QUOTE_STALE_AFTER_MS` | 20s |
| `PRICE_STALE_AFTER_MS` | 15s |
| `ENTRY_BUFFER_SEC` | 30 |

Other channels:
- WebSocket: the SDK's `useWatchPrice`/`useLivePrice` feed `useAssetPrice` (falls back to polling). `useBook` subscribes via `runtime/coordinator` (`subscribeBook`, `useSyncExternalStore`).
- The duel room opens `new WebSocket` to `services/ops` (`useDuelRoom.ts`).
- The Room polls with `setInterval` (`useRoom.ts`). Takes and strategies use TanStack polling (30s). **No SSE.**

**The seam (`packages/core/src/ports/`)**
- `MarketsProvider` (`markets-provider.ts`): `listLiveLanes`, `getMarket`, `listSettled`, `getOnchain`, `getBookDepth`, `getBookParams`, `freshQuoteStake`, `getOpeningPrice`, `getAssetPrice`, `getPriceHistory`, `settlementFeeBps`, `listOpenPositions`, `getHoldings`, `listClaimables`, `listWalletHistory`, `getBalanceSheet`, `syncClock`, `nowMs`, `nextWindow`, `getResolution`, `getVaultSnapshot`, `getVaultHoldings`.
- `Submitter` (`submitter.ts`):
  - `submitOrder(OrderRequest, onPhase)`, `submitTx(TxIntent, onPhase)`, `hasSigner()`.
  - `OrderRoute` = `wallet | vault | vault-grant{grantId}`.
  - `WritePhase` = `composing | submitted | confirming | confirmed | reverted | unknown`.
  - `TxIntent` is a union of Vault / Strategy / Parlay / Range / Maker / Leverage / Private / Arena intents.
  - Also: `StopGate`, `IntentJournal` (`record/markSent/markConfirmed/markFailed/markUnknown/listUnresolved`), `AttributionHook`.
- Domain types (`core/types`): `EventMarket`, `Lane`, `LaneSet`, `OnchainSnapshot`, `Quote`, `BookDepth`, `BookParams`, `OpenPosition`, `Holdings`, `ClaimableRow`, `BalanceSheet`, `Verdict`, `AssetPrice`, `PricePoint`, `ClockSync`, `Resolution`, `Side "up"|"down"`, `IndexedStatus`, `DiagnosisKind`.
- **`Hex`/`Address`/`Bytes32` are 0x-hex EVM shapes and appear throughout.**

**Root `@masayume/markets` symbols used by web** (by call count): `marketsProvider` 20, `ensureMarkets` 15, `parseMarketsEnv` 9, `requiredGasWei` 6, then `SubmitterSession`, `loadCollateral`, `getClient`, `withReading`, `PINNED_TESTNET`, `generateSessionKey`, `createSessionKeySession`, `createLocalStorageJournal`, `recoverUnresolved`, `chainReconciler`, `executeSponsored`, `readVenueBoard`, `sessionGasTopUpWei`.

Subpaths: `/private`, `/strategies`, `/vault`, `/games`, `/identity` (`ORACLE_PRICE_SCALE`, `PRICE_BASIS`), `/runtime`, `/perf`, `/faucet`, `/chain`, `/env`.

**The 32 web files that import wagmi, viem or RainbowKit directly** (grouping is [I] from names and imports)

| Group | Files |
|---|---|
| Wallet shell (7) | `providers/{AppProviders,UserSessionProvider,rainbowkit-theme,wagmi}.ts(x)`, `lib/wallet-session.ts`, `components/shell/header/HeaderAccount.tsx`, `features/markets/wallet/ConnectButton.tsx` |
| Server signature verify via viem `verifyMessage` (6) | `app/api/private/open/route.ts`, `app/api/strategies/playbook/route.ts`, `features/room/gate.server.ts`, `features/takes/verify.server.ts`, `features/x/gate.server.ts`, `features/games/room-token.server.ts` |
| Client message signing (5) | `features/room/useRoom.ts`, `features/takes/useTakes.ts`, `features/x/{useXGrant,useXStatus}.ts`, `features/games/lucky/useLuckyCheck.ts` |
| Server signers and keys (4) | `app/api/sponsor/route.ts`, `features/games/sponsor.server.ts`, `features/funding/faucet-config.server.ts`, `features/games/lucky/lucky.server.ts` |
| Feature write hooks (9) | `features/games/duel/{useArenaWrites,useDuelRoom,useGameKey}.ts`, `features/leverage/useLeverageWrites.ts`, `features/markets/faucet/useFaucet.ts`, `features/parlay/useParlayWrites.ts`, `features/private/usePrivateOpen.ts`, `features/range/useRangeWrites.ts`, `features/strategies/useDeskWrites.ts` |
| Dev fixture (1) | `app/dev/private/fixtures.ts` |

## 6. API routes (`web/src/app/api`, 39 handlers) [C]

Almost all use `runtime="nodejs"` and `force-dynamic`.

| Route | Methods | Purpose | Depends on |
|---|---|---|---|
| `faucet/challenge` | POST | signed faucet challenge | DB |
| `faucet` | GET/POST | STT top-up + status | DB, `STT_FAUCET_PRIVATE_KEY`, RPC |
| `games/arcade/board` | GET | arcade leaderboard | DB |
| `games/arcade/score` | POST | submit arcade score | DB |
| `games/history` | GET | duel match history | DB |
| `games/lucky/commit` | POST | commit server seed | DB |
| `games/lucky/reveal` | POST | reveal draw | DB, markets |
| `games/lucky/placed` | POST | confirm placement | DB, markets |
| `games/lucky/board`, `games/lucky/history` | GET | Lucky board and history | DB, markets |
| `games/occupancy` | GET | room occupancy | ops room [I] |
| `games/rank` | GET | Elo ladder + season eligibility | DB |
| `games/room-token` | GET/POST | mint/renew duel WebSocket token | `ROOM_TOKEN_SECRET`, signature |
| `games/season` | GET | season view | env, markets |
| `games/sponsor` | GET/POST | fund seat key gas | `SPONSOR_PRIVATE_KEY` |
| `leaderboard` | GET | 24h venue board | indexer |
| `traction` | GET | stats (same `readBoard`) | indexer |
| `news` | GET | RSS lead + wire, regex sentiment | Cointelegraph/Decrypt RSS, revalidate 300 |
| `private/open` | POST | open private bet | viem verify, `PRIVATE_DESK_PRIVATE_KEY`, sponsor gate |
| `private/cashout` | POST | cash out private bet | desk key |
| `private/status` | GET | desk health | desk key |
| `room` | GET/POST | comments | DB, token |
| `room/join` | POST | signed join, holds-position gate | DB, markets |
| `room/bet` | GET/POST | record bettor | DB, markets |
| `room/status` | GET | room status | DB |
| `sensei` | POST | chat reply via `generateText` (not streaming) | AI |
| `sponsor` | GET/POST | forwarder-sponsored `placeFor` | `SPONSOR_PRIVATE_KEY`, RPC |
| `status` | GET | probes: RPC, indexer, price, store, Sensei | all |
| `strategies` | GET | catalogue (registry via markets) | markets |
| `strategies/health` | GET | runner health | DB |
| `strategies/playbook` | POST | signed playbook upsert | DB, viem |
| `strategies/preview` | POST | agent dry read | AI |
| `takes` | GET/POST | signed takes | DB, markets |
| `x/start`, `x/callback` | GET | OAuth 1.0a | X API keys, cookies |
| `x/bind`, `x/unlink` | POST | signed wallet link / revoke | DB |
| `x/status` | GET | link + relay health | DB |
| `x/receipts` | GET | relay receipts | DB |

## 7. Environment variables [C]

Sources: grep of `process.env` plus `web/.env.example`. Everything is optional; the app boots on baked-in Shannon defaults.

**Public (chain)**
- `NEXT_PUBLIC_CHAIN_ID`, `_INDEXER_URL`, `_RPC_WS_URLS`, `_RPC_HTTP_URLS`, `_VENUE_ID`, `_PRICE_FEED_URL`, `_PRICE_FEED_QUOTE`.
- Address and from-block overrides: `_EVENT_VAULT_ADDRESS/_FROM_BLOCK`, `_FORWARDER_ADDRESS`, `_{PARLAY,RANGE}_RESERVE_*`, `_MARKET_MAKER_VAULT_*`, `_LEVERAGE_RESERVE_*`, `_PRIVATE_DESK_*`.
- Parsed by `packages/markets/src/env.ts` via `web/src/lib/env.ts` → `webEnv`.

**Public (app):** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `_APP_ORIGIN`, `_DOCS_URL`, `_X_HANDLE`, `_X_EXECUTOR_ADDRESS`.

**Server**

| Group | Variables |
|---|---|
| AI | `AI_MODEL` (default `anthropic/claude-opus-5`), `AI_BASE_URL` + `AI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GATEWAY_API_KEY` |
| DB / social | `DATABASE_URL`, `ROOM_TOKEN_SECRET`, `GAME_ROOM_PUBLIC_URL`, `SEASON_ID/NAME/ENDS_AT/PRIZE_SPLIT/MIN_STAKED_DUELS/ELIGIBILITY_NOTE` (in `.env.example`), `SEASON_ADMIN_PRIVATE_KEY` |
| Signers | `SPONSOR_PRIVATE_KEY`, `SPONSOR_RPC_URL`, `SPONSOR_PER_ADDRESS_PER_HOUR`, `SPONSOR_PER_DEVICE_PER_HOUR`, `SPONSOR_MAX_GAS`, `SPONSOR_GAME_MAX_WEI`, `STT_FAUCET_PRIVATE_KEY`, `STT_FAUCET_RPC_URL`, `PRIVATE_DESK_PRIVATE_KEY`, `PRIVATE_DESK_RPC_URL`, `STRATEGY_RUNNER_ADDRESS` |
| X | `X_API_KEY`, `X_API_KEY_SECRET`, `X_REDIRECT_URI`, `X_SESSION_SECRET`, `X_EXECUTOR_ADDRESS` |
| Flags | `STT_FAUCET_ENABLED` (must be exactly `true`), `X_POSTING_ENABLED`, `X_REPLY_IMAGES_ENABLED`, `DRY_RUN` |
| Platform | `VERCEL`, `NODE_ENV` |

**Ops-only (`services/ops`):** `RUNNER_PRIVATE_KEY`, `STRATEGY_IDS`, `RUNNER_INTERVAL_MS`, `AGENT_MAX_CALLS_PER_HOUR`, `AGENT_TIMEOUT_MS`, `X_RETTIWT_API_KEY`, `X_HANDLE`, `X_EXECUTOR_PRIVATE_KEY`, `X_POLL_MS`, `GAME_ROOM_HOST/PORT/REGION`, `GAME_DECK_KEY/JOURNAL/HORIZON_SEC`, `GAME_SETTLER_PRIVATE_KEY/REFRESH_MS`, `GAME_PROJECTOR_POLL_MS/SPAN/SPANS/FROM`, `WEB_URL`, `ADMIN_KEY`.

There are no analytics env vars.

## 8. Conventions [C]

**File sizes**
- 1,184 TS files across web and packages: 56 over 200 lines, 12 over 300, 2 over 350, **0 over 400** (enforced).
- Counting CSS too, 41 files exceed 300 lines.
- The 20 largest TS files:

| Lines | File |
|---|---|
| 398 | `features/games/duel/useDuelRoom.ts` |
| 360 | `lib/copy.ts` |
| 348 | `db/games.ts` |
| 338 | `duel/DuelPicking.tsx` |
| 337 | `duel/DuelStage.tsx` |
| 334 | `shell/header/nav-items.ts` |
| 329 | `games/stage/SwipeDeck.tsx` |
| 325 | `duel/copy.ts` |
| 315 | `games/audio.ts` |
| 309 | `markets/ticket/Ticket.tsx` |
| 305 | `markets/vault/write.ts` |
| 302 | `pitch/slides-a.tsx` |
| 299 | `share/canvas.ts` |
| 295 | `core/games/protocol.ts` |
| 293 | `db/schema-games.ts` |
| 289 | `markets/range/read.ts` |
| 285 | `db/x.ts` |
| 277 | `duel/DuelResult.tsx` |
| 268 | `core/games/arcade/ride.ts` |
| 267 | `strategies/copy.ts` |

**Folder pattern**
- A feature folder holds: `index.ts` barrels; `copy.ts` for all UI strings (`BRAND` lives in `lib/copy.ts`); `protocol.ts` for zod request schemas shared by client and route; `*.server.ts` for server-only logic called by thin routes; `use*.ts` hooks; co-located `*.test.ts`.
- Components are PascalCase `.tsx`. Import alias `@/*`.

**`pnpm invariants`** (`scripts/invariants/rules.mjs`, `run.mjs`)
1. `sdk-import-boundary`: only `packages/markets` may import `@somnia-chain/*`.
2. `write-boundary`: no `writeContract`/`sendTransaction`/`sendRawTransaction` outside `packages/markets`.
3. `banned-wagmi-hooks`: `useBalance`, `useReadContract(s)`, `usePublicClient`, `useClient`, `useBlockNumber`, `useWatchContractEvent` banned in `web/src` and `services`.
4. `design-literals`: no hex colors or `px` literals in TS under app/components/features/providers.
5. `time-suffix`: time fields end in `Ms`/`Sec`/`Ns` in core/markets/services.
6. `no-float-money` (warning): no `parseFloat`/`Number(` on amounts.
7. `file-length`: max 400 lines for TS, MJS, CSS and Solidity.
8. `generated-abi` header.
9. `vault-abi-shape`: no pool address in events, no withdraw taking an address.
10. `sdk-version-pin`: exactly 0.28.1 in `package.json` and lockfile.
11. `address-drift`: pinned addresses match the SDK.
12. `order-lane-ioc`: `ORDER_TYPE.MARKET` only.
13. `status-gate-enum`.
14. `expiry-from-headroom`.

`pnpm ci` runs typecheck → invariants → tests.

**Strictness:** `tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, target ES2022, Bundler resolution. **No ESLint, Biome or Prettier config** at root or in web.

## 9. Packages [C]

### `packages/core`
- Zod is its only dependency. 133 non-test files, 8,989 L, plus 42 tests. Exports `.` and `./*` → `src/*/index.ts`.
- Module line counts:

| Group | Modules |
|---|---|
| Games | `games` 3,483, covering arena, commitment, deck, lifecycle, limits, lucky, matchmaking, picking, practice, projection, protocol, rating, room-token, scoring, season, wire, and `arcade/` (799: field, flap, ride, replay, rng, trace) |
| Projection | `projection` 741: badges, csv, edge, equity, leaderboard, ledger, reputation, settle |
| Strategies | `strategies` 642: `spec`, `agent`, `agent-prompt`, `model`, `ranking`, `record`, `health` |
| Products | `range` 457 (+ `pricing.vectors.json`), `parlay` 286, `private` 278, `surface` 251, `leverage` 241, `maker` 157, `vault` 146, `claims` 130, `faucet` 70 |
| Social | `x` 350: `parse`, `grant-policy`, `receipt`, `refusal`, `link`, `window` |
| Foundation | `copy` 375, `types` 320, `ports` 235, `units` 180 (money, decimals, bps, format, time), `market` 164 (horizons, lanes, drift, distance), `lifecycle` 136 (phase, headroom, countdown, urgency), `constants` 135, `sizing` 67, `schemas` 64 (`Reading`), `urls` 63 (explorer URLs) |

- **No chain library imports, but EVM-shaped:**
  - 0x `Hex`/`Address`/`Bytes32` types appear across modules.
  - 14 games files are EVM-shaped.
  - 14 lines name Somnia/DreamDEX/STT (`constants` `STT_FAUCETS`, `copy`).
  - `lifecycle`, `market`, `schemas` and `sizing` have zero matches, making them the most portable [C grep; exact per-file semantics I].

### `packages/brain`
- 4 files, 252 L. Depends on `ai`, the three `@ai-sdk/*` providers, and core.
- `model.ts`: `resolveModel()` tries a custom endpoint, then a direct provider key, then the gateway. Also `missingCredentialHint()` and `DEFAULT_AI_MODEL`.
- `agent-read.ts`: `readAgentVerdict`, 20s timeout. `agent-decide.ts`.
- Prompts live elsewhere:
  - Sensei's `SENSEI_SYSTEM`, including "THE BRAKE" and the Somnia/DreamDEX/testnet wording, is in `web/src/features/sensei/prompt.ts`.
  - The agent prompt `agentPrompt(spec, context, record)` is in `core/strategies/agent-prompt.ts`.
  - Specs `PRESETS`, `encodeSpec`, `describeSpec(s, asset="BTC")` are in `core/strategies/spec.ts`.

### `packages/db`
- 23 files, 2,561 L; postgres.js + zod only.
- `getDb()` returns `null` when `DATABASE_URL` is unset. Pool max 4; SSL unless localhost.
- `ensureSchema()` runs idempotent `CREATE TABLE IF NOT EXISTS` on first use, under an advisory lock. **No migration tool.**
- Tables:

| File | Tables |
|---|---|
| `schema.ts` | `room_comments`, `takes`, `bettors` |
| `schema-faucet.ts` | `faucet_challenges`, `faucet_claims` |
| `schema-games.ts` | `game_profiles`, `game_settings`, `game_follows`, `game_ratings`, `game_rating_events`, `duel_matches`, `duel_cards`, `game_cursors`, `duel_decks`, `arcade_scores`, `lucky_draws` |
| `schema-strategies.ts` | `runner_heartbeats`, `strategy_fills`, `strategy_playbooks`, `strategy_decisions`, `strategy_attempts` |
| `schema-x.ts` | `x_links`, `x_receipts`, `x_relay_state` |
| `schema-x-delivery.ts` | `x_reply_delivery` |

### `packages/markets`
- 162 files, 10,556 L. The only package that touches the SDK and viem.
- Subpath exports: `.`, `/chain`, `/env`, `/faucet`, `/games`, `/identity`, `/leverage`, `/maker`, `/parlay`, `/perf`, `/private`, `/range`, `/react`, `/runtime`, `/sessions`, `/strategies`, `/vault`, `/x`.
- Internals by line count:
  - `provider/` 1,230: the `MarketsProvider` implementation.
  - `vault/` 1,103, `games/` 885, `react/` 828.
  - `submitter/` 813: journal, recovery, order-lane, tx-lane, steps.
  - `private/` 751, `range/` 731.
  - `contracts/` 641: generated ABIs.
  - `runtime/` 564: read runtime, book coordinator, endpoint health.
  - `leverage/` 509, `parlay/` 507, `strategies/` 434, `maker/` 423.
  - `sessions/` 326: `session-key`, `nonce-queue`, `authority`.
  - `mappers/` 312.

**Porting takeaway [I]**
- **Stable seam to keep:** `core/ports`, the `@masayume/markets/react` hook names, `Reading<T>`, and the query-key families.
- **What the Solana adapter must replace:** the primitive types (`Hex`/`Address`) and the 32 wallet-coupled web files.
