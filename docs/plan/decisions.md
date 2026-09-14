# Decisions and open questions

The plan (`00-plan.md`) changes only through entries here. Format: `D-###`: date · owner · evidence · rule · user-visible consequence · approval.

## Decisions

### D-001 — Source-led fork of Masayume `68f7a09`
- **Date / owner:** 2026-09-13 · planner (S0)
- **Evidence:** `git -C /Users/abu/dev/hackathon/sommina-events archive 68f7a09 web packages services scripts package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json vitest.config.ts THIRD_PARTY_NOTICES.md | tar -x` (commit `1a52aec`).
- **Rule:** Agari starts from Masayume's exact tree. `contracts/` and `docs/` are read from `reference/masayume`, not copied.
- **S0 rename:** `@masayume/*` → `@agari/*`; BRAND; wordmarks; manifest name; `AgariMark`; storage, protocol and device-header prefixes.
- **Deferred (recorded in `stage-00-bootstrap.md` Handoff):** signed-message wording, verdict stamp copy, domains, X handle, Fly app name and demo media.
- **User-visible:** the app shows Agari; behaviour is unchanged (still EVM until S1).
- **Approval:** plan r2 (user, 2026-09-13).

### D-002 — Anchor 1.2.0; all three oracle crates usable on SBF
- **Date / owner:** 2026-09-13 · planner (S0), spike by a sub-agent.
- **Evidence:**
  - Sources: `docs/plan/spikes/d002/` (build matrix + program sources).
  - Real `cargo build-sbf` on anchor-lang/anchor-spl **1.2.0 and 1.1.2** with `pyth-solana-receiver-sdk 2.0.0`, `redstone` rust-sdk (git rev `05e3c9f…`, `solana` feature) and `switchboard-on-demand 0.13.0` (`solana-v3`). Both pass with all three crates; .so ≈ 247 KB.
  - The dependency graphs are identical apart from `anchor-*`. Host IDL build passes.
  - Anchor CLI 1.2.0 installed via avm (prebuilt, 12 s). The Solana release link is unchanged (3.1.10), and `anchor build` passes.
