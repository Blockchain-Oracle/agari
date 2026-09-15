# Session lanes spec (S6): Gap, 24/7 token, halts and voids, holdings hedge, states

**Authority:** plan §2.2, §3.1, §3.3, §7.2 S6; `prints.md` (§2–§6; §4.4 frozen Switchboard rules); `events-instructions.md`; `venue-ops.md` §4–§8, §10; `first-call.md` §6–§7; D-003, D-007, D-011, D-013, D-021, D-024, D-026…D-036; Masayume `68f7a09`. Frozen at the S6 foundation commit (D-051). Changes need a D-entry.

**Clock facts (2026-09-15 05:20Z):**
- Submissions close **Fri 2026-09-18 20:00Z** (09-18 is a Friday; the brief said Thursday). That instant is 16:00 ET, the opening boundary T of the 09-18 Gap Window. **No Gap Window can trade or settle before submission.**
- The Pyth trial covers TSLA/QQQ/VOO boundaries through `2026-09-25T20:00Z` (`services/ops/config/price-sources.json:27-31`).
- **Spike (b) data already exists.** The S0 RedStone archiver samples a 10 s grid 09:29–09:31 ET at every open (`scripts/archive/redstone.mjs:22-25`). It recorded the real Monday 09-14 open in `data/archive/redstone/2026-09-14.jsonl` (main checkout, gitignored), next to Pyth's exact-T blobs in `data/archive/pyth/2026-09-{11,14}.jsonl`. It is still running and captures the 09-15…09-18 opens.

## 1. Gap lane (6a)

### 1.1 Spike (b) evidence: the real Monday 09-14 open (medians of the archived signer values, USD)

