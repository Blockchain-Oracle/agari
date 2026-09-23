# Stage 25 — Sponsor visibility and the docs site

**Goal:** PreStocks' and Pyth's judges see what each sponsor does in Agari within a minute, from any entry point (README, landing, the price on a market, the docs), in plain factual wording that their terms allow; the docs site is live at `docs.useagari.xyz` and ships from this repo.

**Research (2026-09-23, sourced):** the hackathon is run by the Solana Foundation; sponsor judges read only the submissions that claim their track. PreStocks: "unique, well-executed ideas that drive value for PreStocks"; any non-PreStocks pre-IPO token makes a project ineligible; the name and logos need their prior written permission and may not imply endorsement. Pyth judges "how central Pyth data is to the product, technical soundness and quality of the integration, and if the app exists post hackathon"; no public brand kit; feed pages live at `app.pyth.com/explore/<Symbol>` (Pyth Terminal). No evidence of AI screening. Shared brief: the S25 lanes' prompt.

## Steps

- [x] **25.1 Docs site in the repo and on Coolify.** `agari-docs` imported with its history at `docs-site/` (git subtree), a Dockerfile, the public origin `https://docs.useagari.xyz`; Coolify app `agari-docs` `jpmw4nk5g05dhaiinsbvx4ga` in project `agari`, base directory `/docs-site`, branch `integration/w1`, deploy key shared with the app. DNS: the wildcard `*.useagari.xyz` (DNS-only) already points at the VPS; Wrangler's OAuth token has no DNS scope and none was needed.
- [x] **25.2 README.** The tracks, a 60-second path, a sponsor-integrations table (code, live page, transaction) at the top.
- [ ] **25.a Docs refresh** (`slice/S25a-docs`, `../agari-wt/s25a`): S22–S24 facts, an in-repo source pin, a sponsor page for judges and AI readers.
- [ ] **25.b Web** (`slice/S25b-sponsor-web`, `../agari-wt/s25b`): a source line beside each price read from the series policy, a "Built on" band under the landing hero, one footer credit line, a Docs link.
- [ ] **25.3 Merge, deploy web and docs, capture the live pages.**
- [ ] **25.4 Logo permission requests** to PreStocks and Pyth (drafted; the user sends).

## Handoff

Lanes run in their own worktrees; merge into `integration/w1` one at a time, then deploy docs and web one app at a time.
