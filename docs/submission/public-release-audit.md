# Public source release audit — 2026-09-15

Status: **prepared for owner review; repository not yet created, public-release terms not yet decided.**

This audit covers secret exposure, tracked-file history for env/keypair material, source provenance carried from Masayume, and README/submission link integrity. It does not certify hackathon submission, live trading, or legal ownership of any reference material.

## Repository and authority snapshot

| Item | Verified state |
| --- | --- |
| This working tree | No GitHub remote configured (`git remote -v` returns nothing); branch `slice/S15c-docs` off `stage/S15-public-story` |
| Audit base | HEAD at the time of this audit, `4a909c3` plus this lane's commits |
| Reference clones (`reference/`) | Live only in the main `stocklana` checkout, not in this worktree; not part of what a public release of this tree would include |
| Upstream authority | Masayume (`reference/masayume` @ `68f7a09`) — private, per Masayume's own audit; Agari's own public-release terms are a separate, still-open decision (`Q-007`) |

## Secret scan

Command run: `git grep -nE '(sk-|api[_-]?key|secret|private[_-]?key|BEGIN [A-Z ]*PRIVATE)' -- . ':!pnpm-lock.yaml'` against the tracked working tree.

| Result | Count |
| --- | --- |
| Total matching lines | 382 |
| Files matching `sk-` | ~158 line-matches |
| Files matching `api[_-]?key` (case-insensitive) | 57 files |
| Files matching `secret` (case-insensitive) | 126 files |
| Files matching `private[_-]?key` (case-insensitive) | 52 files |
| Files matching a `BEGIN ... PRIVATE` PEM header | 0 |
| Two independent heuristics for a hardcoded credential-shaped literal assigned to a key/secret variable | 0 hits each |

Every hit reviewed falls into one of these categories, none of which is a credential value:

1. **`sk-` is a substring false positive.** The pattern has no word boundary, so it matches inside ordinary words: `desk-` (the Private Desk feature, its CSS and components), `risk-`, `task-`, `ask-`, and similar. This is the majority of the raw count.
2. **Environment variable names, never values**, referenced in code (`process.env.SPONSOR_PRIVATE_KEY`, `RUNNER_PRIVATE_KEY`, `GAME_SETTLER_PRIVATE_KEY`, `GAME_DECK_KEY`, `FAUCET_MINT_AUTHORITY_PRIVATE_KEY`, `X_API_KEY`, `X_API_KEY_SECRET`, `ROOM_TOKEN_SECRET`, `SPONSOR_RPC_URL`, `AI_API_KEY`, and others) in `.env.example`, `services/ops/src/**/env.ts`, `packages/markets/src/env.ts` and `web/src/lib/env.ts`. `.env.example` files carry blank placeholders (`KEY=`), never a value.
3. **"Private" and "secret" as feature/product words**: the Private trading mode (`agari-private`, S10d, deferred), test assertions that a user-facing error message never leaks the word "secret" (`services/ops/src/actors/x-relay/execute.test.ts`), and prose in `context/*.md` research notes discussing price-policy "secrecy" or oracle key concepts, not holding one.
4. **Session/keypair *logic*, not key material**: `packages/markets/src/sessions/keypair.ts`, `keypair-signer.ts`, `web/src/features/games/duel/game-keypair.ts` and their tests implement and test ed25519 session-key generation/parsing (e.g. asserting a 64-byte secret key array, or that a malformed string returns `null`); no real key is embedded.
5. **Documentation prose** (`context/04-solana-dev-stack-and-port-map.md`, `context/13-affordable-equity-price-sources.md`) describing oracle signer/attestation concepts, not holding a signer's private material.

**Conclusion: zero live credentials found.** This is not a guarantee against every possible secret class, an ignored local file, or a future commit — it is a review of the tree as it stands on 2026-09-15.

## Env and keypair files across all history

Command run: `git log --all --diff-filter=A --name-only | grep -iE 'env|keypair|\.json$' | sort -u`.

Every `.env`-matching path ever added is an `.env.example` template (`​.env.example`, `services/ops/.env.example`, `web/.env.example`) — all placeholders, never a filled value. No `.env.local`, no `*keypair*.json`, no `id.json` and no `.pem` file has ever been added. `.gitignore` covers `.env.*` except the tracked `*.env.example` files (verified with `git check-ignore -v`), and role keypairs live outside the repository in `~/.config/agari/devnet/` per `CLAUDE.md`. Every `.json` file ever added is a build config (`package.json`, `tsconfig.json`), a public program IDL, a public devnet address manifest (`scripts/deploy/addresses.devnet.json`), a test fixture/vector, or `.mcp.json` (inspected directly: one entry, an HTTP MCP server URL, no key field).

