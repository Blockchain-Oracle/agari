# Print fixtures

Real, archived oracle data that the pure verifiers in `anchor/crates/agari-common/src/print/` are tested against.

| File | Source | Used by |
|---|---|---|
| `pyth-tsla-1789156800.b64` | Hermes trial update at 2026-09-11T20:00:00Z (16:00:00 ET), `data/archive/pyth/2026-09-11.jsonl`. The full accumulator update (TSLA, QQQ, VOO), base64 | `print/pyth/tests.rs` |
| `pyth-tsla-1789156800.json` | TSLA's `PriceFeedMessage` as Hermes parsed it (price, conf, expo, publish/prev times) and the `expo −8` normalization | `print/pyth/tests.rs` |

## Adding the real RedStone TSLA fixture

The RedStone tests use synthetic packages signed by five test keys. Once `data/archive/redstone/<session-date>.jsonl` holds a session boundary (from 2026-09-14 13:30Z), add the real one:

1. Pick a line whose `T` is a 5-minute boundary with 5 TSLA signers (any `T` with `exactT` packages; a 16:00:00 ET close is preferred).
2. Build the wire payload exactly as the relay will (`docs/plan/specs/prints.md` §4.2 "Relay construction"):
   - keep packages whose `dataPackageId == "TSLA"` with exactly one data point;
   - `feed_id` = `b"TSLA"` left-aligned, zero-padded to 32 B;
   - `value` = the decimal string × 10⁸ as a big-endian u256 (exact decimal arithmetic, never floats);
   - `timestamp_ms` = `timestampMilliseconds` as 6 B big-endian, `value_size` = `00000020`, `data_point_count` = `000001`;
   - `signature` = the base64-decoded 65 B (`r ‖ s ‖ v`);
   - concatenate the packages, then `package_count` (2 B BE) ‖ `000000` ‖ `000002ed57011e0000`. The length must be `142·N + 14` (724 B for N = 5).
3. Save `redstone-tsla-<T>.json` (the gateway JSON for those packages, untouched) and `redstone-tsla-<T>.hex` (the payload) here.
4. Add a test in `print/redstone/tests.rs` with the D-002 production signers (`8bb8f32d…b774`, `deb22f54…8499`, `51ce04be…d202`, `dd682dae…b5be`, `9c5ae89c…b6de`), threshold 3, `strict_sec` 300: it must verify at `T` with `now = T + 15` and 5 signers, print the median, and refuse `T ± 10 s` (`RedStoneTimestampMismatch`).
