# Print fixtures

Real, archived oracle data that the pure verifiers in `anchor/crates/agari-common/src/print/` are tested against.

| File | Source | Used by |
|---|---|---|
| `pyth-tsla-1789156800.b64` | Hermes trial update at 2026-09-11T20:00:00Z (16:00:00 ET), `data/archive/pyth/2026-09-11.jsonl`. The full accumulator update (TSLA, QQQ, VOO), base64 | `print/pyth/tests.rs` |
| `pyth-tsla-1789156800.json` | TSLA's `PriceFeedMessage` as Hermes parsed it (price, conf, expo, publish/prev times) and the `expo −8` normalization | `print/pyth/tests.rs` |
| `pyth-tsla-1789156800.account.b64` | The `PriceUpdateV2` account the default receiver (`rec5EK…`) stored for that update on a Surfpool devnet fork (134 B, `Full`; D-021) | `anchor/tests/src/prints.rs` (LiteSVM) |
| `redstone-tsla-1789396800.json` | The 5 TSLA gateway packages at 2026-09-14T14:40:00Z (`data/archive/redstone/2026-09-14.jsonl`), values as exact decimal strings, plus signers, values ×10⁸ and the median | `print/redstone/tests.rs` |
| `redstone-tsla-1789396800.hex` | The 724 B wire payload built from them by `@agari/markets` `redstonePayload`, the same bytes that printed on devnet (acceptance.md, 14:40Z) | `print/redstone/tests.rs` |
| `switchboard-498638533.hex` | A real devnet Surge quote (S6 spike (a), 2026-09-15 ~06:39Z): the 687 B ed25519 instruction data `fetchSurgeQuote` returned for TSLAX/NVDAX/SPYX/QQQX with 4 oracles (0, 1, 4, 6) at slot 498,638,533; TSLAx 358.99 | `print/switchboard/tests.rs`, `anchor/tests/events_switchboard.rs` (LiteSVM, real precompile) |
| `switchboard-queue-EYiAm-498638714.b64` | The devnet queue account `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` (6,280 B, owner `Aio4gaXj…`) at slot 498,638,714, whose ed25519 signing keys the quote verifies against | same |

## Regenerating the RedStone fixture

`pnpm exec tsx scripts/fixtures/redstone-tsla.ts <data/archive/redstone/<date>.jsonl> <T>` rebuilds both files from any archived boundary with 5 TSLA signers (the gateway keeps ≈ 24 h). The generator uses the relay's own builder (exact decimal values, prints.md §4.2), so the test checks the bytes production will post.

The test (`the_real_archived_tsla_packages_verify_against_the_production_signers`) uses the D-002 production signers with threshold 3 and `strict_sec` 300. It checks four things:
- the payload verifies at `T` with `now = T + 15` and prints the median from 5 signers;
- `T ± 10 s` is refused with `RedStoneTimestampMismatch`;
- one flipped value byte drops the count below 5;
- every fixture signer is one of the production signers.

## Regenerating the Switchboard fixture

`pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/switchboard-spike.ts --rounds 3 --save anchor/tests/vectors/prints/switchboard-<slot>.hex` keeps the quote with the most distinct oracles; dump the queue in the same minute (`getAccountInfo` base64), since oracle signing keys rotate within 7 days. The LiteSVM tests set SlotHashes around the quote's slot, so an old fixture keeps verifying as long as its signers match the dumped queue.
