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
| 2026-09-14 12:14 | S2 | Deployer `AD8cgL3c39WxgqohfpuHzkBsr1su4eU6a6sQqzHC3V5F` funded by the user with devnet SOL (faucet) | — | — | [`2WBzrZ77…RX786`](https://explorer.solana.com/tx/2WBzrZ77VPXTfegH9FQCmW1tP35hrH181Jigi1x6fGahZXr4BTYMmpDQvVrujhRTfkhDaxg9kbYZvLTPEBxRX786?cluster=devnet) | ✅ balance 5 SOL |
| 2026-09-14 14:05 | S2 | Deploy budget check: `.so` 663,784 B (redeem/close lane still building) → programdata rent ≈ 3.37 SOL kept, deploy peak ≈ 6.75 SOL (buffer refunded after); Book 512 = 0.2900 SOL, 256 = 0.2276 SOL (`getMinimumBalanceForRentExemption`, devnet) | — | — | local RPC read | ⚠️ 5 SOL < deploy peak: one more 5 SOL faucet request needed before deploy |
