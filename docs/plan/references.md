# References

Everything lives in `reference/` (gitignored). Clones are shallow unless noted. **Allowed use:** *code* means it may be adapted with attribution in `THIRD_PARTY_NOTICES.md`; *ideas* means read only, no copied code.

Licences were read from each repo's licence file on 2026-09-13. "None" means no licence file, so treat it as all rights reserved: ideas only.

## Design authority and lineage

| Entry | Source | Pin | Licence | Allowed use |
|---|---|---|---|---|
| `masayume` | symlink → `/Users/abu/dev/hackathon/sommina-events` | `68f7a09` | Abu's own project | **Design authority**; source-led fork (D-001) |
| `yosuku` | symlink → `sommina-events/reference/yosuku` | `3c56ef5` | Per Masayume `THIRD_PARTY_NOTICES.md` (Q-007) | Lineage only |
| `yosuku-blockchain-oracle` | github.com/Blockchain-Oracle/yosuku | `9f0af31` | None | Lineage only (ideas) |
| `dreamdex-markets-sdk` | symlink → `sommina-events/reference/markets-sdk` | Masayume snapshot | Per package | Ideas (engine semantics, `C:06`) |
| `dreamdex-bot-kit` | symlink → `sommina-events/reference/dreamdex-bot-kit` | Masayume snapshot | Per package | Ideas (`ec-maker`, `ec-oracle-follow`) |
| `dreamdex-docs` | symlink → `sommina-events/reference/dreamdex-docs` | Masayume snapshot | Docs | Ideas |

## Order book and matching

| Entry | Source | Pin | Licence | Allowed use |
|---|---|---|---|---|
| `phoenix-v1` | github.com/Ellipsis-Labs/phoenix-v1 | `5a34f7f901fd9e04057198d4fc7b7286f78b53f2` (2026-05-11) | MIT | Code: matching loop, order packets, self-trade behaviour, `match_limit` |
| `sokoban` | github.com/Ellipsis-Labs/sokoban | `f8ecce2c50c12e6b8731b59ecdb3a1f43769a094` (2024-08-23) | MIT | Code: slab node allocator |
| `ctf-exchange` | github.com/Polymarket/ctf-exchange | `ed5c7708b7be3aa98bf5f0c6602b57cc498e2ef4` (2026-05-11) | MIT | Code/ideas: `MatchType {COMPLEMENTARY, MINT, MERGE}` |
| `betdex-protocol` | github.com/BetDexLabs/protocol | `a98aaf9f545709b65f6060b949572d65edc2f761` (2024-12-17) | Apache-2.0 | Code: price ladder, cross-matching (keep NOTICE) |
| `manifest` | github.com/Bonasa-Tech/manifest | `ebf92a05b39160379dd10b1e18065423716409a0` (2026-09-12) | **GPL-3.0** | **Ideas only**: Certora property list as invariant checklist |

## Solana, oracles and tooling

| Entry | Source | Pin | Licence | Allowed use |
|---|---|---|---|---|
| `anchor` | github.com/solana-foundation/anchor | `905a5f3` | Apache-2.0 | Code (tests, zero-copy, `event_cpi` patterns) |
| `solana-templates` | github.com/solana-foundation/templates | `fbafa61` | MIT | Code (kit + Next + Anchor + Codama scaffold) |
| `program-examples` | github.com/solana-developers/program-examples | `eb8c87d` | MIT | Code (Pyth Anchor example) |
| `pyth-examples` | github.com/pyth-network/pyth-examples | `c8a6d36` | Apache-2.0 | Code |
| `redstone-rust-sdk` | github.com/redstone-finance/rust-sdk | `05e3c9fe4cec1651b5418c83c02f9a5db4cc4cfa` (2026-08-31) | BSL-1.0 (Boost) | Code: package verification (keep notice). D-002 pins the git rev |
| `switchboard-examples` | github.com/switchboard-xyz/sb-on-demand-examples | `7a116a3` | None | Ideas only (use the published crate instead) |
| `kora` | github.com/solana-foundation/kora | `f0377c0` | MIT | Ideas/code (fee-payer co-sign policy) |
| `solana-actions` | github.com/solana-developers/solana-actions | `75cf372` | Apache-2.0 | Code (Blinks) |
| `magicblock-engine-examples` | github.com/magicblock-labs/magicblock-engine-examples | `e137826` | MIT | Ideas |
| `solora-anchor` | github.com/meditatingsloth/solora-anchor | `c03fcc9` | MIT | Ideas |
| `stocklana-baskets` | github.com/MallorcaBCDays/stocklana-baskets | `b0cd5cb` | None | Ideas only |
