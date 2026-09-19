# Stocklana hackathon submission checklist

Updated **2026-09-15**. This is a preparation checklist, not a submission record: no BUIDL/entry has been submitted on any hackathon platform, and no submission acknowledgement exists.

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
| **PreStocks** | Agari runs Up/Down prediction markets **on** pre-IPO token prices. It does not trade the token. `PRE-OPENAI-5m` is a real Series whose Windows open, print at both boundaries from the PreStocks catalogue and settle, with the venue attesting each price (`D-100`). Two wallets have taken opposite sides of one and been paid: a NO rest at 40¢ crossed by a YES buy at 65¢, settled DOWN against the caller, both seats redeemed and the vault drained to zero. Any of the eight PreStocks names can be listed without a program change. | The four devnet transactions in the README's Pre-IPO rows; the drive is `scripts/drive/prestocks-attest.ts`, the price module `packages/markets/src/prices/prestocks.ts`. |
| **Pyth** | Pyth is a settlement-grade source in the venue, not a display feed: TSLA/QQQ/VOO Windows resolve against a Wormhole-verified Pyth pull-oracle update admitted on-chain by `public_record_print_pyth`, cross-checked against RedStone, and a divergence voids the Window rather than paying out. | The settlement rows in the README's "Settlement & claims" group, including a cross-checked settle and a `MissingPrint` void. |

**Not claimed:** Tessera, Clawpump and Meteora DBC. Tessera is now excluded by the eligibility rule above, not merely
by scope. Clawpump and Meteora DBC would each mean bolting a token-launch mechanic onto a prediction venue, and the
result would be a track-shaped feature rather than something the venue does. Saying so is cheaper than a thin claim.

## Required package

| Requirement | Current state | Owner / completion check |
| --- | --- | --- |
| Working devnet prototype | `agari-events` deployed and exercised end-to-end on devnet (window open → price print → fill → settle/void → redeem); `agari-vault` deploy is tonight's sequence (`D-096`) | Stage owner. Use `docs/plan/acceptance.md` as the live evidence ledger, failed attempts included. |
| Repository | No GitHub remote is configured for this working tree yet (`git remote -v` empty) | User. A public-release decision is still open (`Q-007`, `public-release-audit.md`) before any repository is created and made judge-accessible. |
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
| Repository created | Not yet |
| Judge-accessible source | Not yet — pending `Q-007` |
| Demo video | Not yet — pending `D-097` (Wed 2026-09-16) |
| Submitted project URL/id | Not submitted |
| Submission acknowledgement | Not submitted |