| ET | RedStone `TSLA` | `TSLA---EXTENDED` | RedStone `NVDA` | `NVDA---EXTENDED` | Pyth TSLA (exact T) |
|---|---|---|---|---|---|
| 09:29:50 | 365.4859 (Friday's value, frozen; 5 signers) | 359.8923 | 218.2457 (frozen) | 211.3954 | — |
| **09:30:00** | **359.6240** (5 signers) | 359.6255 | **211.2848** | 211.3036 | **359.81147** (`35981147e-5`, conf 15,853 = 4.4 bps, prev 09:29:59) |
| 09:30:10 | 359.7043 | 359.9412 | 211.1286 | 211.1459 | — |
| 09:30:30 | 360.1380 | 360.6073 | 210.4858 | 210.4248 | — |

- **Regular feeds** hold the prior session's value until 09:30:00 and print a fresh value at exactly T. At T they agree with `---EXTENDED` (TSLA 0.04 bps, NVDA 0.9 bps).
- **Cross-check at the open:** RedStone vs Pyth TSLA = 5.2 bps. At the Friday 09-11 close it was 0.2 bps (Pyth 365.47600 vs RedStone 365.4827, D-003). Both are inside the 25 bps band.
- **Signer counts:** at 09:30:00, AAPL/NVDA/TSLA had 5 signers but **MSFT, META, AMZN and GOOGL had only 3** (the archiver accepts ≥ 3, `redstone.mjs:56`); all seven had 5 by 09:30:10. A 3-package print is admissible only after `T + strict_sec` (300 s) and before T + 900 (prints.md §4.2 step 4), so those four names sit exactly at the threshold.
- **Rule (D-052):**
  - The Gap close uses the regular data feed id (`TSLA`, not `---EXTENDED`) at T + 0.
  - Label: "oracle price at 09:30:00 ET", the first regular-session print, not the opening cross (C:13 §6.2).
  - 6a re-reads the 09-15/16/17 open rows before listing. A RedStone name lists for 09-18 only if every recorded open had ≥ 3 signers at 09:30:00.
- **Last real weekend by Pyth (the LiteSVM replay data):** TSLA 365.47600 → 359.81147 (−1.55%), QQQ 714.90000 → 703.32500, VOO 702.49748 → 697.68105; all three settle **Down**.

### 1.2 Policy versions (basis 1, cadence seed `GAP_CADENCE_SEC` 604,800; `constants.rs:37`)

Versions are built from the ticker versions in `price-sources.json` with one change: `primary.open_admission_sec = ADMIT_UNTIL_LOCK` (`constants.rs:43`), which `policy_rules.rs:61-63` accepts only on a Gap Series. The Friday print can then be posted until Sunday 20:00 ET, and `window_rules.rs:60-62` freezes `open_deadline = lock_at`.

| Series (`ticker` id) | Version | Validity (UTC, inclusive) | Primary | Check | Admission open / close |
|---|---|---|---|---|---|
| TSLA (1) | v1 | `2026-09-11T00:00Z → 2026-09-25T20:00Z` | Pyth `16dad506…32f1`, grace 5, conf 50 bps | RedStone `TSLA`, strict 60, 120/120, 25 bps (Q-S6-2) | `ADMIT_UNTIL_LOCK` / 900 |
| TSLA (1) | v2 | `2026-09-25T20:00Z →` open-ended | RedStone `TSLA`, strict 300 | none | `ADMIT_UNTIL_LOCK` / 900 |
| QQQ (8), VOO (9) | v1 | `2026-09-11T00:00Z → 2026-09-25T20:00Z` | Pyth | none | `ADMIT_UNTIL_LOCK` / 900 |
| NVDA (2), AAPL (3), MSFT (4), META (5), AMZN (6), GOOGL (7) | v1 | `2026-09-11T00:00Z →` open-ended | RedStone, strict 300 | none | `ADMIT_UNTIL_LOCK` / 900 |

**Coverage (prints.md §2.3, `series.rs:41-44`):**
- **09-18 Gap** `[1789761600 Fri 20:00Z, lock 1789948800 Mon 00:00Z, expiry 1789997400 Mon 13:30Z]`: v1 on every Series.
- **09-25 Gap** (`window_rules.rs:110-113`): TSLA v2; QQQ/VOO have no covering version → `paused: no signed source`.

### 1.3 Devnet Series and SOL (registered by the stage owner from 6a's `scripts/deploy/init-gap-series.ts`, new)

- **Grid:** `LAUNCH_GRID` (`venue-spec.ts:25-34`; `max_lead_sec` 400,000 ≥ the 48 h lead), **one 256-node Book** per Series (plan §3.3).
- **Rent:** devnet is 5,080 lamports/B (acceptance.md:16). Series (1,368 + 128) B = 0.00760 SOL; Book 44,680 B = 0.22762 SOL; so 0.2352 SOL per Series.
- **Nine Series** (TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL, QQQ, VOO, basis 1) = **2.117 SOL** kept.
- **Per Window:** Market 0.00297 + Ledger (96 seats) 0.04409 + mvault 0.00149 = 0.0486 SOL. That is **≈ 0.44 SOL float** for nine Windows, returned at close, plus MarketResult 0.00195 each for the settler.
- If Q-S6-1 holds back MSFT/META/AMZN/GOOGL, it is five Series = 1.176 SOL.

### 1.4 Roller (`window-roller/plan-gap.ts`, new; pure like `plan.ts:71-97`)

- **Candidates:** `gapWindows(calendar)` (`packages/core/src/market/windows.ts:94-112`). The calendar spans 7 days back and 14 ahead (`session-service.ts:21-22`), so the next weekend is always known. An unknown date lists nothing.
- **Pick** the earliest Gap Window `W` with all of:
  - `W.tradingStart ≥ lastExpiry`;
  - `W.lockAt − now ≥ 60`;
  - `W.tradingStart − now ≤ ROLLER_GAP_LEAD_SEC` (new; default 172,800, so a Window lists from Wednesday 16:00 ET);
  - a covering version (`versions.ts:56-59`);
  - `now + 45 ≤ open_deadline` (`versions.ts:46-50`).
- **Check-bound exception:** unlike Regular, a Gap Window past its check bound still lists and settles `single_source`, because the next candidate is a week away.
- **Corporate skip** on **either** the Friday or the Monday ET date, via core `skipApplies` (§3.4). Today `plan.ts:81` checks only the start date.
- **Lane key:** `"TSLA-gap"`. Today `execute.ts:43` makes every key `<SYM>-<min>m`.
- **Book:** the previous Gap Window's Book is recycled at its lock (`execute.ts:88-117`), so one Book suffices.

### 1.5 Relay, settler, maker

- **Relay:**
  - A Gap slot joins the existing `(source, T)` units: Friday 20:00Z and Monday 13:30Z are Regular boundaries, so it reuses the same Hermes and gateway fetch (`relay-pass.ts:150-154`, `boundary-cache.ts:69-99`).
  - **New `price-relay/gap-slots.ts`:** a RedStone Gap open slot still empty after the gateway's ≈ 24 h history (C:13 §3) is posted from `print_archive` rows `(redstone, feed, T)`, which `archive-pass.ts` writes for every session-close boundary. This needs 6a's `packages/db/src/print-archive-read.ts` (new). Pyth history comes from Hermes by timestamp.
- **Settler:** no rule change. `decide.ts:56-71` already voids at `open_deadline + 1` = `lock_at + 1`, and settles after both Monday prints (check bound T + 120 for TSLA v1).
- **Maker (`seat/gap-fair.ts`, new):**
  - Quotes Fri 16:00 → Sun 19:59 ET, which the in-session gate at `seat/index.ts:39-40` does not allow today.
  - Fair = the `fair.ts` z-score, using the xStock token spot (§2.4) as the weekend reference for TSLA/NVDA/QQQ (SPY has no Gap). Other names get 500 ticks with a wide spread.
  - `MM_GAP_MAX_CASH` default 25 tUSDC.
  - Without quotes a hedge IOC fills nothing (D-033), so this is needed for §4.

### 1.6 The honest pre-deadline path

1. **Tue 09-15:** D-052 from §1.1, re-checked at the 13:30Z open.
2. **Wed 09-16:**
   - Foundation and 6a merge.
   - The stage owner registers the Gap Series on devnet (§1.3).
   - The roller lists the 09-18 Windows (48 h lead). `/markets` shows the Gap lane in its *Listed* state: "Monday Gap · calls open Fri 16:00 ET · locks Sun 20:00 ET · settles on the Mon 09:30:00 ET print".
3. **By Thu 09-17:**
   - **LiteSVM real-weekend replay** (`anchor/tests/events_gap.rs`, new): the archived Pyth blobs at Fri 09-11 20:00Z and Mon 09-14 13:30Z. Account bytes come from posting each blob on a Surfpool devnet fork, the D-021 method; the 09-11 TSLA fixture already exists at `anchor/tests/vectors/prints/pyth-tsla-1789156800.account.b64`. Clock set freely, the test drives open print → trade → `MarketNotTrading` at `lock_at` → close print → settle Down → redeem, plus the PD-6 race at `lock_at` / `lock_at + 1` in both orders.
   - **Surfpool time-travel drive** (`scripts/drive/gap-cycle.ts`, new) on drive-only Gap Series 901. Its attested primary is labelled drive data. Surfpool's clock moves only forward (D-027), so real past prints can't be replayed there.
4. **Thu 09-17 20:00Z → Fri 09-18 13:30Z (Q-S6-3):** a devnet **overnight Gap drive** on drive-only Series 902 (basis 1, the TSLA Pyth version), with real prints posted by the drive. It is the only real-print devnet Gap settlement possible before submission, and leaves 6.5 h to spare.
5. **After submission, no redeploy:**
   - 09-18 Windows trade from Fri 20:00Z, lock Mon 00:00Z and settle on the 09-21 13:30Z prints.
   - 09-25: TSLA on RedStone v2; QQQ/VOO show `MARKETS.paused.noSource` "Paused: no signed price source" (`web/src/lib/copy.ts:130`).
   - Monday results go to `acceptance.md` as post-deadline evidence, never as a submission claim.

## 2. 24/7 token lane (6b)

### 2.1 Spike (a) (D-053, devnet, before any program code)

1. **Feed:** `[switchboardSurgeTask { source: WEIGHTED, symbol: "TSLAX/USD" }]` for TSLAX, NVDAX, SPYX and QQQX (C:13 §3 Surge row). Feed hash = sha256 of the length-delimited protobuf (C:13 §2.3). Pin it in `price-sources.json` `tokenLane.<xStock>.feedHash`.
2. **Quotes:** `queue.fetchQuoteIx(crossbar, [4 feeds], { numSignatures: n })` on queue `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` (9 oracles), for n = 1…5. Record the maximum n that answers; C:13 saw 2 on Sunday, and HTTP 500 above the maximum.
3. **Decode** `OracleQuote` (`reference/switchboard-examples/solana/feeds/advanced/scripts/runUpdate.ts:84-95`): distinct oracle indices, slot and values.
   - **Basis check:** compare each value with Jupiter `usdPrice`, which is per UI token with the multiplier applied (C:13 §5). The difference must stay below 1.5%. The documented basis is "TSLAx/USD per token (UI amount)".
4. **Measure on a Surfpool fork:**
   - transaction bytes and CU for `[ed25519 quote (n sigs, 4 feeds), public_record_print_switchboard]`;
   - if the transaction exceeds 1,232 B, use a v0 transaction with an ALT of the static keys (config, sysvars, queue, event authority, program);
   - the `.so` size under `anchor build --arch v0` (D-024) with the crate in.
5. **Outcome:**
   - `switchboard_min_oracles` = min(3, observed max).
   - If the maximum is 2: min 2, token caps halved, and receipts say "signed by 2 oracles" (Q-S6-4).
   - If the maximum is below 2, or quotes fail: the lane is paused, and the Jupiter fallback runs only by opt-in (§2.5).

### 2.2 Program change (frozen interfaces)

**`agari-common` (feature `switchboard = ["dep:switchboard-on-demand"]`)**
- The workspace pin already exists (`anchor/Cargo.toml:25`), plus D-002's `getrandom` custom stub.
- **New `print/switchboard.rs`:**
  - `check_quote_ix(program_id, data, current_index) -> Result<(), PrintError>`: the ed25519 program id, and every offsets record's three index fields ∈ {`u16::MAX`, `cur − 1`} (prints.md §4.4 steps 2–3).
  - `quote_print(q: &QuoteView{slot, oracle_idxs, feeds: &[([u8;32], i128)]}, feed_id, max_slot_age, min_oracles, clock_slot, t) -> Result<RawPrint, PrintError>`. Refusals, in order: distinct indices (DuplicateOracle), `distinct ≥ min` (TooFewOracles), feed present (SwitchboardFeedMismatch), `clock_slot − slot ≤ max_slot_age` (QuoteSlotStale).
  - **Pre-normalized output:** it returns `normalize(value, −18)` as `{price, expo: −8, source_ts: t, signers: distinct}`, because `RawPrint.price` is `i64` (`print/mod.rs:18-25`) and $360 × 10¹⁸ exceeds `i64::MAX`. `record` then multiplies by 10⁰ (`normalize.rs:17-19`); the floor is identical.
- **`PrintError` gains** `SwitchboardFeedMismatch, SwitchboardQueueMismatch, DuplicateOracle, TooFewOracles, QuoteSlotStale`. They map onto the existing codes 6214–6218 (`errors.rs:128-137`) in `print_rules.rs:14-28`. There are no new error codes.

**`agari-events` `instructions/record_print_switchboard.rs` (new) + dispatch `public_record_print_switchboard(ctx, which: u8)` in `lib.rs`**
- **Accounts:** `series`, `market` (mut), `config` (seeds), `queue` (unchecked), `slothashes` (address = SlotHashes), `instructions` (address = Instructions), plus `#[event_cpi]`.
- **Order:**
  1. `admit(…, Source::Switchboard, now)` (`print_rules.rs:58-71`): `T + 10 ≤ now ≤ T + 60`.
  2. Stack height is transaction level (CpiNotAllowed; as attested, `record_print_sources.rs:99`).
  3. `queue == config.switchboard_queue` (SwitchboardQueueMismatch).
  4. `check_quote_ix` on the instruction at `cur − 1`.
  5. `QuoteVerifier::new().queue().slothash_sysvar().ix_sysvar().clock_slot().max_age(policy.max_slot_age).verify(data)`. A failure is QuoteSlotStale when the slot is too old, else BadAttestation.
  6. `quote_print` → `record` → emit.
- **Layouts:** unchanged (sizes as D-013), so this is an in-place upgrade. The IDL gains one instruction.

### 2.3 Upgrade (stage owner) and SOL

1. `NO_DNA=1 anchor build --arch v0`; record size and sha256. Today's binary is 764,200 B (acceptance.md:19-20).
2. On a Surfpool devnet fork, load the new `.so` at `cDcHZ…`. Run 6b's proofs and re-run `pnpm drive:events` as the regression.
3. Devnet: `solana program deploy --program-id <agari_events keypair> --upgrade-authority deployer --buffer <fresh buffer keypair> anchor/target/deploy/agari_events.so`.
   - solana-cli 3.1.10 auto-extends the program data (`--no-auto-extend` is opt-out).
   - Resume a failed write with the same `--buffer` (acceptance.md:19-20).
   - Dump the deployed program and compare sha256.
4. `pnpm codegen`, then republish the IDL via program-metadata (D-026; ≈ 0.06 SOL, acceptance.md:31).
5. `admin_set_authorities` with the **full** current set, plus the queue above and `switchboard_min_oracles` from D-053. The instruction replaces every field (`admin_set_authorities.rs:58-67`; placeholder at `venue-spec.ts:97-99`).

**SOL:**
- **Buffer:** ≈ `.so` bytes × 5,080 lamports. That is 3.9 SOL today and ≈ 4.4–4.9 SOL if the crate adds 100–200 KB; the buffer is refunded at upgrade.
- **Extension:** Δ bytes × 5,080, ≈ 0.5–1.0 SOL, kept.
- **Writes:** ≈ 0.005 SOL.
- **Peak on the deployer:** ≈ 5.5 SOL.

### 2.4 Token Series, roller, relay, settler

**Series:** tickers 1 TSLA/TSLAx, 2 NVDA/NVDAx, 10 SPY/SPYx and 8 QQQ/QQQx × cadences 300/900/3,600, basis 2.
- **Books:** 2 × 256 nodes each (plan §3.3).
- **v1:** Switchboard primary, `feed_id` = spike hash, min delay 10, admission 60/60, max slot age 20, no check, from the upgrade day, open-ended.
- **Rent:** 12 × (0.00760 + 2 × 0.22762) = **5.554 SOL** kept.
- **Float:** 1,632 Windows/day, Markets retained 6 h (`venue-spec.ts:13`). That is ≈ 1.2 SOL of Markets plus ≈ 1.0 of live Ledgers/mvaults (roller), and ≈ 0.8 of results (settler), so **≈ 3 SOL** steady.
- **Fees:** ≈ 11.3 slots per 5-minute T × 20,000 lamports (tx plus 3 ed25519 signatures, C:13 §2.1) ≈ 0.065 SOL/day. Copying opens (below) brings it to ≈ 0.041.

**Roller (`window-roller/plan-token.ts`, new):**
- Candidates from `tokenWindows(now − cadence, now + lead + cadence, cadence)` (`windows.ts:115-123`); no calendar; lead 120 s (`plan.ts:48`).
- Skips only for multiplier events (§3.4) and issuer halts (§3.1).
- Lane key `"TSLAx-5m"`.

**Relay (`price-relay/switchboard-pass.ts`, new):** today the relay skips Switchboard slots (`relay-pass.ts:142`). The new pass, per T at T + 10 s:
1. Collect the token slots due at T (`slots.ts:75-89`).
2. Fetch **one** quote (≤ 8 feeds, `numSignatures = min_oracles`) from `packages/markets/src/prices/legacy/switchboard-quote.ts` (new; `@switchboard-xyz/on-demand` 3.10.6 on web3.js 1, like Pyth's lane).
3. Send every close slot as `[quote ix, record]` in parallel with the same quote bytes, inside 20 slots.
4. On QuoteSlotStale with ≥ 5 s left, retry once with a fresh quote.
5. Fill open slots with `public_copy_open_from_prev` once the previous close is in (prints.md §4.5).

A missed slot is reported, and the settler voids at T + 61.

**Settler:** unchanged, since there is no check.

**Maker (`seat/token-fair.ts`, new):** quotes 24/7 with `MM_TOKEN_MAX_CASH_PER_WINDOW` 10 tUSDC.

**Spot (`services/ops/src/prices/xstock-spot.ts`, new):** Jupiter Price v3 `usdPrice` for the four verified mints (`price-sources.json:69-72`), one call every 5 s (keyless 0.5 RPS, C:13 §5), published under the xStock symbol for the chart only ("chart follows Jupiter").

### 2.5 Jupiter attested fallback (code and Surfpool proof; devnet only by Q-S6-5)

- **Version:** attested, `feed_id = sha256("jupiter-price-v3-median3:TSLAx")` (`attested.rs:27`), min delay 60, bar 60, admission 900 (prints.md §2.1).
- **Relay (`price-relay/jupiter-attest.ts`, new):**
  - Samples verified mints only at T − 40, T − 20 and T. All three sit inside the bar `[T − 60, T]`.
  - Takes the median. The decimal text is scaled ×10⁸ exactly, as RedStone values are in D-027; no floats.
  - Records through `recordAttestedSlot` (`record.ts:65-82`) at ≥ T + 60.
- **Label:** "Attested demo" (`print-source.ts:9`).
- **Switching sources:** appending a version moves every future Window of the Series (`series.rs:41-44`), and switching back needs another append (8 at most, `constants.rs:29`).

### 2.6 Proofs (6b)

- **Pure tests** on a real captured devnet quote (`anchor/tests/vectors/prints/switchboard-<slot>.hex`).
- **LiteSVM `events_switchboard.rs`** refuses each of these:
  - wrong queue;
  - duplicate oracle index;
  - fewer oracles than the minimum;
  - quote slot older than `max_slot_age`;
  - wrong feed;
  - index field not `0xFFFF` / `cur − 1`;
  - before `T + 10`;
  - after `T + 60`.
- **Live quote (D-055 amendment):** Surfpool can't verify one (fake SlotHashes), so LiteSVM on a real devnet quote and queue dump, then the first devnet print after the upgrade.
- **Devnet:** at least one settled token Window per ticker on a weekday before submission (acceptance rows).

## 3. Halts, voids, earnings, corporate actions (6c)

### 3.1 Halts (`services/ops/src/actors/halt-watch/**`, new actor; no licensed halt feed exists, C:02 §B)

- **Pyth trial names:** in regular hours, a spot tick with `conf × 10⁴ > price × 50`, or `publish_time` older than 15 s → `pyth-wide` / `pyth-stale`.
- **RedStone names:** the latest package is older than 60 s in regular hours → `redstone-stale`.
- **Token lane:**
  - xStocks `GET /api/v2/public/system/status/<xStock>` `isMarketTradingHalted` every 60 s (C:13 §5) → `issuer-halt`;
  - three consecutive failed quotes → `quote-unavailable`.
- **Output:** core `HaltBoard = Record<symbol, { reason: HaltReason; sinceSec }>` (new `packages/core/src/market/halts.ts`), served as `/session.halts`.
- **Effects:**
  - The roller opens nothing for that ticker: `paused: halted (<reason>)`.
  - The maker pulls quotes (already specified, `seat/quote.ts:61`).
  - The ticket shows a `halted` blocker.
  - Nothing changes on chain: a Window already open voids by itself (prints.md §4.1 step 5, §6).
  - Only `pyth-wide` and `issuer-halt` say "Trading halted" (`session.ts:80`). The stale reasons say "Signed price stale" (Q-S6-9).

### 3.2 Void reasons (enum and copy; `packages/core/src/market/void-reason.ts`, new)

- **On chain:** `VoidReason { None, MissingPrint, CrossCheckDivergence }` (`enums.rs:37`) → core `VoidReason` (`packages/core/src/types/market.ts:31`).
- **`voidDetail(result)`** returns `{ reason, slot: "open" | "close" | null, source, boundarySec, deadlineSec }`. The slot comes from the empty `Print`s in `MarketResult` (`result.rs:15-18`).
- **Copy:** Masayume's line first, verbatim ("Void — no reliable print, both sides pay 0.5", M `packages/core/src/copy/verdict.ts:14,29`), then one reason line:
  - `missing-print`: "No signed {Pyth|RedStone|Switchboard} price at {HH:MM}:00 ET was recorded by {deadline} ET."
  - `cross-check-divergence`: "Pyth and RedStone differed by more than 0.25% at {HH:MM}:00 ET."
  - Share strings: "VOID · MISSING PRINT" / "VOID · CROSS-CHECK DIVERGENCE" (S5's wording, `proof-analytics.md:192-194`).
- **Consumers:**
  - S5d renders the verdict and share card (it owns those files, `proof-analytics.md:222`).
  - 6d renders the claim card and claim row (§5).
  - A halt is never asserted as the cause on a verdict.

### 3.3 Earnings (`services/ops/src/calendar/earnings.ts`, new; core `events-calendar.ts`, new)

- **Fetch:** Finnhub `/calendar/earnings?from&to` once per 6 h, 14 days ahead. `FINNHUB_API_KEY` is server-only and redacted (`runtime/env.ts:38`).
- **Types:** `EarningsEvent { symbol, dateEt, hour: "bmo" | "amc" | "dmh" | null }`, the same shape as S13 (`social-assistant.md:210`; Q-S13-9).
- **`earningsFlag(symbol, window, events)`:**
  - `"earnings-session"`: a Regular Window on a report date.
  - `"earnings-gap"`: a Gap whose Friday is an `amc` report or whose Monday is a `bmo` one.
- **Effects:** a ticket warning (L-32) and `/session.earnings`. Tighter caps are a flag for S10 only.

### 3.4 Corporate actions (`services/ops/config/corporate-actions.json`, today `skips: []`, 7 lines)

- **Shape:** `skips[]` gains optional `lanes: ("regular" | "gap" | "token")[]`. A new `multipliers[]` holds `{ xstock, effectiveSec, from, to, why }`, with decimals as strings.
- **`skipApplies(skip, window, lane)`** (core `corporate.ts`, new):
  - Regular: the start's ET date.
  - Gap: the Friday **or** the Monday date.
  - Token: an `effectiveSec` in `(tradingStart, expiry]`.
  - A match makes the lane `paused: corporate action (<why>)`.
- **Source:** `scripts/drive/corporate-check.ts` (new) prints proposed entries for a human to commit; it never writes. It reads:
  - the xStocks `…/assets/{symbol}/multiplier` API with `newMultiplierEffectiveTimestamp` (C:01:96-99);
  - Finnhub `/stock/split`, whose free coverage is unverified (C:02 §B).

## 4. Holdings-aware hedge (6d)

- **Reader (`packages/markets/src/holdings/**`, new server-only subpath `@agari/markets/holdings`):**
  1. Helius **mainnet** `getTokenAccountsByOwner(owner, { programId: Token-2022 })`, jsonParsed (C:01:73). The URL is built from server `HELIUS_API_KEY` and never logged.
  2. Keep verified mints only (C:01:127; C:13 §5 impostor):
     - xStocks TSLAx/NVDAx/SPYx/QQQx (`tickers.ts:57`, `price-sources.json:69-72`);
     - Ondo TSLAon/NVDAon/SPYon/QQQon (C:01:158-161; added to `tickers.ts` at foundation).
  3. Read each mint's `scaledUiAmountConfig`. The effective multiplier is `newMultiplier` once `now ≥ newMultiplierEffectiveTimestamp` (C:01:96).
  4. Integers only:
     - the multiplier decimal string → `multiplierE12: bigint`;
     - `sharesE8 = raw × multiplierE12 × 10⁸ / (10^decimals × 10¹²)`;
     - `exposureUsdE6 = sharesE8 × priceE8 / 10¹⁰`, using ops `/prices/latest` for the underlying.
- **Route `GET /api/holdings?owner=<base58>` (new):**
  - Validates the owner; caches 60 s per owner; allows 30 requests/min per IP.
  - Body: `{ owner, cluster: "mainnet-beta", asOfSec, holdings: [{ mint, symbol, issuer, underlying, rawAmount, decimals, multiplierE12, sharesE8, priceE8, exposureUsdE6 }] }`, with bigints as strings. Nothing is stored.
- **Card (`web/src/features/hedge/**`, new):** Masayume `SeasonBanner` anatomy (eyebrow, name, line, CTA; M `web/src/features/games/SeasonBanner.tsx:14-31`), under the `/markets` hero, only for a wallet with a verified holding.
  - **Eyebrow:** "YOUR MAINNET xSTOCKS · READ-ONLY".
  - **Line:** "12.5 TSLAx ≈ $4,497 of TSLA exposure this weekend" (or "this session").
  - **CTA:** "Hedge with Down" (Regular or token Window), or "Hedge the Monday Gap" while a Gap Window trades.
  - **Foot:** "Placed on Solana devnet with test tUSDC. It does not move, sell or protect your mainnet TSLAx. Not investment advice."
- **Action:** the CTA opens the S4 ticket through `onSelect(marketId, "down")` (M `MarketCard.tsx:15-22`).
  - The stake preset is `min(exposure × HEDGE_BPS 1,000 / 10⁴, ticket max, tUSDC balance)` in base units.
  - The write is the S4 order lane, unchanged (D-033).

## 5. Web states on always-on surfaces (6d unless noted)

| Surface | Masayume source | S6 states and copy |
|---|---|---|
| Marquee session cell (**S13c owns** `Marquee.tsx`, `social-assistant.md:262`) | `NEXT CLOSE` cell, M `web/src/components/shell/Marquee.tsx:57-59`. Masayume's header has no chip (M `Header.tsx:79-83`) | S13c adds `OPENS` with the session label (`social-assistant.md:129`). S6 freezes the inputs only: `useMarketSession().halted` and `sessionLabel` (`session.ts:78-90`). No header element is added (D-036) |
| Session chip `features/markets/session/MarketSessionChip.tsx:13-30` | M `.live-pill` / `.cadence-note` look | Pass `halted` into `sessionStatus` (`useMarketSession.ts:75` passes none): "Trading halted". Early close: "Closes 13:00 ET today" (`session.ts:82`). `laneState` keys become basis-aware (`useMarketSession.ts:57-58`) |
| Lane tabs `lanes/LaneTabs.tsx:20-24` | M `LaneTabs` | Key by `basis:intervalSec` as core does (`lanes.ts:29`). Labels: `5m`, `15m`, `1h`, `Gap`, `5m · 24/7` |
| Market card `lanes/MarketCard.tsx:80` | M `MarketCard.tsx:82-85` countdown, `CLOSING · NEXT ROUND SOON` (M `copy.ts:23`) | **Gap:** countdown to `lockAtSec` ("Locks Sun 20:00 ET"); question "TSLA opens Mon above $365.47?" (open 365.47600; the question uses the existing Masayume price formatter, which truncates).<br>**Gap Listed:** `.market-card-pending` (M `part-06.css:56-70`) "Monday Gap · calls open Fri 16:00 ET".<br>**Gap Locked:** "LOCKED · SETTLES MON 09:30:00 ET".<br>**Token:** asset "TSLAx" |
| Hero price-source note (`web/src/lib/copy.ts:157`) | M `copy.ts:121` via `PriceSourceNote` | **Token:** "Settles on the Switchboard TSLAx token price observed ≤ 60 s after each boundary · chart follows Jupiter".<br>**Gap:** "Settles on the oracle price at Fri 16:00:00 ET and Mon 09:30:00 ET (first regular-session print, not the opening cross)" |
| Ticket blockers (`BlockedButton` via `ticket-guards.ts`) | M `packages/core/src/copy/blockers.ts:76-85`, M `web/src/features/markets/ticket/ticket-guards.ts:33-41` | New kinds (types at foundation):<br>- `session-closed`: "Market closed — opens Mon 09:30 ET"<br>- `halted`: "Trading halted — no new calls"<br>- `lane-paused`: "Paused: no signed price source"<br>- `gap-listed`: "Calls open Fri 16:00 ET"<br>- `corporate-action`: "Paused: corporate action"<br>An earnings warning line (not a blocker): "TSLA reports after the close today — prices can gap" |
| Settling / cross-check pending | M `copy.ts:130-137` "Locked — waiting for the closing print" | Already 4d's copy (stage-04 Findings: settling covers the 2-minute check). The Gap Monday prints reuse it |
| Verdict, share card, proof rows (**S5d owns**) | M `VerdictCard.tsx:77`, `share/copy.ts:64` | Render §3.2 core copy. S6 edits none of these files |
| Claim card `verdict/ClaimWinnings.tsx:50`, `claims/ClaimRow.tsx:54` | M `ClaimWinnings.tsx:50-57` (only a loss branches, so a void shows the trophy), M `ClaimRow.tsx:53` | Void reason line; a void is not "You won" (Q-S6-7) |
| `/dev/states`, `/dev/session`, `/dev/hedge` | M `web/src/app/dev/states/page.tsx:11-21`, `HonestStatesSection.tsx:11` | Fixtures for every state:<br>- session: pre, regular, early-close, halted, post, closed, holiday;<br>- Gap: listed, trading, locked, settled;<br>- token trading;<br>- source-paused, corporate-paused, cross-check pending;<br>- each void reason;<br>- the hedge card with and without holdings.<br>`web/src/app/dev/fixture-window.ts:9-41` gains `lane`/`lockAtSec` |
| Reels (S13b), Portfolio (S5a), Games/Practice (S12) | — | Out of S6. Closed copy exists (`reels/ReelsScreen.tsx:71`); Practice's "try again in a minute" on a weekend is logged for S12 |

## 6. Lanes, ownership, frozen interfaces, proofs

| Lane | Branch · worktree · ports | Owns (disjoint) | Proves itself |
|---|---|---|---|
| **6a Gap** | `slice/S6a-gap` · `../agari-wt/s6a` · Surfpool 9061/9062 | `window-roller/plan-gap{,.test}.ts`, `price-relay/gap-slots.ts`, `market-maker/seat/gap-fair.ts`, `packages/markets/src/deploy/series-gap.ts`, `packages/db/src/print-archive-read.ts`, `scripts/deploy/init-gap-series.ts`, `scripts/drive/gap-cycle.ts`, `anchor/tests/events_gap.rs`, Pyth vectors for 1789156800 (QQQ, VOO) and 1789392600 (all three) | Spike (b) table (D-052). LiteSVM real weekend + lock race. `plan-gap` vitests at `--at` clocks: 09-18 lists 9; 09-25 TSLA v2 with QQQ/VOO paused; 11-27 early close opens 13:00; a synthetic holiday Monday. Surfpool attested drive. Series registration dry run on Surfpool |
| **6b Token** | `slice/S6b-token` · `../agari-wt/s6b` · Surfpool 9063/9064 | `anchor/crates/agari-common/{Cargo.toml, src/print/mod.rs, src/print/switchboard{,/tests}.rs}`, `anchor/programs/agari-events/{Cargo.toml, src/lib.rs, src/instructions/{mod,print_rules,record_print_switchboard}.rs}`, `anchor/Cargo.lock`, `anchor/tests/events_switchboard.rs` + vectors, `packages/clients/agari-events/**` (regenerated only), `packages/markets/src/prices/{legacy/switchboard-quote,jupiter}.ts`, `packages/markets/src/ops/prints/switchboard.ts`, `packages/markets/src/deploy/{series-token,policies-token}.ts`, `window-roller/plan-token{,.test}.ts`, `price-relay/{switchboard-pass,jupiter-attest}.ts`, `market-maker/seat/token-fair.ts`, `services/ops/src/prices/xstock-spot.ts`, `scripts/deploy/init-token-series.ts`, `scripts/drive/{switchboard-spike,token-cycle}.ts`, `price-sources.json` `tokenLane` block only | Spike (a) (D-053). §2.6 refusals. Surfpool upgraded `.so` on a live quote. Devnet weekday token settlement after the stage-owner upgrade |
| **6c Halts · voids · earnings · corporate** | `slice/S6c-halts-voids` · `../agari-wt/s6c` · Surfpool 9065/9066 | `services/ops/src/actors/halt-watch/**`, `services/ops/src/calendar/earnings.ts`, `services/ops/config/corporate-actions.json`, `packages/core/src/market/{halts,void-reason,events-calendar,corporate}{,.test}.ts`, `scripts/drive/corporate-check.ts`, `anchor/tests/events_halt_void.rs` | Vitests (`skipApplies` on Gap spans, `voidDetail`, `earningsFlag`). LiteSVM: a receiver-owned Pyth account with conf > 50 bps → ConfidenceTooWide, then `public_void_expired` at T + 901 (both orders at T + 900 / 901). `halt-watch` over a full live session with no false halt, plus an injected fixture |
| **6d States · copy · fixtures · hedge** | `slice/S6d-states-hedge` · `../agari-wt/s6d` · web 3064 | `web/src/features/markets/{lanes,hero,ticket,session}/**`, `verdict/ClaimWinnings.tsx`, `claims/ClaimRow.tsx`, `web/src/features/hedge/**`, `web/src/app/api/holdings/**`, `packages/markets/src/holdings/**`, `packages/core/src/copy/{blockers,diagnosis}.ts` (strings for the frozen kinds), the MARKETS/HERO/TICKET/CLAIM keys in `web/src/lib/copy*.ts`, `web/src/app/dev/{states,session,hedge}/**`, `web/src/app/dev/fixture-window.ts` | Browser pass at 390/768/1440 in both themes against the Masayume source for every §5 row. Node read of a real mainnet TSLAx holder (owner of the largest token account). One devnet Down hedge IOC in session (acceptance row) |

**Foundation (stage owner, before lanes; D-051):**
1. **Core types:** blocker kinds `session-closed | halted | lane-paused | gap-listed | corporate-action`; `HaltReason`; `EarningsEvent`; Ondo mints in `tickers.ts`.
2. **Basis dispatch with stubs** that report `paused: lane not built`:
   - `window-roller/execute.ts:43,47`;
   - `price-relay/tracker.ts:36` and `relay-pass.ts:142`;
   - `settler/index.ts:41`;
   - `market-maker/seat/index.ts:33`;
   - lane keys `<SYM>-gap` and `<xStock>-<min>m`.
3. **`deploy/policies.ts`:** `policyVersions(symbol, sources, basis)` with the Gap open admission; `policyFor` delegates switchboard/attested to a `policies-token.ts` stub (today it throws, `policies.ts:87`).
4. **`/session` additions:** `halts`, `earnings`, `skips` (merged with S5's `calendar.recent` / `sources`, `proof-analytics.md:226-228`). `VenueDeps` gains `halts` and `events`. `main.ts` registers `halt-watch`.
5. **Dependencies:** `@switchboard-xyz/on-demand@3.10.6` and `@switchboard-xyz/common@5.8.5` in `packages/markets` (Context7 first; a web3.js override as in D-027 if needed).
6. **`price-sources.json`:** a `gap` doc block and `tokenLane.*.feedHash` placeholders.

**Stage owner only:**
- **Manifests and exports:** every `package.json`, `pnpm-lock.yaml`, package exports.
- **Core:** `packages/core/src/{ports,types}/**`, `tickers.ts`.
- **Markets:** `packages/markets/src/{env,index}.ts`, `deploy/{policies,venue-spec}.ts`.
- **Ops:** `services/ops/src/{main.ts,runtime/**,http/**,calendar/session-service.ts}` and the dispatch lines above.
- **Web shell:** `web/src/{providers/**,lib/env.ts,app/dev/page.tsx}` and `.env*`.
- **Repo and chain:** `scripts/invariants/**`, `docs/plan/**`, `Anchor.toml`, `scripts/deploy/addresses.devnet.json`, ports; every devnet deploy, IDL publish, `admin_set_authorities`, Series registration and role funding.

**Cross-stage, never edited by S6:**
- S5d: `VerdictCard`, `print-source`, `MarketProofRows`, `features/share/**`.
- S5a: `features/markets/{portfolio,balance,history}/**`.
- S13c: `Marquee.tsx`, `/api/earnings`, `finnhub.server.ts`.
- S13b: `features/markets/reels/**`.
- The stage owners reconcile the `copy.ts` hunks and `/session` fields at merge.

**Invariants in force:** `kit-import-boundary` (Switchboard, Helius and Jupiter chain code only in `packages/markets`), `write-boundary`, `file-length` ≤ 400, `no-float-money` (multipliers and quotes as bigint fixed-point).

**Merge order:** foundation → 6c → 6a → 6b → 6d.

## 7. Open questions (recommended defaults)

| Q | Question | Recommended default |
|---|---|---|
| Q-S6-1 | List the six RedStone Gaps for 09-18 on the real-Monday archive (§1.1) instead of waiting for 09-21? | Yes, per name, if every archived open 09-14…09-17 had ≥ 3 signers at 09:30:00. Otherwise that name shows "Paused: no signed price source" until 09-25 |
| Q-S6-2 | TSLA Gap v1: keep the RedStone check (25 bps; 0.2 bps Friday / 5.2 bps Monday) or Pyth only? | Keep the check (same as Regular D-003); a divergence voids honestly |
| Q-S6-3 | Run the devnet overnight Gap drive Thu 20:00Z → Fri 13:30Z (Series 902, ≈ 0.24 SOL)? | Yes: the only real-print devnet Gap settlement before submission |
| Q-S6-4 | If Surge signs with only 2 oracles? | `switchboard_min_oracles` 2, token caps halved, "signed by 2 oracles" on receipts |
| Q-S6-5 | Append the Jupiter attested ("demo data") version on devnet? | No, unless Switchboard is paused by D-053 and the user opts in |
| Q-S6-6 | Devnet SOL for S6: Gap 2.12 + token 5.55 + float ≈ 3.5 + upgrade peak ≈ 5.5 (≈ 1 kept) | Send ≈ 15 SOL to the funding inbox before Wed 09-16 (the deployer had 3.32 at 09-14 16:50Z) |
| Q-S6-7 | A void claim shows Masayume's trophy "You won" (M `ClaimWinnings.tsx:50-57`) | Show the void stamp and "Returned" (plan §7.4.8 honest data); record as an Adapted row |
| Q-S6-8 | Hedge placement and size | Under the `/markets` hero, 10% of exposure, devnet tUSDC only |
| Q-S6-9 | Halt wording without a licensed halt feed | "Trading halted" only for `pyth-wide` / `issuer-halt`; otherwise "Signed price stale" |
