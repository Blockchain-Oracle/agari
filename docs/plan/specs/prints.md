# Prints spec — policy versions, admission, verification, settlement (frozen at S2.1)

Companion to [`events-engine.md`](events-engine.md), [`events-accounts.md`](events-accounts.md) (layouts §3.2–3.5), [`events-instructions.md`](events-instructions.md) §2, §5.

**Evidence:**
- Plan PD-1, PD-3, PD-6; decisions D-002 and D-003; `services/ops/config/price-sources.json`.
- `C:13` §1(a), §2.3–2.5, §3, §6.2.
- The D-002 spike (`docs/plan/spikes/d002/programs/spike/src/{pyth,redstone,sb}_settle.rs`).
- `R:redstone-rust-sdk@05e3c9f`: `crates/redstone/src/{core/{config,processor,aggregator,validator}.rs, protocol/{constants,payload_decoder,marker}.rs, crypto/mod.rs, types/feed_id.rs, utils/median.rs}`.
- `pyth-solana-receiver-sdk 2.0.0` `src/price_update.rs`.
- Archived trial blob `data/archive/pyth/2026-09-11.jsonl`: TSLA `price 36540074, conf 5926, expo −5, publish_time == T, prev_publish_time == T − 1`.

## 1. Terms

- **Boundaries** of a Window: `T_open = market.trading_start`, `T_close = market.expiry`.
- **Slots** (`Which`): `Open`/`Close` take the version's **primary** policy; `CheckOpen`/`CheckClose` take its **check** policy. `T(which)` is `T_open` for Open/CheckOpen and `T_close` for Close/CheckClose.
- **One source per Window** (PD-1): both primary slots use `version.primary`, so close ≥ open compares like with like. The version is frozen in `market.policy_version` at listing; versions are immutable.

## 2. Policy versions

### 2.1 Defaults (D-003; `price-sources.json` `defaults`)

| Source | `grace_sec` | `max_conf_bps` | `strict_sec` | `min_delay_sec` | `bar_len_sec` | `max_slot_age` | `open_admission_sec` | `close_admission_sec` |
|---|---|---|---|---|---|---|---|---|
| Pyth | 5 | 50 | — | 0 | — | — | 900 | 900 |
| RedStone | — | — | 300 | 0 | — | — | 900 | 900 |
| Switchboard (S6) | — | — | — | 10 | — | 20 | 60 | 60 |
| Attested | — | — | — | 60 | 60 | — | 900 | 900 |
| **Gap-lane Series** (any source) | | | | | | | **`ADMIT_UNTIL_LOCK`** | source default |
| **Check policy** (any source) | source values | | | | | | `= check_admission_sec` (120) | `= check_admission_sec` (120) |

`max_divergence_bps` = 25 and `check_admission_sec` = 120 when a check exists, else both 0. The launch versions from D-003 become `admin_add_policy_version` calls in `scripts/deploy/set-policies.mjs`:
- TSLA v1: Pyth primary + RedStone check, `2026-09-11T00:00Z → 2026-09-25T20:00Z`.
- TSLA v2: RedStone, from `2026-09-25T20:00Z`.
- QQQ/VOO v1: Pyth until `2026-09-25T20:00Z`.
- Single names v1: RedStone, open-ended.
- Times are unix seconds, and open-ended = `i64::MAX`.

### 2.2 Validation in `admin_add_policy_version` (→ `BadPolicy`)

1. `valid_from_ts < valid_until_ts`.
2. **Primary:** `source ∈ {Pyth, RedStone, Switchboard, Attested}`, `feed_id ≠ 0`, `close_admission_sec ≥ 1`, `close_admission_sec ≠ ADMIT_UNTIL_LOCK`, and `open_admission_sec ≥ 1` (`ADMIT_UNTIL_LOCK` allowed only when `series.basis == Gap`).
3. **Per source:**
   - **Pyth:** `1 ≤ grace_sec ≤ 60`, `1 ≤ max_conf_bps ≤ 10,000`, `min_delay_sec == 0`.
   - **RedStone:** `strict_sec ≥ 1`, `min_delay_sec == 0`, `feed_id[0] ≠ 0` (the SDK left-aligns ASCII ids: `FeedId::from(Vec)` trims zeros both sides, so `b"TSLA"` + 28 zero bytes). `config.redstone_signer_count ≥ config.redstone_threshold ≥ 1` must already hold.
   - **Switchboard:** `1 ≤ min_delay_sec`, `max_slot_age ≥ 1`, and each admission `> min_delay_sec`.
   - **Attested:** `bar_len_sec ≥ 1`, `min_delay_sec ≥ 1`, and each admission `> min_delay_sec`.
