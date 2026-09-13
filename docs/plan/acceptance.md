# Acceptance ledger

Evidence for stage gates and parity rows. **Every devnet transaction gets a row, including failed ones.** Newest last.

| UTC | Stage | Scenario | Parity rows | Commit | Devnet tx / artifact | Result |
|---|---|---|---|---|---|---|
| 2026-09-13 19:30 | S0 | Renamed EVM tree typechecks (`pnpm typecheck`, 7 projects) | — | pending | local | ✅ pass |
| 2026-09-13 19:31 | S0 | Pyth trial archive: 09-11 boundaries match the exact-T rule (`prev = T − 1`, `publish = T`) for TSLA/QQQ/VOO | — | d35e380 | `data/archive/pyth/2026-09-11.jsonl` (391/391) | ✅ pass |
| 2026-09-13 19:33 | S0 | Renamed tree: `pnpm invariants` (14 rules) and `pnpm build` (55 routes) | — | b75676d | local | ✅ pass |
| 2026-09-13 19:40 | S0 | Devnet airdrop for deployer `AD8cgL3c39WxgqohfpuHzkBsr1su4eU6a6sQqzHC3V5F` (public faucet ×2, Helius ×1) | — | — | rate-limited, no signature | ❌ fail (balance 0; use faucet.solana.com) |
| 2026-09-13 19:45 | S0 | Key probe: Pyth trial exact-T TSLA/QQQ/VOO; RedStone 5 signers × 7 names at exact T; Alpaca, Finnhub, Helius OK | — | pending | `scripts/probe-keys.mjs` | ✅ pass |
| 2026-09-13 20:10 | S0 | D-002 spike: `cargo build-sbf` passes with Pyth receiver + RedStone + Switchboard (getrandom patch) on Anchor 1.2.0 and 1.1.2 | — | pending | `docs/plan/spikes/d002/build-matrix.txt` | ✅ pass |
| 2026-09-13 20:20 | S0 | **S0 gate:** `pnpm typecheck`, `pnpm invariants` (15 rules), `pnpm build`, `pnpm anchor:build` (Anchor 1.2.0, empty workspace), `surfpool --version` 1.5.0, `pnpm env:check` | — | pending | local | ✅ pass |
| 2026-09-13 20:25 | S0 | Archivers crashed on an Alpaca calendar connect timeout; fixed (hourly cache + error-safe loop) and restarted; a simulated Alpaca outage and a throwing pass are logged, not fatal | — | pending | `data/archive/logs/*.log` | ✅ pass after fix |
