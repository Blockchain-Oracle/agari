# Acceptance ledger

Evidence for stage gates and parity rows. **Every devnet transaction gets a row, including failed ones.** Newest last.

| UTC | Stage | Scenario | Parity rows | Commit | Devnet tx / artifact | Result |
|---|---|---|---|---|---|---|
| 2026-09-13 19:30 | S0 | Renamed EVM tree typechecks (`pnpm typecheck`, 7 projects) | — | pending | local | ✅ pass |
| 2026-09-13 19:31 | S0 | Pyth trial archive: 09-11 boundaries match the exact-T rule (`prev = T − 1`, `publish = T`) for TSLA/QQQ/VOO | — | pending | `data/archive/pyth/2026-09-11.jsonl` | ✅ pass |