4. **Check:**
   - `source == None` ⇒ the whole check struct is zero, `max_divergence_bps == 0`, `check_admission_sec == 0`.
   - Otherwise: `source ≠ primary.source`; per-source rules as above; `open_admission_sec == close_admission_sec == check_admission_sec ≥ 1`; `1 ≤ max_divergence_bps ≤ 10,000`.

### 2.3 Version selection (roller, off-chain and on-chain)

`covers(v, W) := v.valid_from_ts ≤ W.trading_start && W.expiry ≤ v.valid_until_ts` (both boundaries, inclusive).

- **Roller (S3):** chooses `k = max { i < version_count : covers(policy_versions[i], W) }`. If no version covers `W`, the Window is **not listed** and the lane reports "paused: no signed source".
- **On-chain `roller_open_window`:** requires `covers(policy_versions[k], W)` and `¬covers(policy_versions[j], W)` for every `j ∈ (k, version_count)` → `SourceNotCovered`. Versions only append, so "highest covering" is stable for already-listed Windows.
- **D-003 examples:**
  - Fri 09-25 19:55 → 20:00Z is covered by TSLA v1 only.
  - The 09-25 Gap Window (20:00Z Fri → Mon) is covered by v2 only.
  - QQQ after 20:00Z on 09-25 is covered by nothing, so it is not listed.

## 3. Admission deadlines (PD-6, per boundary; D-007)

Frozen into the Market at `roller_open_window`:
- `open_deadline = (primary.open_admission_sec == ADMIT_UNTIL_LOCK) ? lock_at : trading_start + primary.open_admission_sec`
- `close_deadline = expiry + primary.close_admission_sec`
- **Check slots** (computed; the version is immutable): `check_deadline(which) = T(which) + check_admission_sec`

**Earliest admission:** `earliest(which) = T(which) + policy.min_delay_sec` (0 for Pyth and RedStone, so `now ≥ T`).

| Operation | Allowed iff (exact) |
|---|---|
| Record a print into slot `w` | `!terminal && slot empty && earliest(w) ≤ now && now ≤ deadline(w)` |
| `public_void_expired` | `!terminal && ((open empty && now > open_deadline) \|\| (close empty && now > close_deadline))` |
| `public_settle_window` | `!terminal && open present && close present && (no check \|\| both checks present \|\| now > expiry + check_admission_sec)` |

- **Exclusivity:** at `now == deadline` only the print is admissible; at `now == deadline + 1` only the void. Race tests cover both transaction orders at `deadline` and `deadline + 1` for:
  - intraday Pyth/RedStone/attested (T + 900);
  - the Gap open (`lock_at`);
  - Switchboard (T + 60);
  - the check bound (T_close + 120).
- **Pyth clock tolerance:** the plan's `publish_time ≤ now + 2` is replaced by the universal `now ≥ T` (the uniqueness window already pins the update, and a lagging cluster clock merely delays the post by seconds; D-007).

## 4. Recording

**Code split:**
- Source verifiers live in `agari-common::print::{pyth, redstone, attested, median}` (Switchboard in S6). They are **pure functions** over `(bytes or decoded account, &PrintPolicy, T, now, &ConfigView) → Result<RawPrint{price, expo, source_ts, signers}, PrintError>`, so they are unit-tested against the real archived fixtures.
- Instruction handlers in `agari-events` do the account and slot rules (§4.0), then call them.
- `normalize` (§4.6) is shared.

### 4.0 Shared checks, in order (every `public_record_print_*`)

