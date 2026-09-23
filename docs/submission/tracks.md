# How Agari uses PreStocks and Pyth

Written 2026-09-23 for the two bounty tracks Agari claims. Every sentence below points at its evidence: a dated row in
`docs/plan/acceptance.md` (the append-only ledger of every devnet transaction, failures included) or a commit in this
repository. Where something is built but not yet proven on chain, it says so. Words: a **Window** is one Up/Down
round on one price; a **print** is the signed price a Window opens and closes on; **cover** is a Down bet a holder
takes as insurance on something they hold; **test money** is devnet tUSDC; the **desk** is the one place real money
moves, on Solana mainnet.

## How Agari uses PreStocks

**Agari runs prediction markets on PreStocks prices, and only PreStocks prices, for pre-IPO names.** The venue
reads `prestocks.com/api/prestocks`, signs each boundary price with its own attestor key, and the `agari-events`
program verifies that signature before it records the print (D-100, D-101). No other pre-IPO token or issuer is
integrated anywhere in the code; the checklist records the eligibility rule and why Tessera is excluded by it.

1. **The 24/7 OPENAI lane.** `OPENAI-60m` is a one-hour Up/Down Window on the OpenAI token price that runs every
   hour of every day, opened and rolled by the venue's own roller with no script. Evidence: Series registered
   2026-09-19 10:34Z; first Window opened unattended 10:58Z; its opening print signed from the catalogue inside the
   admission window at 11:00:21Z; the house maker quoted it two-sided; the Window settled UP at 12:00Z and the lane
   rolled itself to #1 (rows 2026-09-19 10:34–12:00Z). It has carried real product flow since: boosts, shorts, Lucky
   spins, parlay legs and agent trades all ran on it (rows 2026-09-20 to 2026-09-22 naming `OPENAI-60m`).
2. **Cover what you hold.** Connect a wallet and Agari reads its PreStocks holdings by mint (read-only, mainnet) and
   offers a Down bet as insurance on what it finds. Evidence: a fresh wallet bought DOWN on `OPENAI-60m` #0 as a
   holder covering OpenAI tokens, on a Saturday, 1,000 lots at 14.4¢ (row 2026-09-19 11:31Z); the Window then closed
   up, the cover lost its 14.4¢ premium while the tokens gained 0.79 %, which is what cover is for (row 12:00Z).
3. **Baskets: predict, cover and hold a group.** A basket is a named group of PreStocks names scored as one
   equal-weight index in points, base 1,000 at frozen base prices, computed from one catalogue read of every member
   (a Window voids rather than settle on a partial read). Five baskets: **AI Labs** (OpenAI, Anthropic), **Frontier
   AI** (+ Figure AI, Neuralink), **Prediction Markets** (Kalshi, Polymarket), **Defense & Space** (Anduril, SpaceX),
   **All PreStocks** (all eight). Evidence: D-124; the five Series registered 2026-09-22 18:59–19:00Z (`AILABS-60m`
   `ErcdJqDD…`, `PREALL-60m` `8DeoK3xf…`, `FRONTIER-60m` `2GQ45Moq…`, `PREDMKTS-60m` `F7zYr5nR…`, `DEFSPACE-60m`
   `FQYnXDAs…`; addresses in `scripts/deploy/addresses.devnet.json`); every first Window printed both boundaries and
   settled at 20:00Z with no void (AI Labs 1,267.38 → 1,110.43 pts DOWN; All PreStocks 1,065.27 → 1,019.82 DOWN;
   Frontier 1,134.21 → 1,044.27 DOWN; Prediction Markets 1,011.73 → 1,002.68 DOWN; Defense & Space 980.93 → 988.06 UP),
   and the lanes have settled hourly since (rows 2026-09-22 20:07Z; the AI Labs row records #1 settling at 21:00Z and
   the house maker resting on every basket book). A holder of two or more members is offered one cover bet on the
   basket (`0d2ffbe`); `/baskets` and each basket's hub show the members, the index and the live Window (`6d05390`).
