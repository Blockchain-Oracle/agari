# Venue identity audit — 2026-09-19

Trigger: the user saw BTC on `/games/lucky` and could not tell what currency bets are in. "How many more are out there?"
Method: (1) case-insensitive grep for reference assets, brand, chain and EVM vocabulary over non-comment, non-test lines of
`web/src`, `packages/*/src`, `services/ops/src`; (2) a headless-Chrome pass over all 38 public routes and 26 `/dev` fixture
pages on `:3000`, dumping `innerText`, `title`/`aria-label` attributes and SVG text; (3) a runtime walk of text nodes that
contain "tUSDC" reading the computed `text-transform`. Decisions: D-106 (money), D-107 (identity + guard).

## Functional defects (the feature could not work on a stock venue)

| Where | What | Fix |
| --- | --- | --- |
| `packages/core/src/games/lucky.ts` | `LUCKY_ASSETS = ["BTC","ETH"]`: the reels cycled BTC/ETH and every spin ended "no deal" | policy v2 over the nine launch tickers + OPENAI; browser check pins the list; closed-market line before the spin |
| `web/src/features/parlay/ParlayBuilder.tsx`, `copy.ts` | "BTC close streak" filtered for BTC Windows: always disabled or refused | streak on the stock with the most Windows live; the button names it |
| `services/ops/src/actors/x-relay/reply-format.ts` | the public reply named the asset only when it was BTC or ETH | any asset the registry knows (`assetTicker`) |
| `web/src/features/x/XPermissionPanel.tsx` | "View update transaction" linked to `shannon-explorer.somnia.network` | core `txUrl` on the configured cluster |

## Wrong words a reader sees

| Where | What | Fix |
| --- | --- | --- |
| `web/src/features/x/CustodyRail.tsx` | diagram: `@agari_app btc up 5 15m`, "BTC · yours" | `tsla up 5 15m`, "TSLA · yours" |
| `web/src/features/games/duel/copy.ts` ×3 | "A duel on Masayume" (page title, result eyebrow, share text) | "A duel on Agari" |
| `duel/copy.ts` ×7, `lucky/copy.ts` ×3, `pitch/copy.ts`, x-relay reverted footer ×2 | "gas" | "network fee" / "SOL for fees" |
| `strategies/copy.ts`, `x/copy.ts`, `funding/copy.ts` | "testnet" (a different Solana cluster) | "devnet" |
| `packages/core/src/strategies/{agent,spec}.ts` | `asset = "BTC"` default; the web passed "all live venue assets", producing "If all live venue assets moved…" | default and web phrase "each/every listed stock"; sentence rebuilt around it |
| Lucky reel label and intro | "Asset" | "Stock" |

## Second pass (same evening): what a word search cannot see

| Where | What | Fix |
| --- | --- | --- |
| `web/src/features/markets/hero/units.ts`, `sensei/units.ts` | the reference's "whole dollars from $1,000 up" rule, written for BTC and ETH, caught OPENAI (~$1,130): the Reel asked "above $1,132?" for a line of $1,132.74, the markets spot read "$1,148", Sensei was told $1,133 | threshold $10,000, one constant for both; every listed price keeps its cents |
| `range/RangeTicket.tsx`, `range/WindowPicker.tsx`, `games/moonshot/MoonshotTicket.tsx` | the opening print always in whole dollars ("$364" for $364.30) | `usdBand`: cents below $10,000 |
| `web/src/features/sensei/prompt.ts` | "Windows list only in the NYSE session", untrue since the 24/7 lanes | names the lanes that never close |

Also checked in this pass and clean: CSS `content:` strings and selectors (only comments and the `.wq-btc` class), non-code
assets under `web/src`, `packages/brain`, `packages/clients`, `scripts/` (`probe-keys.mjs` probes Pyth's BTC feed on purpose:
it answers outside market hours), the Sensei and agent prompts, and the Range presets, which scale with price (TSLA 15m:
±$0.12 / $0.24 / $0.44 on a $0.02 grid; OPENAI 60m: ±$0.90 / $1.80 / $3.20 on a $0.10 grid). The unused `.mc-btbtc`
("Bet with Bitcoin") rule in the ported stylesheet has no component and is left with the reference's file (D-081).

## Money (D-106)

"tUSDC" rendered as "TUSDC" under uppercasing labels in: the ticket's bet amount, Lucky's stake, the parlay and range
place buttons ("PLACE · 28.22 TUSDC", "INSUFFICIENT TUSDC"), the balance plate ("SPENDABLE · TUSDC"), the earn withdraw
button, the strategies desk ("NET SO FAR · TUSDC", card meta, the copy drawer's two field labels). All fixed; the rerun
of the text-node walk over 21 pages on the patched build found none. The explanations first added beside this fix (a
modal section, two tooltips, an FAQ entry, a docs section) were removed on the user's call: the currency is not a topic.

## Internal names (no reader sees them; renamed for hygiene)

`window.__masayumePerf` → `__agariPerf`; font-family "Masayume Pixel" → "Agari Pixel"; ops deck journal default
`.masayume/` → `.agari/` (already gitignored; no journal existed); unused `BitcoinMark`/`EthereumMark` and their fills deleted.

## Checked and left alone

- `packages/core/src/x/parse.ts` `UNLISTED_ASSET_RE`: names crypto tickers in order to refuse them in words. Allowlisted.
- `web/src/features/pitch/copy.ts`: credits Masayume as the source of the port. Allowlisted.
- `.wq-btc` in `WordCard.tsx`: a ported CSS class name. Allowlisted.
- The USDC disc beside "tUSDC" in the header pill: the owner asked for the token's logo (2026-09-04); the pill's tooltip now says what tUSDC is.
- "round(s)" for a settled bet, "Moonshot", "Candle Hop": ordinary market words, not crypto's.
- `/api/sentiment`: already crowd flow from Agari's own fills, not a crypto Fear & Greed index.
- `web/public`: Agari's own captures and icons.
- Comments that say what the reference did, and test fixtures outside the touched suites.

## Not reachable without a wallet

The Lucky reels in motion, the deal card and the header pill need a connected wallet, which the headless pass does not have.
The reel pool is `LUCKY_ASSETS` by construction and the draw is pinned by the golden-vector tests; the user's next Phantom
session should spin once on `/games/lucky` during regular hours.
