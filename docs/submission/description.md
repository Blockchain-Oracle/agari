# Agari

Agari (上がり — "rising", also a winning hand) is a stock-price Up/Down prediction market on Solana, built as a source-led port of [Masayume](https://github.com/Blockchain-Oracle/masayume) for the Stocklana hackathon brief: make owning and using tokenized stocks better.

## The problem

About 63% of tokenized-stock trading volume happens while the underlying US exchange is closed, because a tokenized-stock holder (xStocks, Ondo, Backpack) has no on-chain way to express a short-horizon view or hedge a position without selling it. Agari gives that holder three things a sell doesn't: a way to protect a holding without giving it up, a way to take a capped-risk view on a stock they already own over a 5-to-60-minute Window, and a lane that trades on weekends and overnight when US exchanges are shut (`docs/plan/00-plan.md` §0).

## What works today

Everything below is a confirmed devnet transaction, not a claim — see the `README.md` "Proven on-chain" table and `docs/plan/acceptance.md` for every signature and explorer link.

- **A from-scratch Anchor order book (`agari-events`)** deployed to devnet, implementing DreamDEX Event Contracts' exact matching semantics: four-path fills (direct, mint-pair, burn-pair), price-time priority, PostOnly/IOC/FOK order types, expiry, and per-Window settlement.
- **On-chain price verification, not a trusted API read.** A Window settles only once a signed print is verified in-program: Pyth's pull oracle (Wormhole-guardian verified) for TSLA/QQQ/VOO, RedStone's public signed packages (≥ 3 of 5 configured signers, all 5 for the first 5 minutes) for seven more names, and a TSLA cross-check between the two that voids the Window if they diverge.
- **A real, end-to-end devnet trading cycle**, recorded transaction by transaction: a Window opens, a price prints, orders mint a complete pair, fill directly and burn a pair back out, the Window settles from the print (or voids honestly when a print never arrives or the two sources disagree), and redemption pays exactly what the settled Window owes each seat.
- **27 Series across 9 tickers** (TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL, QQQ, VOO) at 5m/15m/60m cadences, 54 order books, a devnet tUSDC test-collateral mint, and the operational roles (roller, settler, price-relay, seed maker) funded and running.
- **A first end-to-end call on devnet** by a Wallet Standard wallet (Phantom): connect, get test funds, take a call quoted off the live book, see it settle and claim (S4, M1).
- **Trading Balance and tap-trading (S7):** a session-key grant that lets a user place several trades with zero wallet popups, fee-sponsored under a strict, capped allowlist that never touches user funds.
- **Session lanes (S6):** a Monday Gap Window that spans Friday's close to Monday's open, and a 24/7 token lane priced from Switchboard On-Demand.
- **Proof, social and always-on surfaces (S5, S13, S18):** portfolio, leaderboard and stats reading real devnet data; Sensei, Takes and The Room; and a market that never looks empty when the NYSE is closed — last price, last session, a countdown to the next Window, and a pre-open "schedule a call" path that rests until the bell.

## What is deferred

Cut for the 2026-09-18 deadline, recorded as `D-084`: **Earn** (the maker vault as a public supply-side reserve), **agents and copy trading**, **specialist tickets** (Range, Boost, Parlay, Private), **trade-from-X**, **the games programs** (Duel, Practice, Lucky Draw, Line Rider, Candle Hop, Moonshot), and the **yield / inverse-position add-ons**. Their web surfaces exist in this tree and render an honest "not live" state rather than a half-built flow; none of them is wired to a deployed program.

## Team

**Abubakr Jimoh** (solo), architecting the build across resumable stages (`docs/plan/00-plan.md`) and working with a fleet of Claude Code agents running the implementation, deploy and verification steps stage by stage. Every devnet transaction and every architectural decision is recorded — `docs/plan/acceptance.md` and `docs/plan/decisions.md` — as the record of that process, not just its result.

## Links

| What | Where |
| --- | --- |
| Source | No GitHub remote is configured for this tree yet (`git remote -v` is empty); a repository and its visibility are pending the public-release decision (`public-release-audit.md`, `Q-007`) |
| App | Not deployed publicly yet; runs at `pnpm dev` on `localhost:3000` (S16 decides the public deploy) |
| Documentation | `agari-docs` — deployed URL pending the user's go (`Q-S15-1`) |
| Demo video | Pending — recording Wed 2026-09-16 after the NYSE bell (`D-097`); `/demo` shows the honest "recording" state with a live proof table until then |
| Social | Not yet created for Agari |
