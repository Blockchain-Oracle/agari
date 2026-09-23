# S23 — Markets that make sense when the stock market is closed; shorts, baskets, games, copy trading, the private balance

**Goal:** the user's overnight test on 2026-09-23 (market closed) found 24/7 token lanes shown as stock windows on empty books, a shorts page with no logos, basket cards that stack and jump, duel copy that is wrong out of hours, a copy-trading form that disables itself silently, the runner's "indexer unreachable", and a private balance that cannot take a second deposit. Plan: `~/.claude/plans/vectorized-dazzling-fairy.md` (S23 revision). Lanes `../agari-wt/s23{a,b,c,d}` on `slice/S23{a,b,c,d}`.

## Steps

- [ ] **a markets** (`feat(S23.a/…)`): word board session + lane rule, Schedule a call for upcoming stock Windows, 24/7 chips and logos, empty-book state and Max on the ticket, the token maker's overnight quotes; the sweep across lanes, hub, hedge, Boost, parlay, range, reels, Sensei, marquee, notifications, the halted xStocks lanes.
- [ ] **b shorts + baskets** (`feat(S23.b/web)`): `/short` redesign (logo cards, cadences, closed state, plain thin-book state); `/baskets` card rebuild and the hub table.
- [ ] **c games** (`feat(S23.c/…)`): duel/practice/Lucky/hub read the session; `nextDealableSec` stops at the close; the matchmaker deals only quoted books; weekday on "Opens".
- [ ] **d copy + balance** (`feat(S23.d/…)`): copy drawer validation, Max, balance strip, inline deposit, state fixes; private balance and Trading Balance buttons; the runner's indexer URL.
- [ ] **gate** : merge, web + ops deploys, live capture, after-close capture.