- **Rule:**
  - `anchor/Anchor.toml` sets `anchor_version = "1.2.0"`; `[workspace.dependencies]` pins `anchor-lang`/`anchor-spl` `=1.2.0`.
  - `anchor/rust-toolchain.toml` pins host rustc 1.98.1. SBF uses platform-tools 1.89.0 (`~/.cache/solana/v1.52`).
  - After adding oracle crates, run `cargo update -p solana-program@5.0.0 --precise 3.0.0`; unpinned resolves 5.0.0.
  - **Pyth:** default feature → receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`; `pro-compatible` → `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp`. S2 picks the one the trial's updates verify against on devnet.
  - **RedStone:** use the SDK, with no in-crate verifier needed.
    - Call `Config::try_new(threshold, signers, [feed], block_timestamp = T_ms, max_delay = Some(0), max_ahead = Some(0))`, then `process_payload`. This forces package timestamp == T without Clock.
    - **Anti-selection (PD-1):** pass `threshold = 5` inside `strict_sec`, and 3 after.
    - The SDK recovers every package (25k CU each) and silently drops a feed below threshold, so `require!(!values.is_empty())`.
    - The median of an even count averages the two middle values.
    - High-s signatures are rejected; dedupe is per (feed, signer).
    - Heap: one payload clone per package, fine for ≤ 5 single-feed packages.
  - **RedStone signers (primary-prod, threshold 3),** from the adapter `config_prod.rs` at `redstone-oracles-monorepo@519cd10`, matching the 5 addresses seen on the gateway (D-003): `8bb8f32d…b774`, `deb22f54…8499`, `51ce04be…d202`, `dd682dae…b5be`, `9c5ae89c…b6de`.
  - **Switchboard:**
    - `switchboard-on-demand` pulls `libsecp256k1` → `rand` → `getrandom 0.2`, which fails on SBF. Enable `getrandom = { features = ["custom"] }` + `register_custom_getrandom!(always_fail)` under `cfg(target_os = "solana")`; verification never needs randomness.
    - Plus the 0xFFFF index workaround, pinned queue, distinct oracle indices (`spikes/d002/.../sb_settle.rs`).
  - **Correction to `C:13` §3:** the "2 days between untrusted updates" limit was RedStone's *old* adapter (tag 2.0.1). The current adapter uses a 40 s interval and 3 min max delay. It doesn't affect Agari, which verifies in-program.
- **User-visible:** none (build toolchain).
- **Approval:** within plan r2 S0 (pin 1.2.0 if it builds).

### D-003 — Price-source matrix and policy-version dates
- **Date / owner:** 2026-09-13 · planner (S0)
- **Evidence:**
  - `scripts/probe-keys.mjs` rerun 2026-09-13 ~19:45 UTC:
    - Pyth trial exact-T at Fri 09-11 16:00 ET: TSLA 365.48, QQQ 714.90, VOO 702.50, all `exactT`. RedStone TSLA at the same T is 365.4827, so primary and check agree within 1 bp.
    - AAPL, `Crypto.TSLAX/USD` and Pro AAPL return 403: not in the trial. The token lane can't use Pyth.
    - RedStone gives 5 signers for all 7 single names, both latest and at an exact past T.
    - Alpaca calendar: 77 sessions to year end; early closes 11-27 and 12-24.
  - `data/archive/pyth/2026-09-11.jsonl`: 391/391 boundaries pass exact-T for all three feeds.
- **Rule:** `services/ops/config/price-sources.json` holds the PD-1 versions (validity inclusive, UTC):
  - **TSLA:** v1 Pyth + RedStone check `2026-09-11 → 2026-09-25T20:00Z`; v2 RedStone from `2026-09-25T20:00Z`. The 09-25 Gap Window (open T = Fri 20:00Z) is covered only by v2; Friday's intraday Windows stay on v1.
  - **QQQ/VOO:** v1 Pyth until `2026-09-25T20:00Z`, then paused.
  - **NVDA/AAPL/MSFT/META/AMZN/GOOGL:** v1 RedStone, open-ended.
  - **Token lane:** Switchboard Surge (S6); feed hashes pinned then.
- **Defaults:**
  - Pyth: grace 5 s, max confidence 50 bps, admission 900 s.
  - RedStone: strict (all signers) 300 s, admission 900 s, threshold 3.
  - Switchboard: min delay 10 s, admission 60 s, max slot age 20, 3 oracles.
  - Cross-check: max divergence 25 bps, check admission 120 s.
- **RedStone signers observed on the gateway:** `0xdEB22f54…8499`, `0xDD682daE…b5bE`, `0x51Ce04Be…d202`, `0x9c5AE89C…B6de`, `0x8BB8F32D…B774`. They must match the adapter's authoritative list (D-002) before S2 `init-events`.
- **S2 spec note:** one admission value per Window can't serve the Gap lane, whose opening print needs until `lock_at` but whose Monday print should void quickly. `specs/prints.md` uses admission per boundary (`open_admission_sec` / `close_admission_sec`), consistent with PD-6.
- **User-visible:** every verdict names its source. QQQ/VOO show "paused: no signed source" after the 09-25 close.
- **Approval:** within plan r2 PD-1 (user, 2026-09-13).

### D-004 — Product decisions carried from plan r2
- **Date / owner:** 2026-09-13 · user
- **Rule:**
  - Brand **Agari (上がり)**.
  - **Privy** sign-in from S1.
  - **Own Anchor CLOB** rebuilding DreamDEX Event Contracts.
  - **Masayume** is the design authority; Yosuku is lineage only.
  - **Nine programs:** agari-{events, vault, strategy, parlay, range, leverage, maker, private, arena}.
  - **Tests are not a deliverable:** targeted money/settlement tests only.
  - **pnpm only.**
  - Local Postgres first.
- **Approval:** user, 2026-09-13 (plan r2).

### D-005 — Planner decisions PD-1…PD-8 (plan §0)
- **Date / owner:** 2026-09-13 · planner, approved with plan r2
- **Rule:**
  - **PD-1:** dated price-policy versions per Series, one source per Window, anti-selection rules.
  - **PD-2:** rested-age filter + oracle-model bound.
  - **PD-3:** close ≥ open → Up.
  - **PD-4:** private claim verified off-chain.
  - **PD-5:** arena escrow.
  - **PD-6:** per-source print admission deadlines.
  - **PD-7 (amended r2):** Market + MarketResult close after retention once dependents == 0.
  - **PD-8:** growable Ledger with seat bond.
- **No Pyth trial-extension request** (user, 2026-09-13). A Stork hackathon key was requested (email sent 2026-09-13).

### D-010 — Solana primitives in `@agari/core`, and what S1 renames
- **Date / owner:** 2026-09-14 · S1 owner (step 1a.1)
- **Evidence:** plan P§5 "Primitives" and "hook names unchanged"; the blast radius in `stage-01-solana-shell.md` Findings; core typecheck + 757 core tests after the change.
- **Rule:**
  - `Address` = branded base58 of 32 bytes; `Signature` = branded base58 of 64 bytes (a transaction's id, or an ed25519 message signature); `MarketId` = branded `Address` of the Market PDA (`types/ids.ts`). Validation decodes exactly (`types/base58.ts`, vector-tested); core still imports no chain SDK.
  - `Hex` stays for bytes that really are hex (keccak commitments, RedStone's 20-byte signer ids). `Bytes32` → `Hash32` (0x + 64 hex) for hashes, feed ids, match ids and desk keys. The venue id is the events `GlobalConfig` `Address`.
  - **Addresses are never lowercased or text-sorted.** Base58 is case-sensitive, so every EVM-era `toLowerCase()` on an address was removed. Hex values keep case-folding. Commitments pack an address as its 32 decoded bytes, and the Lucky candidate set sorts by those bytes.
  - **Names:** fields keep Masayume's names when the concept maps 1:1: `txHash` (now a `Signature`), `poolAddress` (the recycled Book), port and hook names. They're renamed only when the concept changed (`asset` → ticker, token ids, the oracle question id, wei/STT).
  - **Scope:** product-family types (vault, parlay, range, maker, leverage, private, arena, strategies) keep fields like `chainId` until their own stage ports the program. In S1 they only need to compile behind `CapabilityPending`.
  - Golden vectors are unchanged: the test wallet and arena are the old left-padded words as 32-byte keys, so the packed bytes are identical.
- **User-visible:** none yet (the web still runs on EVM until 1d).
- **Approval:** within plan r2 S1.

## Open questions

| Q | Question | Status / default | Blocks |
|---|---|---|---|
| Q-001 | Build Masayume's own unfinished items? | ✅ Yes (user, 2026-09-13) | L-11, L-23, L-35, L-56, L-57, L-71, Range takes, notifications, sentiment cell, Range band, Duel sparkline |
| Q-002 | Do routes Masayume removed on 2026-09-04 stay removed? | ✅ Stay removed (user, 2026-09-13) | Y-01…Y-05, Y-18 → Excluded |
| Q-003 | Build Yosuku-only extras? | ✅ Not built (user, 2026-09-13) | Y-07…Y-13, Y-15 → Excluded |
| Q-004 | "Bet against" depth: A-1b inverse position; Phoenix perps (mainnet-only)? | Open. Default: A-1a/A-1c built; A-1b after approval; Phoenix not built on devnet | A-1b (S10c) |
| Q-005 | Yield: Kamino/Jupiter Lend are mainnet-only | Open. Default: honest "mainnet only" state + Earn reserves as yield | A-2a (S14) |
| Q-006 | Solana Mobile / Seeker beyond the PWA? | Open. Default: PWA only | — |
| Q-007 | Public repo licensing for Yosuku-derived CSS | Open. Default: keep repo private | Public visibility |
| Q-008 | Agari X account + X API keys; geofence method; corporate-action source | Partly answered: X keys not a blocker (user, 2026-09-13); geofence S15; corporate actions S6 | S11 live test |