1. `market.series == series` (SeriesMarketMismatch).
2. `which ≤ 3` (BadPrintSlot).
3. Not terminal (MarketAlreadyTerminal).
4. `v = series.policy_versions[market.policy_version]`; `policy = which ∈ {Open, Close} ? v.primary : v.check`; `policy.source == this instruction's source` (WrongPrintSource; includes a check slot on a version without a check).
5. The slot is empty (PrintAlreadyRecorded: first valid print wins).
6. `now ≥ earliest(which)` (PrintTooEarly).
7. `now ≤ deadline(which)` (PrintTooLate).
8. Source verification (§4.1–4.4) → `(price, expo, source_ts, signers)`.
9. Normalization (§4.6) → `Print{price, expo: −8, source_ts, source, signers, flags: 0}`.
10. `event_seq += 1`; emit `PrintRecorded`.

### 4.1 Pyth (`public_record_print_pyth`)

`price_update: Account<PriceUpdateV2>`. **Anchor's owner check is the receiver compiled into `pyth-solana-receiver-sdk`:**
- default feature → `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`;
- `pro-compatible` → `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp`.

**Decision deferred to the S2 prints step (D-002):** post an archived trial blob to each devnet receiver and keep the feature whose post verifies. A wrong receiver fails Anchor's owner check (AccountOwnedByWrongProgram); tests assert this.

1. `verification_level == Full` (InsufficientVerification).
2. `price_message.feed_id == policy.feed_id` (FeedIdMismatch).
3. `prev_publish_time < T ≤ publish_time ≤ T + grace_sec` (PrintNotUnique). Exactly one update per feed satisfies it (1 s granularity; the archive shows `prev == T − 1`).
4. `price > 0` (InvalidPrintValue).
5. `conf × 10,000 ≤ price × max_conf_bps` in u128 (ConfidenceTooWide). A halted feed's wide confidence gives no print, so the Window voids.
6. Output: `(price, exponent, publish_time, signers 0)`.

**Relay (S3):**
1. `GET /v2/updates/price/{T}?ids[]=…&encoding=base64` at T + 2 s.
2. Post via the receiver.
3. Record.
4. **Close the `PriceUpdateV2` account** (≈ 0.0013 SOL).
5. Archive the blob for the S5 proof replay.

### 4.2 RedStone (`public_record_print_redstone(which, payload)`)

**Wire format** (RedStone `protocol/constants.rs`; every integer **big-endian**). Our program **requires single-feed packages with 32-byte values**, so each package is exactly 142 B:

```
package  = feed_id[32] ‖ value[32] ‖ timestamp_ms[6] ‖ value_size[4]=32 ‖ data_point_count[3]=1 ‖ signature[65] (r‖s‖v, v ∈ {0,1,27,28})
payload  = package × N ‖ package_count[2]=N ‖ unsigned_metadata[0] ‖ unsigned_metadata_size[3]=0 ‖ REDSTONE_MARKER[9]=0x000002ed57011e0000
len(payload) = 142·N + 14          (N = 5 → 724 B)
signed bytes = the first 77 B of the package; signer = keccak256(pubkey(secp256k1_recover(keccak256(signed), v, r‖s)))[12..]
```

**Relay construction from the gateway JSON** (`/data-packages/historical/redstone-primary-prod/<T_ms>` on `oracle-gateway-2`):
- Take the packages whose `dataPackageId == feed` with exactly one data point.
- `feed_id` = ASCII left-aligned and zero-padded.
- `value` = the decimal string × 10⁸ as a big-endian u256 (exact decimal arithmetic, never floats).
- `timestamp_ms` = `timestampMilliseconds`.
- `signature` = base64-decoded 65 B.
- Archive the JSON in Postgres (≈ 24 h gateway retention).

**Verification, in order:**
1. **Pre-parse, no crypto** (BadRedStonePackage):
   - `len ≥ 14`; the marker matches; `unsigned_metadata_size == 0`.
   - `N = package_count`, `1 ≤ N ≤ config.redstone_signer_count`, `len == 142·N + 14`.
   - Every package has `data_point_count == 1` and `value_size == 32`.
   - This bounds the payload and heap and avoids the SDK's `Sanitized` panic path.