## Material reference dependencies (carried from Masayume; see `THIRD_PARTY_NOTICES.md`)

| Reference | Pinned basis | Agari-tree finding |
| --- | --- | --- |
| Yosuku | `Cybire1/yosuku` @ `3c56ef52b78dae28cc198495f753480292f6a5ad` | CSS/interface port carried through the Masayume→Agari port; same open question as Masayume's own audit — a rights-holder redistribution notice for the already-approved reuse is still undocumented. |
| PIPS | `Blockchain-Oracle/pips` @ `fe8f6963972ca18fc9db0fd9ee4db389e6293ee8` | Verified real: `packages/core/src/games/arcade/{flap,ride}.ts` carry direct doc-comment credit ("Pips's `flapEngine.ts`, re-expressed…"). No general root license grant in the pinned tree. |
| Flicky | `Blockchain-Oracle/flicky` @ `56054baeb0c7f8ef6e039ebb0eed2b04e4f59388` | Verified real: `packages/core/src/games/matchmaking.ts` cites `reference/flicky/apps/server/src/ws/matchmaking.ts:171-237` directly. Ten shipped game sound files and one font are the same files Flicky also ships (Kenney/Daniel Linssen's own original terms apply, independent of Flicky's own missing license). |
| Phoenix v1, `lib-sokoban`, Polymarket `ctf-exchange`, BetDexLabs/Monaco | Named as license-clean design inspirations in `docs/plan/00-plan.md` §3.0 | **Checked and found not present as code.** A search of `anchor/programs/agari-events/src` and `packages/core` found no comment, credit or lifted code referencing any of these four; the engine's own doc comments cite this repository's internal specs instead. No credit for these four is added to `THIRD_PARTY_NOTICES.md` because none would be accurate. |

No repository-wide license currently exists for this tree (no root `LICENSE` file), consistent with Masayume's own unresolved state.

## Link check

Every relative link in `README.md`, `THIRD_PARTY_NOTICES.md` and `docs/submission/*` resolves to a real file (checked programmatically against the filesystem; zero broken). A 10-URL sample of the 41 absolute links was checked with `curl`:

- Four `explorer.solana.com` links (2 transactions, 2 addresses) all answered `429`, consistently, even after a delay and a browser-shaped user agent. This matches explorer.solana.com's known bot-blocking behavior for automated requests, not a broken link — every signature and address in the README's proof table was copied verbatim from a confirmed row in `docs/plan/acceptance.md`, not typed by hand. A human clicking the same links in a browser gets a normal page.
- `github.com/Cybire1/yosuku` (Yosuku's own repository) answers **404** to an anonymous request. This is not new: Masayume's own public-release audit recorded the identical 404 on 2026-09-06 and noted that a search-engine cache still showed an older public page, so cached availability was never treated as current access or a license grant. That unresolved fact is inherited here, not newly discovered, and does not change the already-recorded owner approval of the Yosuku reuse.
- The other 6 sampled links (Masayume's own GitHub, RainbowKit, DiceBear, Kenney, itch.io) all answered `200`.

## Program build reproducibility

Not run in this pass. `anchor build --verifiable` for `agari-events`/`agari-vault` and the on-chain IDL publish are the stage owner's step after tonight's devnet upgrade sequence (`D-096`); the README's Programs section carries explicit "pending (D-096)" placeholders rather than a fabricated hash.

## Concrete remaining public-release decisions

1. **Same open Yosuku redistribution question Masayume never resolved**: what rights-holder notice and public redistribution terms should accompany the already-approved Yosuku reuse, carried into this port.
2. **Select a project-level source license, if one is intended**, preserving the third-party exceptions `THIRD_PARTY_NOTICES.md` records (Yosuku, PIPS, Flicky, fonts, sounds, wallet-modal assets, asset marks).
3. **Create the repository and decide judge-access terms** (`Q-007`) before the submission checklist's "Repository" row can move past "not yet".

No answer is inferred here from a badge, a fork relationship, or continued implementation work; this audit records the question, not a decision.
