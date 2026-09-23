# Connected-session inconsistencies · 23 September 2026

Observed at `useagari.xyz` in a connected browser session. The application source was reviewed at `integration/w1` commit `86a37ee`; the deployed commit was not independently identified. No new signature, trade, claim, deposit, withdrawal or grant was submitted. Public captures mask the account label. These are handoff notes for the application agents; no application code was changed here.

## Confirmed copy mismatch: practice desk promises an on-chain seal

On an existing **practice** desk, the Rules page's “The promise” says the record fingerprint is on Solana in the same transaction as the trade. Practice is a paper flow with no on-chain trade or seal. The source string is `web/src/features/desk/copy.ts` (`promise.points`); the architecture and desk guide correctly describe the difference. Reproduce from a connected owner's `/desk` → Rules → scroll to The promise. The final chapter of `public/videos/connected-practice-desk-2026-09-23.mp4` records the screen. Scope that promise to live desks, or give practice its own wording.

## Confirmed copy mismatch: proof intro overstates PreStocks evidence

An AI Labs `/proof` detail shows a PreStocks print signed by Agari's attestor and says **“no archived bytes for this boundary.”** The generic proof intro says every Window has the source's own signature and archived signed bytes. A PreStocks catalogue read is unsigned, and this observed boundary has no archive row. The generic copy is in `web/src/features/proof/copy.ts` (`PROOF.intro` and `PROOF.footer`); `PrintProofReceipt.tsx` already handles a missing archive and labels attested PreStocks prints correctly. Reproduce from `/proof` → AI Labs settled Window. See `public/captures/basket-proof-connected-2026-09-23.jpg`. Use source-specific copy and distinguish the on-chain record transaction from optional archived bytes.

## Likely copy bug: unavailable ticket controls say the reserves are undeployed

The connected OPENAI 24/7 ticket presents disabled Range and 2×/3× controls with help text saying the relevant reserve “is not deployed yet.” The devnet Range and leverage reserves are deployed, and a different 24/7 ticket exposed those controls during this session. `web/src/lib/copy-ticket.ts` (`TICKET_PENDING`) supplies deployment-era text when the selected ticket's `rangeAvailable` or leverage availability is false; see `web/src/features/markets/ticket/BetModes.tsx` and `LeverageChips.tsx`. Reproduce on the OPENAI 24/7 ticket and compare with AI Labs. The unavailable reason appears to be market or Window eligibility, not global deployment status. Confirm the exact gate before replacing the tooltip.

## Needs reconciliation: copy permission open count versus Portfolio

The connected Portfolio showed **0 open** positions while one strategy drawer said **Copying enabled**, **Awaiting settlement**, “Your 1-position limit is reached,” and “1 position remains open.” `web/src/features/strategies/activity.ts` derives the count from the matching vault grant's `openPositions`; the Portfolio derives its view from position and claimable reads. These may have different scope or update timing, so this is an observed discrepancy, not a proven ledger bug. Reproduce by comparing `/portfolio` Open with `/strategies` → existing strategy drawer for the same wallet. See `public/captures/portfolio-connected-2026-09-23.jpg` and `public/captures/strategy-copy-connected-2026-09-23.jpg`. Check whether the grant counter should be released on settlement, whether Portfolio omits vault-funded positions, or whether one read is stale.

## Documentation error corrected here

The old Portfolio and first-trade guides said settlement never pays automatically. The current settler uses a five-minute default owner-claim grace period before `redeem_for` pays remaining seats, and the connected History showed a win labeled **Paid automatically**. This docs change corrects both guides. Source: `services/ops/src/actors/settler/index.ts`, `web/src/features/markets/history/copy.ts` and `web/src/features/activity/copy.ts`.
