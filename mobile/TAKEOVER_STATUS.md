# Mobile takeover status

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

## Remaining gates

1. **X sign-in and recovery for a new account:** the web OAuth callback writes an HTTP-only browser cookie. The native fetch session does not receive that cookie. Existing wallet bindings can be read, but new in-app X sign-in needs an explicit, secure server-to-app session handoff before this route can be called complete. No mobile-only cookie workaround is claimed.
2. **iOS journey acceptance:** inspect all listed routes and complete onboarding, ticket review, game rounds/results, portfolio/claim states, recovery, light/dark, larger text, and network errors on an unlocked simulator. So far the simulator installation and shell launch are confirmed; full routes are not.
3. **Physical-device checks:** Phantom/Solflare iOS approval, Android Mobile Wallet Adapter and wallet return, headset routing over wired and Bluetooth, silent switch, interruption and resume, and haptic feel require a compatible device or emulator and real wallet apps. No Android device or emulator was connected during this pass.
4. **Live chain acceptance:** no stake, trade, payout, claim, or recovery write was sent during this pass. Verify exact quotes, wallet approvals, receipts, and post-signing state on the intended devnet environment before release review.

Do not publish or claim release readiness while any gate above remains open.
