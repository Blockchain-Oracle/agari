# S0 — Bootstrap and authority (M0 "the fork builds")

**Goal:** a git repo containing Masayume's exact tree renamed to Agari (still EVM) that builds, with the toolchain pinned, references cloned, keys probed and plan files in place. Plan: `00-plan.md` §7.2 S0.

## Steps

- [x] `git init`; `context/` tracked; `reference/` and `data/archive/` ignored
- [x] Import the pinned tree from Masayume `68f7a09` (D-001)
- [x] Rename identity: `@masayume/*` → `@agari/*`, BRAND, wordmarks, manifest name, `AgariMark`, storage/protocol/device-header prefixes. Remaining hits are recorded in Handoff
- [ ] `pnpm install && pnpm typecheck && pnpm build` green on the renamed EVM tree (install ✅, typecheck ✅, build running)
- [ ] D-002 toolchain spike: anchor 1.2.0 vs 1.1.2 × Pyth receiver / RedStone / Switchboard, SBF build (agent running)
- [ ] **Time-sensitive archivers** running in follow mode: `scripts/archive/pyth-trial.mjs` (Pyth trial ends ≈ 09-27) and `scripts/archive/redstone.mjs` (≈ 24 h retention)
- [ ] Scaffold `anchor/` (Anchor.toml `package_manager = "pnpm"`, workspace Cargo.toml, `crates/agari-common` stub) + `codama.json` + `pnpm codegen` / `pnpm anchor:build`
- [ ] pnpm-only invariant rule; no non-pnpm lockfiles
- [x] Clone and pin references (`references.md`)
- [ ] Solana Developer MCP in `.mcp.json`; confirm Context7 ids
- [ ] Role keypairs in `~/.config/agari/devnet/`; `scripts/deploy/roles.mjs`; fund the deployer (target 55–65 devnet SOL over time)
- [ ] `.env.example` for root, web and ops; split `.env.local`; `scripts/env-check.mjs`
- [ ] Rerun `scripts/probe-keys.mjs` (+ RedStone); D-003 `services/ops/config/price-sources.json`
- [x] `docs/plan/*` created (STATUS, decisions, acceptance, parity, references, this file) + `CLAUDE.md`

## Gate

`pnpm typecheck && pnpm build` · `NO_DNA=1 anchor build` (empty workspace) · `surfpool --version` · `pnpm env:check` · probe recorded · commit on `main`.

## Findings

- **pnpm install:** 848 packages; the lockfile passes pnpm 11's supply-chain policies.
- **Typecheck:** passes on all 7 workspace projects after the rename.
- **Pyth trial history works for past sessions:** Friday 2026-09-11 boundaries return `publish_time == T` and `prev_publish_time == T − 1` for TSLA/QQQ/VOO. One 1.7 KB base64 blob covers all three feeds.
- **Full Pyth feed ids:**
  - TSLA `16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1`
  - QQQ `9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d`
  - VOO `236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179`
- **RedStone gateway:** `oracle-gateway-2` `/data-packages/historical/redstone-primary-prod/<ms>` returns packages stamped exactly at T with 5 distinct signers. `oracle-gateway-1` historical returns an empty body. There's no per-feed filter, so each call downloads all ≈ 951 feeds (1.9 MB).
- **RedStone package JSON:** `{timestampMilliseconds, signature (base64, 65 B), dataPoints[{dataFeedId, value}], signerAddress, dataPackageId}`. The value is decimal JSON; the RedStone SDK rebuilds signed bytes from it with 8 decimals.
- **No global git identity** on this machine: the repo uses a local `user.name` / `user.email` matching Masayume's repo.
- **zsh doesn't word-split** `$var` in `set -- $spec`, so multi-word shell loops run under `bash`.

## Handoff

Masayume identity still present after the S0 rename (111 files, deliberately deferred):
- **S1 (removed with EVM):** `packages/markets/src/addresses.masayume.json` imports (9 files); signed-message wording in `core/{faucet,games/room-token,private,x/link}` (golden vectors hash these, so rewrite with ed25519 in S1); `Somnia` references (65 files).
- **S15 (brand sweep):**
  - Verdict stamp copy 正夢/逆夢 and "masayume — it came true" (`core/copy/verdict.ts`, 8 files with 正夢).
  - `masayume.app` domain (12 files) and `@masayume_app` handle (7 files).
  - Mark artwork comments (`AgariMark.tsx`), icons and PNGs, demo video (`web/public/video/masayume-demo-*`).
  - Title-case "Masayume" in copy and comments (63 files).
  - `web/README.md`, `web/.env.example` (rewritten in the S0 env step).
- **S16:** `services/ops/fly.toml` app `masayume-ops`.
- Tagline set to "the winning hand" as a placeholder until the S15 copy pass.
