# S0 — Bootstrap and authority (M0 "the fork builds")

**Goal:** a git repo containing Masayume's exact tree renamed to Agari (still EVM) that builds, with the toolchain pinned, references cloned, keys probed and plan files in place. Plan: `00-plan.md` §7.2 S0.

## Steps

- [x] `git init`; `context/` tracked; `reference/` and `data/archive/` ignored
- [x] Import the pinned tree from Masayume `68f7a09` (D-001)
- [x] Rename identity: `@masayume/*` → `@agari/*`, BRAND, wordmarks, manifest name, `AgariMark`, storage/protocol/device-header prefixes. Remaining hits are recorded in Handoff
- [x] `pnpm install && pnpm typecheck && pnpm build` green on the renamed EVM tree (848 pkgs; 7 projects; 55 routes; invariants 14/14)
- [x] D-002 toolchain spike: both Anchor versions SBF-build with all three oracle crates; pinned **1.2.0** (CLI + crates) and host rustc 1.98.1
- [x] **Time-sensitive archivers** running in follow mode (detached; logs in `data/archive/logs/`, pids in `data/archive/*.pid`): `scripts/archive/pyth-trial.mjs` (Pyth trial ends ≈ 09-27) and `scripts/archive/redstone.mjs` (≈ 24 h retention)
- [x] Scaffold `anchor/` (Anchor.toml `package_manager = "pnpm"`, workspace Cargo.toml, `crates/agari-common` stub) + `pnpm codegen` (multi-IDL script replaces the template single-IDL `codama.json`) / `pnpm anchor:build`
- [x] pnpm-only invariant rule; no non-pnpm lockfiles (`file-length` also covers `anchor/**.rs`)
- [x] Clone and pin references (`references.md`)
- [x] Solana Developer MCP in `.mcp.json`; Context7 ids confirmed
- [x] Role keypairs in `~/.config/agari/devnet/` via `scripts/deploy/roles.mjs`. Deployer funding carried to Handoff: 0 SOL, faucets rate-limited; needed before the S2 devnet deploy
- [x] `.env.example` for root, web and ops; split `.env.local`; `scripts/env-check.mjs`
- [x] Rerun `scripts/probe-keys.mjs` (+ RedStone); D-003 `services/ops/config/price-sources.json`
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
- **D-002:** Anchor 1.2.0 and 1.1.2 both SBF-build with Pyth receiver, RedStone rust-sdk and Switchboard (after the `getrandom` custom patch). The CLI 1.2.0 prebuilt installs via avm in seconds without touching the Solana release. Spike sources are in `docs/plan/spikes/d002/`; S2 starts from them.
- **Toolchain side effects (expected, first run):** platform-tools v1.52 downloaded to `~/.cache/solana/v1.52` (1.3 GB); rustup auto-installed `1.98.1` for `anchor/rust-toolchain.toml`; avm now has 1.1.2 and 1.2.0 (current).
- **Archiver crash (fixed):** both detached archivers died about 10 min after launch. An Alpaca calendar request timed out and the unguarded fetch threw. Fix: calendar cached for 1 h with last-good fallback, and `runLoop` logs failed passes and backs off instead of exiting. Restarted 2026-09-13 ~20:25 UTC; no market data was lost (weekend).
- **Devnet faucets:** the public faucet rate-limited twice; Helius allows 1 SOL per project per day and was already exhausted.
- **No global git identity** on this machine: the repo uses a local `user.name` / `user.email` matching Masayume's repo.
- **zsh doesn't word-split** `$var` in `set -- $spec`, so multi-word shell loops run under `bash`.

## Handoff

**Open items for the next stages:**
- **Fund the deployer before the S2 devnet deploy** (user): https://faucet.solana.com (GitHub sign-in) → `AD8cgL3c39WxgqohfpuHzkBsr1su4eU6a6sQqzHC3V5F`. Target 55–65 devnet SOL over several days; record the balance in `acceptance.md`.
- **Archivers are running detached** (pids in `data/archive/*.pid`, logs in `data/archive/logs/`). They pause while the Mac sleeps: Pyth can backfill until the trial ends; RedStone loses boundaries older than ≈ 24 h. Restart with `pnpm archive:pyth` / `pnpm archive:redstone` after a reboot (pass `--from 2026-09-11 --until 2026-09-27` to the Pyth script, as in the S0 launch).
- **S2 must:**
  - start from `docs/plan/spikes/d002/`;
  - pin `solana-program` 3.0.0;
  - pass RedStone `threshold = 5` inside `strict_sec`;
  - use per-boundary admission for the Gap lane (D-003);
  - decide the Pyth receiver feature against a real devnet post.
- **S1 must:** add the Codama packages only when S2 produces an IDL (`scripts/codegen.mjs` already handles multiple IDLs).

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
