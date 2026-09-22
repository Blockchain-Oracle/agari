# Agari

Agari (上がり — "rising", also a winning hand) is a stock-price Up/Down prediction market on Solana, built as a source-led port of [Masayume](https://github.com/Blockchain-Oracle/masayume) for the Stocklana hackathon brief: make owning and using tokenized stocks better.

## The problem

About 63% of tokenized-stock trading volume happens while the underlying US exchange is closed, because a tokenized-stock holder (xStocks, Ondo, Backpack) has no on-chain way to express a short-horizon view or cover a position without selling it. Agari gives that holder three things a sell doesn't: a way to protect a holding without giving it up, a way to take a capped-risk view on a stock they already own over a 5-to-60-minute Window, and a lane that trades on weekends and overnight when US exchanges are shut (`docs/plan/00-plan.md` §0).

The second user is the **holder of pre-IPO tokens** on PreStocks (OpenAI, Anthropic, SpaceX and five more). They follow those companies as a group, not one at a time, and they hold a token that trades at a premium or discount to what the issuer says it is worth. They want three things nobody offers them on chain: to predict the group, to cover the members they hold, and to have a basket of those tokens **held for them** under limits they set, by something that explains itself and cannot take their money. That is what baskets and the desk are for.

## The story of Ada

Ada is a made-up holder; every step she takes exists in the product, and the two that move real money have run on a fork of Solana mainnet rather than on mainnet itself (the mainnet deploy is pending). Ada in Lagos holds 4.2 OpenAI PreStocks tokens in Phantom. She likes AI but not the 15% premium OpenAI trades at over its mark. She opens Agari, taps **Baskets → AI Labs → Hold**, keeps the preset (OpenAI and Anthropic, equal weight) and adds a 20% cash sleeve, then sets her limits in plain sentences: most in one action $50, most in a day $150, never buy a company more than 10% above what PreStocks says it is worth, stop everything after a fall of 15%. She starts in **Practice**: no money moves, but every hour her desk reads real prices and real Jupiter quotes at her size and writes down what it would have done. On day two she opens the record and sees "6 quiet checks", one "I waited: OpenAI is 15.1% above its mark. Your ceiling is 10%", and one "I would have bought $50 of Anthropic". She presses **Go live**; Phantom shows one **Solana mainnet** transaction that opens an account only she can withdraw from; she deposits $300 USDC and moves her 4.2 OpenAI in, with PreStocks' 1% transfer fee on the receipt before she confirms. From then on the desk checks hourly, asks her first (she chose "Ask me first"), tells her when it acts, and every decision has a **Check it** button that recomputes its fingerprint in her browser against the chain.

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
- **The 24/7 pre-IPO lane and cover (S18):** `OPENAI-60m` on PreStocks prices under the venue's own attestor signature, opened and rolled unattended since 2026-09-19; a holder's cover bet filled against the house maker on a Saturday and behaved like insurance at the close.
- **Baskets (S19, `D-124`):** five named groups of PreStocks names, each a 24/7 Window on an equal-weight index in points computed from one catalogue read of every member; all five registered on 2026-09-22 and their first Windows settled at 20:00Z with no void; one cover bet for a basket you hold.
- **The desk (S21, `D-126`):** an account on Solana that holds a basket for its owner inside limits the `agari-desk` program enforces, with every decision hashed on chain in the same transaction as the trade. Practice desks run on production today; the whole desk, two Jupiter buys and nine forced refusals included, was rehearsed on a Surfpool fork of Solana mainnet (31/31 checks). The mainnet deploy is pending the builder's funding.
- **Pyth's pre-IPO valuation indices (S20, `D-125`):** wired as a valuation lane per name, the hub's "Token vs Pyth" figure and the desk's optional premium reference, all gated on a live entitlement probe; unlisted until the venue's key may read them.

## What is not done

Nothing planned is deferred any more (`D-113` withdrew the `D-084` cuts): Earn, agents and copy trading, the specialist tickets, trade-from-X, the games and the yield and inverse-position add-ons each have their own devnet rows in the ledger (2026-09-19 to 2026-09-22). What remains: the desk's mainnet deploy and the builder's own live desk (his spend, `docs/plan/specs/desk.md` §10), the `pyth-indices` entitlement that would list the valuation lanes (Pyth's call), and the items under the README's "Honest limitations".

## Team

**Abubakr Jimoh** (solo), architecting the build across resumable stages (`docs/plan/00-plan.md`) and working with a fleet of Claude Code agents running the implementation, deploy and verification steps stage by stage. Every devnet transaction and every architectural decision is recorded — `docs/plan/acceptance.md` and `docs/plan/decisions.md` — as the record of that process, not just its result.

## Links

| What | Where |
| --- | --- |
| Source | No GitHub remote is configured for this tree yet (`git remote -v` is empty); a repository and its visibility are pending the public-release decision (`public-release-audit.md`, `Q-007`) |
| App | <https://useagari.xyz> (web and ops on Coolify, S16); also runs at `pnpm dev` on `localhost:3000` |
| Documentation | `agari-docs` — deployed URL pending the user's go (`Q-S15-1`) |
| Demo video | Pending — recording Wed 2026-09-16 after the NYSE bell (`D-097`); `/demo` shows the honest "recording" state with a live proof table until then |
| Social | Not yet created for Agari |
