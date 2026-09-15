# Print fixtures

Real, archived oracle data that the pure verifiers in `anchor/crates/agari-common/src/print/` are tested against.

| File | Source | Used by |
|---|---|---|
| `pyth-tsla-1789156800.b64` | Hermes trial update at 2026-09-11T20:00:00Z (16:00:00 ET), `data/archive/pyth/2026-09-11.jsonl`. The full accumulator update (TSLA, QQQ, VOO), base64 | `print/pyth/tests.rs` |
| `pyth-tsla-1789156800.json` | TSLA's `PriceFeedMessage` as Hermes parsed it (price, conf, expo, publish/prev times) and the `expo −8` normalization | `print/pyth/tests.rs` |
| `pyth-tsla-1789156800.account.b64` | The `PriceUpdateV2` account the default receiver (`rec5EK…`) stored for that update on a Surfpool devnet fork (134 B, `Full`; D-021) | `anchor/tests/src/prints.rs` (LiteSVM) |
| `redstone-tsla-1789396800.json` | The 5 TSLA gateway packages at 2026-09-14T14:40:00Z (`data/archive/redstone/2026-09-14.jsonl`), values as exact decimal strings, plus signers, values ×10⁸ and the median | `print/redstone/tests.rs` |
| `redstone-tsla-1789396800.hex` | The 724 B wire payload built from them by `@agari/markets` `redstonePayload`, the same bytes that printed on devnet (acceptance.md, 14:40Z) | `print/redstone/tests.rs` |
| `pyth-{qqq,voo}-1789156800.account.b64` | QQQ and VOO `PriceUpdateV2` accounts from the same Fri 09-11 16:00:00 ET update, posted on a Surfpool devnet fork by `scripts/fixtures/pyth-accounts.ts` (S6a) | `anchor/tests/events_gap.rs` |
| `pyth-{tsla,qqq,voo}-1789392600.account.b64` | The Mon 2026-09-14 13:30:00Z (09:30:00 ET) trial update, `data/archive/pyth/2026-09-14.jsonl`, posted the same way: TSLA 359.81147, QQQ 703.325, VOO 697.68105, all `publish_time == T`, `prev == T − 1` | `anchor/tests/events_gap.rs` |
| `redstone-tsla-1789392600.{json,hex}` | The 5 TSLA packages at Mon 09-14 09:30:00 ET (the Gap's closing boundary; median 359.62395785), built by `scripts/fixtures/redstone-tsla.ts` | `anchor/tests/events_gap.rs` (TSLA v1 check close) |

## Regenerating the RedStone fixture

`pnpm exec tsx scripts/fixtures/redstone-tsla.ts <data/archive/redstone/<date>.jsonl> <T>` rebuilds both files from any archived boundary with 5 TSLA signers (the gateway keeps ≈ 24 h). The generator uses the relay's own builder (exact decimal values, prints.md §4.2), so the test checks the bytes production will post.

The test (`the_real_archived_tsla_packages_verify_against_the_production_signers`) uses the D-002 production signers with threshold 3 and `strict_sec` 300. It checks four things:
- the payload verifies at `T` with `now = T + 15` and prints the median from 5 signers;
- `T ± 10 s` is refused with `RedStoneTimestampMismatch`;
- one flipped value byte drops the count below 5;
- every fixture signer is one of the production signers.

## Regenerating the Pyth account fixtures

`SURFPOOL_PORT=<port> pnpm exec tsx scripts/fixtures/pyth-accounts.ts <data/archive/pyth/<date>.jsonl> <T> [--force]` posts an archived Hermes update through the default receiver on a running Surfpool devnet fork (never devnet), checks each stored account (owner `rec5EK…`, 134 B, `Full`, the archived price and publish time), and writes one `pyth-<sym>-<T>.account.b64` per feed. An existing file is kept unless `--force`. Wormhole verifies the guardian signatures on the fork, so the bytes are what the relay's post would store.
