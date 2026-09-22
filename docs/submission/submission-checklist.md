# Stocklana hackathon submission checklist

Updated **2026-09-23**. This is a preparation checklist, not a submission record: no BUIDL/entry has been submitted on any hackathon platform, and no submission acknowledgement exists.

## Deadline and requirements

Per `docs/plan/00-plan.md` §0 (Context): the Stocklana hackathon runs a **$126k prize pool, one main track plus five sponsor bounty tracks, no required SDK**. **Amended 2026-09-18:** the organisers added the bounty tracks (PreStocks $10k, Tessera $6k, Clawpump $5k, Meteora DBC $5k, Pyth non-cash) and raised the pool from $100k. **Amended 2026-09-18 (second):** they also moved the close from 09-18 to **Fri 2026-09-25 16:00 ET (20:00 UTC)**; edits are allowed until then. Agari claims two of them; see **Bounty tracks** below. Judging runs to **2026-10-02**. Judges ask four things: **a real user and problem, a working end-to-end demo, why Solana, and execution quality**.

This tree does not record the exact submission-platform URL, its form fields or an authenticated view of it (unlike Masayume's DoraHacks submission, which this checklist's structure is adapted from). Whoever completes the actual submission should recheck the platform's exact requirements immediately before submitting — not yet verified here.

## Bounty tracks

Claimed on the strength of work that is already on devnet, not of anything built to fit a track.

**Hard eligibility rule (PreStocks, quoted from the bounty):** *"projects that integrate any non-PreStocks pre-IPO
tokens will be ineligible for this bounty."* Tessera sells the same pre-IPO names (OpenAI, Kalshi, SpaceX), so the
two bounties are mutually exclusive: integrating Tessera would forfeit the $10k PreStocks track. Agari integrates
PreStocks only, and the Pre-IPO lane must stay that way. PreStocks pays three places: $5k / $3k / $2k.

| Track | Claim | Evidence |
| --- | --- | --- |
| **PreStocks** | Four things, all on PreStocks prices and nothing else (the judge-facing page is `docs/submission/tracks.md`). **(1)** The 24/7 `OPENAI-60m` lane: one-hour Up/Down Windows on the OpenAI token price, opened and rolled by the venue's roller unattended, printed at both boundaries from the PreStocks catalogue under the venue's attestor signature, quoted by the house maker, settled hourly since 2026-09-19. **(2) Cover what you hold:** a connected wallet's PreStocks holdings are read by mint and offered a Down bet as insurance; one filled on a Saturday and behaved like insurance when the Window closed up. **(3) Baskets** (`D-124`): five named groups (AI Labs, Frontier AI, Prediction Markets, Defense & Space, All PreStocks), each a 24/7 Window on an equal-weight index in points computed from one catalogue read of every member; a holder of two or more members is offered one cover bet on the basket; `/baskets` and each basket hub show the members, the index and the live Window. **(4) The desk** (`D-126`): an account on Solana that holds a basket for its owner inside limits the `agari-desk` program enforces (caps, allowed names, an attested reference, a premium ceiling over the PreStocks mark, an 8 % band, a hash chain of every decision); practice desks run the whole pipeline on real prices with no transaction; live desks are on Solana mainnet. PreStocks-only data (mark, premium, holders) is on every pre-IPO page. | Ledger rows: the lane 2026-09-19 10:34–12:00Z; the cover bet 2026-09-19 11:31Z and 12:00Z; the five basket registrations 2026-09-22 18:59–19:00Z and the first settlements 20:07Z; the desk rehearsed on a Surfpool fork of mainnet 2026-09-22 23:49–23:54Z (31/31 checks, nine refusals, `ce24370`); the first production practice desk in `D-126`'s evidence paragraph. **Not yet:** the desk's mainnet deploy and the builder's own live desk (his spend). |
| **Pyth** | Pyth is a settlement-grade source in the venue, not a display feed: TSLA/QQQ/VOO Windows resolve against a Wormhole-verified Pyth pull-oracle update admitted on chain by `public_record_print_pyth` at the exact boundary second, cross-checked against RedStone, and a divergence past 25 bps voids the Window rather than paying anyone; `/proof` can post the archived update again from the browser. Pyth's pre-IPO valuation indices (OpenAI, Anthropic) are wired three ways and gated on a live per-feed entitlement probe (`D-125`): a valuation lane per name on the same on-chain path as TSLA, the hub's "Token vs Pyth" figure, and the desk's `require_pyth_index` leg, under which every buy carries a fully verified Pyth update no older than 60 s and the premium ceiling is measured against the index instead of the venue's own mark (`D-126`). The trial key answers `403 pyth-indices` today, so the lanes stay unlisted and the pages omit the rows rather than show a dead lane; a key switches all of it on at the next hourly probe with no deploy. | Ledger rows 2026-09-14 14:45Z: the cross-check settle (`xjKyBjRk…`), the `CrossCheckDivergence` void (`24R75m6P…`) and the `MissingPrint` void (`3p3AwjvW…`); `D-125`'s evidence (the 403 verified by hand and by the dry ops boot, 2026-09-22); the program `1528b2e` (`require_pyth_index`); the `/status` "Pyth valuation index · entitlement" row and `/dev/pyth-index`. The replay payer is funded (row 2026-09-15 06:05Z); no replay transaction is in the ledger yet. |

