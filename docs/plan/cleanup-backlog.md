# Cleanup backlog

Things that are dead, stale or inconsistent but not breaking anything. **The user's rule: this is a
pass at the end, once every feature is built — not work to interleave.** Nothing here is a reason to
stop building. Add to it whenever a leftover is found; do not act on it out of turn.

Opened 2026-09-22.

## Dead vendor: Privy

Agari uses Wallet Standard, not Privy. The code agrees — **zero** references under `web/src`,
`packages/*/src` or `services/*/src`, and no `@privy-io/*` in any `package.json`. What survives is
configuration only:

- `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET` in the root `.env.local` and `web/.env.local`
  (and their copies on the `live` worktree).
- They were pushed to the `useagari` Vercel project on 2026-09-22 by copying `web/.env.local`
  wholesale, and **removed again the same hour** — the project carries no Privy variable now.

To do at cleanup: drop the four env entries, and check `.env.example` does not still document them.
Nothing in the build reads them, so removal cannot break a page.

## Stale bookkeeping

- `handoff-deferred-stages.md` still says "Remaining: S12a's off-chain games wherever they still run
  on stubs. The off-chain games are next." The games all went Done in the 09-20→21 session (hub,
  Practice, history, Lucky, Line Rider, Candle Hop, audio/settings, achievements). A fresh session
  reading that line would rebuild finished work.
- `STATUS.md` records the domain as `agari.live`, "bought and moving to Vercel DNS". The home is
  **useagari.xyz** as of 2026-09-22. Whether `agari.live` is still held is an open question for the user.
- `STATUS.md` says "GitHub repo (none exists)". `vercel link` connected
  `github.com/Blockchain-Oracle/agari`, so one does.
- The hourly health-check recipe names `s6/data/soak/ops-2026-09-15.log`, frozen since 09-19. The
  live log is `live/data/soak/ops-live.log`.

## Dead copy from the fixed-strike filter (found 2026-09-22)

`MARKETS.fixedStrikeHidden` in `web/src/lib/copy.ts` is the reference's `StrikeDisclosure` line. Agari's
venue has no fixed-strike Windows — `EventMarket` has no `isUpDown`, `groupIntoLanes` filters nothing — so
the component was rightly never ported and this string has no reader. Drop it at cleanup.