2. Every package's `feed_id == policy.feed_id` (FeedIdMismatch).
3. Every package's `timestamp_ms == T × 1000` (RedStoneTimestampMismatch). T is on the 10 s grid, since boundaries are whole minutes.
4. **Required count:** `required = now < T + strict_sec ? config.redstone_signer_count (5) : config.redstone_threshold (3)`; `N ≥ required` (InsufficientRedStoneSigners). **Anti-selection:** inside `strict_sec` a poster must present every configured signer.
5. **SDK, per D-002:**
   ```
   Config::try_new(threshold = N, signers = config.redstone_signers[..count], feed_ids = [policy.feed_id],
                   block_timestamp = T·1000, max_timestamp_delay_ms = Some(0), max_timestamp_ahead_ms = Some(0))
   process_payload(&mut (config, SolanaCrypto).into(), payload)
   ```
   **Threshold = N (the posted count) means every posted package must be a valid, distinct, authorised signature.**
   - The SDK silently skips unknown signers, failed recoveries and zero values, which drops the feed below N → `values` empty → InsufficientRedStoneSigners.
   - A repeated signer (including a malleated duplicate: high-s signatures are rejected, and a low-s twin recovers the same address) returns `Error::ReoccurringFeedId` → BadRedStonePackage. **The whole print is refused rather than "counted once"** (stricter than plan P§8's wording; D-007).
   - Map SDK errors explicitly, never with `?`:
     - `TimestampTooOld | TimestampTooFuture | TimestampDifferentThanOthers` → RedStoneTimestampMismatch;
     - everything else → BadRedStonePackage;
     - `Ok` with empty values → InsufficientRedStoneSigners.
   - `UnknownRedStoneSigner` is not raised on this path (reserved).
6. `validated.timestamp == T·1000` and `values[0].feed == policy.feed_id` (defence in depth; the spike does the same).
7. **Value:** `values[0].value` (u256 BE). Bytes `[0..24]` must be 0, and the low 8 bytes read as a `u64` must satisfy `0 < v ≤ i64::MAX` (InvalidPrintValue).
   - **Median rule (SDK `utils/median.rs`):** odd N → the middle value; even N → `avg(a, b) = (a >> 1) + (b >> 1) + (((a & 1) + (b & 1)) >> 1)`, i.e. `⌊(a + b) / 2⌋`, computed without overflow. The TS mirror must match.
8. Output: `(price = v, expo = −8, source_ts = T, signers = N)`.

**Cost and size:**
- ≈ 25k CU per package recovery (5 → ≈ 125k) plus parsing and emitting ≈ 140–170k.
- The transaction is ≈ 1,080 B (`events-instructions.md` §6) with no ALT needed; **S2 measures both on Surfpool**.
- Heap: the SDK clones the remaining payload once per package (≤ 5 × 724 B), well under 32 KB.

### 4.3 Attested (`public_record_print_attested(which, price, expo, bar_start_ts, fetched_at_ts)`)

1. `get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT` (CpiNotAllowed). The "previous instruction" reference only means something at transaction level.
2. `bar_start_ts == T − policy.bar_len_sec` (BadAttestation). The bar ends at the boundary.
3. `T + policy.min_delay_sec ≤ fetched_at_ts ≤ now` (BadAttestation). The correction cutoff is also enforced by §4.0 step 6.
4. `cur = load_current_index_checked(instructions)`, `cur ≥ 1`; `ix = load_instruction_at_checked(cur − 1)`; `ix.program_id == Ed25519SigVerify111111111111111111111111111` (BadAttestation).
5. `ix.data`: `num_signatures (u8) == 1`, one padding byte, then offsets (14 B, LE u16):
   - `signature_offset, signature_instruction_index, public_key_offset, public_key_instruction_index, message_data_offset, message_data_size, message_instruction_index`.
   - Each `*_instruction_index ∈ {cur − 1, u16::MAX}`, so every offset points into that same instruction (the known offsets attack).
   - All ranges are in bounds; `message_data_size == 158` (BadAttestation).
6. `pubkey = ix.data[public_key_offset..+32]` ∈ `config.attestors`, non-zero (UnknownAttestor).
7. `ix.data[message_data_offset..+158] == expected_message` byte for byte (BadAttestation). The precompile has already verified the signature, or the transaction would have failed.
8. `price > 0`, `−18 ≤ expo ≤ 0` (InvalidPrintValue). Output: `(price, expo, source_ts = T, signers = 1)`.

**`expected_message` (158 B; integers LE):**

| Bytes | Field |
|---|---|
| 14 | `b"agari-print-v1"` |
| 32 | `program_id` |
| 1 | `config.cluster_tag` |
| 32 | `market` |
| 1 | `which` |
| 8 | `boundary_ts` = T (i64) |
| 8 | `price` (i64) |
| 4 | `expo` (i32) |
| 8 | `source_ts` = T (i64) |
| 32 | `policy.feed_id` (attested source hash, e.g. `sha256("jupiter-price-v3-median3:TSLAx")`) |
| 8 | `bar_start_ts` (i64) |
| 2 | `policy.bar_len_sec` (u16) |
| 8 | `fetched_at_ts` (i64) |

The plan's arg list omitted `source_ts`; it is derived as T, not passed. Attested prints are "demo data" only by user opt-in (plan PD-1).

### 4.4 Switchboard (`public_record_print_switchboard(which)`) — **deferred to S6**, rules frozen now

Crate: `switchboard-on-demand 0.13.0`, `default-features = false, features = ["solana-v3"]`, plus the `getrandom` custom stub (D-002).
1. `queue.key() == config.switchboard_queue` (SwitchboardQueueMismatch). `QuoteVerifier` checks only the size.
2. `cur = load_current_index_checked(instructions)`. The quote's ed25519 instruction is at `cur − 1`, program id `Ed25519SigVerify…` (BadAttestation).
3. Every offsets record's three instruction-index fields are `u16::MAX` or `cur − 1` (BadAttestation). This is the JS SDK 3.10.6 `0xFFFF` encoding workaround; `C:13` §2.5.
4. `QuoteVerifier::new().queue(queue).slothash_sysvar(slothashes).ix_sysvar(instructions).clock_slot(clock.slot).max_age(policy.max_slot_age).verify(data)`. SlotHashes membership blocks cross-cluster replay, since devnet and mainnet share oracle keys. Failure → QuoteSlotStale when the slot is too old, else BadAttestation.
5. **Distinct** oracle indices (the verifier doesn't dedupe): a repeated index → DuplicateOracle; `distinct ≥ config.switchboard_min_oracles` (TooFewOracles).
6. `quote.feed(&policy.feed_id)` exists (SwitchboardFeedMismatch).
7. `clock.slot − quote.slot ≤ max_slot_age` (QuoteSlotStale).
8. Output: `(value i128 scaled 10¹⁸, expo −18, source_ts = T, signers = distinct)`. Admission is clock-bounded by §4.0: `T + min_delay_sec ≤ now ≤ T + admission_sec`. The label is "observed ≤ 60 s after T".

### 4.5 `public_copy_open_from_prev`

Accounts `series r · market w · prev_market r · +E`. In order:
1. `market.series == series`, `prev_market.series == series`, `prev_market ≠ market` (PrintNotAdjacent).
2. Not terminal (MarketAlreadyTerminal); `market.open` empty (PrintAlreadyRecorded).
3. `now ≤ market.open_deadline` (PrintTooLate).
4. `prev.expiry == market.trading_start` and `prev.policy_version == market.policy_version` (PrintNotAdjacent). A Friday close therefore never becomes a Monday open: there is a time gap, and the version or series differs.
5. `prev.close` present (PrintsMissing).

**Effects:**
- `open = prev.close` with `flags |= COPIED_FROM_PREV`.
- If `prev.check_close` is present and `market.check_open` is empty and `now ≤ T_open + check_admission_sec`, copy it too. Otherwise the check slot stays open for its own print.
- One `PrintRecorded{copied: true}` per copied slot (the second increments `seq` again).

### 4.6 Normalization to expo −8 (checked i128)

```
p = i128::from(raw_price); e = raw_expo
require!(p > 0 && -18 <= e && e <= 0)                    // InvalidPrintValue
if e >= -8:  q = p.checked_mul(10^(e + 8))              // exact (Pyth equities e = −5 → ×1,000)
else:        q = p / 10^(−8 − e)                          // floor (p > 0), e.g. Switchboard 10¹⁸ → ÷10¹⁰
require!(0 < q && q <= i64::MAX)                          // InvalidPrintValue
```

Floor only affects sources finer than 10⁻⁸ (Switchboard). Both boundaries of a Window use the same source and rule, so close ≥ open is consistent.

## 5. `public_settle_window` (cross-check, PD-1, PD-3)

In order:
1. `market.series == series` (SeriesMarketMismatch); not terminal (MarketAlreadyTerminal).
2. `open` and `close` present (PrintsMissing).
3. If `v.check.source ≠ None`:
   - `both = check_open present && check_close present`.
   - `!both && now ≤ expiry + v.check_admission_sec` → **CrossCheckPending**. An early settler can't skip the check.
   - For each **present** pair `(primary, check)` ∈ {(open, check_open), (close, check_close)}: `|p − c| × 10,000 > v.max_divergence_bps × p` (i128) → **void 0.5/0.5, `CrossCheckDivergence`**. A present check that diverges always voids, even if the other check is missing.
   - No divergence and `!both` → settle, with `single_source = true` (`Market.flags |= SINGLE_SOURCE`).
4. `close.price ≥ open.price` → `(payout_yes, payout_no) = (10⁷, 0)`, winner Yes; else `(0, 10⁷)`, winner No. **PD-3: ties go to Up.**
5. `state = Resolved` (or `Voided` from step 3), `resolved_ts = now`; init `MarketResult` (all four prints, payouts, version, void reason, single-source, winner, `rent_payer = payer`); `seq += 1`; emit `WindowResolved`.

There is no deadline once both primary prints exist. The labels are "oracle price at 16:00:00 ET", never "official close".

## 6. `public_void_expired` (PD-6)

In order:
1. `market.series == series`; not terminal (MarketAlreadyTerminal).
2. `(open empty && now > open_deadline) || (close empty && now > close_deadline)`, else **SettlementWindowOpen**. That covers both "admission still open" and "nothing missing: settle instead".
3. `payout = (5,000,000, 5,000,000)`, `state = Voided`, `void_reason = MissingPrint`, `winner = Void`, `resolved_ts = now`; init `MarketResult`; emit `WindowResolved`.

A void can land before `lock_at` (an open print missing past `open_deadline` on a 15 m/60 m Window). Trading stops immediately; orders drain by cancel or sweep (events-engine.md §5.2, §7).

**Void reasons:** `MissingPrint` (primary slot empty past its deadline) and `CrossCheckDivergence` (§5 step 3). A missing **check** print never voids; it only flags `single_source`.

## 7. Fixtures and open items for later S2 steps

- **Pyth fixture:** `data/archive/pyth/2026-09-11.jsonl` (391 boundaries, all `exactT`). Copy one 16:00:00 blob to `anchor/tests/vectors/prints/pyth-tsla-<T>.b64`.
- **RedStone fixture:** `data/archive/redstone/` was **empty** at spec time, with no session since the archiver started 09-13. The first archived TSLA/NVDA 5-signer package set at a session boundary (from 2026-09-14 13:30Z) becomes `anchor/tests/vectors/prints/redstone-tsla-<T>.json` plus its 724 B wire payload. Recheck the archiver output before the prints step.
- **Decide the Pyth receiver feature** by a real devnet post (§4.1).
- **Measure** RedStone 5-package CU and transaction bytes on Surfpool; the fallback is an ALT if > 1,232 B.
- **Verify** RedStone `TSLA` feed behaviour at 09:30:00 on a real Monday before the Gap lane (S6, plan P§2.2).
