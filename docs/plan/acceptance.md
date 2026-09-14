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
| 2026-09-14 ~12:50 | S2 | Deployer topped up by the user to 10 SOL (second faucet request) | — | — | balance read (signature not yet indexed at check time) | ✅ balance 10 SOL |
| 2026-09-14 12:55 | S2 | Deploy attempt 1: SBPFv3 binary (Anchor 1.2 default `--arch v3`) | — | 36f1384 | none (refused locally: "sbpf_version … not enabled"; devnet SBPFv3 feature `BUwGLeF3…` inactive) | ❌ fail, 0 SOL spent (D-024) |
| 2026-09-14 12:57 | S2 | Deploy attempt 2: SBPF v0 binary via Helius `--use-rpc` | — | 36f1384 | buffer [`9GZyxoSf…Rrftw`](https://explorer.solana.com/address/9GZyxoSfA5EukQfAZveeC1wTDmWAWnwCunhwxyGRrftw?cluster=devnet) created; writes failed "Max retries exceeded" | ❌ fail (buffer funded 3.88 SOL, recoverable) |
| 2026-09-14 13:03 | S2 | Deploy attempt 3: resumed into buffer `9GZyxo…`, TPU sends; program `cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH`, program data `2sSGMUci…qnzeD`, authority = deployer, slot 498,252,588; dumped bytes == tested v0 `.so` (764,200 B, sha256 `310e14d7…c44309`); buffer closed | — | 7c370df | [`535nHdsR…RpQS`](https://explorer.solana.com/tx/535nHdsRyvVbmuKVHPsuaBV9HCVEcfkTRbZnk2Gpr35DSnC8SAsFzkDJnm4qW6L6EKptVSrNzuhHkwzQ56hKRpQS?cluster=devnet) | ✅ deployed (rent 3.883 SOL; deployer 6.112 SOL left) |