**Not claimed:** Tessera, Clawpump and Meteora DBC. Tessera is now excluded by the eligibility rule above, not merely
by scope. Clawpump and Meteora DBC would each mean bolting a token-launch mechanic onto a prediction venue, and the
result would be a track-shaped feature rather than something the venue does. Saying so is cheaper than a thin claim.

## Required package

| Requirement | Current state | Owner / completion check |
| --- | --- | --- |
| Working devnet prototype | `agari-events` and `agari-vault` deployed and exercised end-to-end on devnet (window open → price print → fill → settle/void → redeem), and the venue runs unattended on production ops at `useagari.xyz` (roller, relay, settler, maker, indexer, desk-runner) | Stage owner. Use `docs/plan/acceptance.md` as the live evidence ledger, failed attempts included. |
| Working prototype: the desk | **Practice on production:** `/desk/new` creates a practice desk from one signature and the runner wakes it hourly on real PreStocks prices and real Jupiter quotes (the first production desk's first record is in `D-126`'s evidence paragraph). **Live on a mainnet fork:** the whole desk, including two buys through the Jupiter CPI and nine forced refusals, rehearsed on a Surfpool fork of Solana mainnet on 2026-09-22 (31/31 checks, ledger rows 23:49–23:54Z, `ce24370`). **Not on mainnet:** the deploy (≈ 3.37 SOL rent) and the builder's own desk wait on his funding; the runbook is `docs/plan/specs/desk.md` §10. | User (funding), then the stage owner (C7). |
| Repository | **Created 2026-09-19: <https://github.com/Blockchain-Oracle/agari>, private (per `Q-007`), MIT detected, default branch `integration/w1` (the real trunk, 527 commits; `main` is pushed but stays gated on the S1/S3 gates).** Judge access still needs the public-release call | User. A public-release decision is still open (`Q-007`, `public-release-audit.md`) before any repository is created and made judge-accessible. |
| Demo video | Not recorded yet | Stage owner, Wed 2026-09-16 after the NYSE bell (`D-097`). Until then `/demo` shows an honest "recording" state with a live proof table, never a placeholder video. |
| Real user and problem | Written up in `docs/submission/description.md` and `docs/plan/00-plan.md` §0 (the tokenized-stock holder who can't express a short-horizon view without selling) | Done. |
| Why Solana | `README.md` § "Why Solana" — factual (finality/fees, upgradeable programs, live price oracles), no marketing claims | Done. |
| Execution quality evidence | `docs/plan/acceptance.md` (every devnet transaction, including failures), `docs/plan/decisions.md` (dated architecture decisions), `docs/plan/parity.md` (Masayume-parity ledger) | Done, ongoing — these are live documents updated through the deadline. |

## Optional package

- **Pitch deck:** built as `/pitch` in the app itself (`L-14`, S15b), not a separate slide file. Reads real proof data via the venue-usage hook rather than static numbers.
- **Presentation to judges beyond the demo video:** not planned; optional per the hackathon's stated requirements.

## Final owner runbook

1. Confirm the exact Stocklana submission platform, its form fields and any character/format limits from an authenticated session immediately before submitting — this checklist does not assume DoraHacks or any other specific platform.
2. Decide the repository's public-release terms (`public-release-audit.md`) and, if publishing, create the GitHub repository and grant judge access.
3. Record the recorded demo's actual link once `D-097` completes, and update `README.md` and this checklist.
4. Compare the submission draft against `docs/plan/acceptance.md` and `docs/plan/parity.md` before submitting: every claim in the submission text should trace to a confirmed row, not an aspiration.
5. Save the submitted project URL/id and the acknowledgement time (with timezone) here, in the Release record below. Until that exists, status is **prepared**, not **submitted**.

## Release record

| Field | Value |
| --- | --- |
| Checklist prepared | 2026-09-15 |
| Repository created | 2026-09-19 — <https://github.com/Blockchain-Oracle/agari> (private, MIT, default `integration/w1`) |
| Judge-accessible source | Not yet — pending `Q-007` |
| Demo video | Not yet — pending `D-097` (Wed 2026-09-16) |
| Submitted project URL/id | Not submitted |
| Submission acknowledgement | Not submitted |