4. **The desk: a basket held for you, inside limits the program enforces.** You decide what to own (a basket preset,
   a cash sleeve, limits) and sign every owner call with your wallet; the desk decides only *when*; the `agari-desk`
   program checks every operator action in a fixed order (caps per action and per day, the allowed names, a fresh
   venue-attested reference, a premium ceiling over the PreStocks mark, an 8 % band on what must come back, an exact-
   spend check, a leak check) and seals a hash of every decision, including "did nothing", in the same transaction
   (D-126, `docs/plan/specs/desk.md`). Practice desks move no money and need no eligibility: anyone runs the whole
   pipeline on real prices and real Jupiter quotes. Evidence: the program `1528b2e`; the whole desk rehearsed on a
   Surfpool fork of Solana mainnet on 2026-09-22 with 31/31 checks (`ce24370`; rows 23:49–23:54Z): deployed for
   3.371 SOL rent, a desk opened and funded with 1,000 USDC, two real buys through the Jupiter CPI (OpenAI $400 →
   0.217193247 raw via Manifest; Anthropic $398.42 → 0.378220907 raw via Meteora DLMM), a sell, a checkpoint, a
   whole-balance withdrawal to the owner's own accounts only, and nine forced refusals each landed as a failed
   transaction (over the per-action cap, over the daily cap, below the oracle floor, premium too high, shadow mode,
   paused, an unknown attestor, a stranger's withdrawal, a stale reference). The first practice desk on production
   `useagari.xyz` (owner `EfTzYtM22yPbriCaFaKEK7pMrWoEfmFoqNtp8vDELmgp`, desk `49f67e4d-dab7-4eb4-9882-2d2a2e80a511`)
   wrote its first record as "DECLINED: OpenAI is 21.3% above its mark. Your ceiling is 10.0%." with no model call
   (D-126 evidence paragraph; `1b4ca1c`). **Not yet:** the mainnet deploy (program id
   `4gAfiRauANHVajpErqCey7iWGbKkyuSsnXLRbApVaWak`, ≈ 3.37 SOL rent) and the builder's own live desk are his spend and
   have not happened; no real money has moved through a desk.
5. **PreStocks-only data on every pre-IPO page.** The SPV's mark price, the token's premium or discount to it and the
   holder count, from the PreStocks catalogue (`web/src/features/ticker-hub/PreIpoStats.tsx`, `usePreIpoFacts.ts`).
   The desk measures its premium ceiling against that same mark. Token facts the desk was built on, measured on the
   fork: Token-2022 with a 100 bps transfer fee and ScaledUiAmount; Jupiter routes through Manifest and Meteora DLMM,
   and whether a quote nets the fee depends on the venue (Meteora nets it, Manifest quotes gross; row 23:51Z).

## How Agari uses Pyth

**Pyth is a settlement-grade source in the venue, not a display feed.** A TSLA, QQQ or VOO Window settles only once a
Pyth pull-oracle update for the exact boundary second is verified in the program (`public_record_print_pyth`); the
app never settles on a "latest" read.

1. **Prints verified on chain, cross-checked, void on divergence.** TSLA's policy names RedStone as the check source:
   both boundaries are compared and a gap wider than 25 bps voids the Window instead of paying anyone. Evidence: the
   cross-check settle TSLA → Up, Pyth 358.20432 → 358.75 confirmed by RedStone (row 2026-09-14 14:45Z, `xjKyBjRk…`);
   a `CrossCheckDivergence` void when the attested price sat 1 % off RedStone (same row set, `24R75m6P…`); a
   `MissingPrint` void when no print arrived in time (`3p3AwjvW…`). The Pyth trial key also drives the price relay
   (`services/ops/src/actors/price-relay/hermes-fetch.ts`), the halt watch (`halt-watch/signals.ts`) and the market
   calendar (`packages/core/src/market/pyth-schedule.ts`).
2. **The proof replay.** `/proof` shows every print a Window settled on with its source and signer count, and
   "Re-verify on devnet" posts the archived Pyth update again from the browser as the `proof-replay` role, quota-
   limited, so a reader can watch the same bytes verify without trusting the venue (`web/src/features/proof/
   ReverifyButton.tsx`, `PythReplayRows.tsx`, `replay.server.ts`). The payer role is funded (row 2026-09-15 06:05Z);
   a replay transaction has not been recorded in the ledger yet.
3. **Pyth's pre-IPO valuation indices: wired and gated.** Pyth publishes `Equity.Index.OPENAI/USD` and
   `Equity.Index.ANTHROPIC/USD` around the clock (since 2026-09-17). Agari carries a **valuation lane** per name
   (`OPENAIV-60m`, `ANTHROPICV-60m`) that settles on Pyth directly, on the same on-chain path as TSLA; the OpenAI and
   Anthropic hubs compare the PreStocks token price with the index; and the desk's owner can require the index as the
   premium reference (`require_pyth_index`: every buy then carries a fully verified `PriceUpdateV2` no older than
   60 s, and the ceiling is measured against the index instead of the mark). Evidence: D-125; the lanes `d322124`,
   the entitlement store and probe `0155019`, the hub `ac34765`, the desk leg `1528b2e`. The venue's trial key is
   refused for both feeds (403, group `pyth-indices`, verified 2026-09-22 by hand and by the dry ops boot), so today
   the hourly probe records them as denied, the roller lists nothing on them, the deploy script refuses to register
   them, and the pages omit the rows rather than show a dead lane. A refusal on an index never touches the trial
   feeds: TSLA, QQQ and VOO keep settling.
4. **What switches on with a `pyth-indices` key, with no code change or program upgrade:** the registration script (`init-valuation-series`) then accepts the two valuation Series, and they list at the next hourly
   probe; the hubs show "Pyth index" and "Token vs Pyth"; the desk's premium ceiling can be measured against an
   independent reference instead of the venue's own attested mark, which is the one leg of the desk's trust boundary
   that does not depend on Agari's keys (D-126). Asking Pyth for the group is the builder's call.

**After the hackathon.** The app runs on its own host (`useagari.xyz`, web and ops on Coolify) with the roller,
relay, settler, maker and desk-runner as always-on actors; the OPENAI lane and the five basket lanes settle every hour
without anyone at a keyboard. Pyth Pro access would move the equity lanes off a 14-day trial that ends about
2026-09-27 and let the valuation lanes list.
