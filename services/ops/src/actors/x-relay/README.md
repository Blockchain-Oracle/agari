# X receipt delivery

Each new mention is claimed once in Postgres before execution. A completed receipt can produce one short reply with a branded 1200 × 600 PNG and a clickable transaction link. The image uses the same validated receipt facts as the text. Rendering uses the bundled licensed fonts and exact Masayume mark; it needs no image-generation service.

## Receipt facts

`stakeBase` is the requested budget. `bookedCostBase`, `bookedContractsRaw` and `avgPriceBps` come from the booked order. Resolved market fields retain the asset, Window interval and exact UTC end time. These optional fields live in the additive `x_receipts.details` JSONB column. Older rows remain readable; missing historical fill amounts are not reconstructed from the requested budget.

The public formatter uses fixed status and refusal copy, validated amounts and a complete explorer URL. It never publishes raw provider diagnostics, private keys or grant data. It preserves small amounts such as `0.000001 tUSDC`. ASCII text and the known complete URLs stay within 280 raw characters, which also bounds X's weighted length for this restricted output.

| Receipt | Reply heading | Meaning |
| --- | --- | --- |
| `filled` with a valid hash | Order filled | A booked fill was confirmed. `Spent` uses actual booked cost when retained. The market result comes later. |
| `nothing-filled` with a valid hash | No fill | The confirmed transaction booked no position. |
| `reverted` with a valid hash | Order reverted | The transaction reverted; gas may still have been spent. |
| `unknown`, or a chain-result row without a valid hash | Status needs checking | Check the linked transaction or the app before another instruction. This can include receipt or bookkeeping failures. |
| `refused` | Order not confirmed | One safe next step from a fixed refusal category. |
| `submitted` | Instruction received | Initial claim only; it is not eligible for automatic reply delivery. |

A lower filled cost does not prove a partial fill: a better price can also cost less. There is no partial-fill, winning-prediction, payout or automatic settlement-follow-up claim in this release.

## X balance and permission updates

The X allocation is the monetary spending boundary. New X permissions use the deployed vault's `uint128` ceiling for both monetary cap fields, so an initial deposit or later top-up does not introduce a separate per-trade or daily allowance. The permission still expires after 30 days, permits up to eight open positions per grant, and cannot spend the owner's unallocated Trading Balance. There are no optional monetary-limit controls in the X setup.

Legacy grants need the owner's explicit wallet update. Portfolio and `/trade-from-x#x-trading` share this action: revoke the old grant, verify its `GrantRevoked.returned` amount, then allocate exactly that amount to the new permission. This uses no additional deposit, preserves existing positions, and does not silently take other Trading Balance funds if an order spends money during confirmation. Browser progress is saved before each transaction; uncertain sends are checked by receipt before continuing. If the second confirmation is cancelled, users can continue or keep the returned funds in Trading Balance.

Release the web recovery controls before updating the relay. The relay refuses old monetary-cap policies with `grant-update-required` and a direct recovery link; it does not modify grants or replay historical refused mentions. New specific refusal categories live in the existing JSONB receipt details and require no database schema or contract deployment. Historical generic permission failures remain generic; the UI must not invent their exact cause.

## Window timing and instruction recovery

All entry surfaces share a 30-second buffer before the Window ends. The relay still requires the requested asset and duration, a ready opening price, an enterable market, a fresh quote and the order lane's current on-chain checks. It never substitutes another timeframe or queues a refused instruction for a later Window.

The parser accepts casing, token order, UP/LONG and DOWN/SHORT, written durations such as `5 minutes`, and `1d`/`24h`. Missing or ambiguous inputs produce the specific safe correction in both reply text and image. Market-read failure is retried once as a read and then reported separately from closed entries, a future Window, a pending opening price or no matching market. Known cutoff/start times are retained in receipt details. `/trade-from-x#x-instruction` builds a copyable instruction from the same live selection rule and shows its cutoff; X delivery latency means eligibility is checked again on arrival.

## Execution and posting are separate

The mention claim and optional reply queue entry are inserted in one database transaction. An existing mention is never executed again. Posting runs in its own loop every 15 seconds, with its own busy gate and error boundary, independently of the financial poll.

```mermaid
flowchart LR
  A[New mention] --> B[Atomic instruction claim]
  B --> C[Execute once]
  C --> D[Store final receipt]
  D --> E[Lease reply preparation]
  E --> F[Render and upload image]
  F --> G[Persist exact reply payload]
  G --> H[One X POST attempt]
  H --> I[Store reply ID]
```

The renderer, upload and POST each have a 45-second outer deadline. Image failure falls back to the same truthful text before posting. A POST timeout cannot cancel the underlying remote request: it becomes `unknown`, even if X accepts it later. It never triggers a second POST or trade. The writer's internal retry count is zero.

| Delivery state | Recovery behavior |
| --- | --- |
| `pending` | Eligible once its receipt is complete. |
| `preparing` | A worker owns a lease. After five minutes another worker can prepare it; the old lease cannot pass the POST gate. |
| `posting` | Exact text and optional media ID were stored before calling X. Never automatically acquired again. After five minutes an interrupted entry becomes `unknown`. |
| `sent` | A numeric X reply ID was acknowledged and stored. |
| `unknown` | Posting may have succeeded. An operator must inspect the original mention and the stored payload. No automatic repost. |
| `failed` | Preparation could not finish before posting. Held for inspection. |

An error saving the X acknowledgement is also ambiguous. Do not reset `unknown` or `posting` rows to `pending` without checking the public reply first. Existing historic receipts are not backfilled into the queue, and enabling posting does not replay mentions previously processed while posting was off.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required durable claim, receipt and delivery storage. |
| `X_RETTIWT_API_KEY` | Existing account-session credential. Server-only. |
| `X_HANDLE` | Account whose mentions are polled. |
| `X_EXECUTOR_PRIVATE_KEY` | Isolated signer named by the user's existing EXECUTOR grant. Server-only. |
| `X_POSTING_ENABLED` | `1` or `true` permits receipt replies. Any other value disables all reply publication. It does not disable instruction execution. |
| `X_REPLY_IMAGES_ENABLED` | `0` or `false` disables images. Otherwise images are enabled when posting is enabled. |
| `X_POLL_MS` | Financial mention poll interval; default 20,000 ms, minimum 5,000 ms. |

Run one ops machine only, as required by `services/ops/fly.toml`. No signer, permission, spending cap or transaction retry policy is changed by the image switch. The first-ever poll still establishes the cursor without executing earlier mentions.

## Known limits

The existing transport is Rettiwt 7.1.3 using the account session. This is not a migration to the official X API. X's published [automation rules](https://help.x.com/en/rules-and-policies/x-automation) prohibit non-API website scripting; the transport remains a platform-policy gap. A supported transport replacement needs separate credentials and validation. The current Rettiwt media method also has no alt-text parameter. All essential facts therefore remain in the adjacent plain-text reply; the SVG's description is not claimed to become PNG alt metadata on X.

The worker's intent journal is still process-local. Known broadcast hashes survive receipt and local bookkeeping failures while execution can return a final receipt. A process crash between the durable mention claim and final receipt persistence can leave `submitted` with no stored wallet or hash. It will not execute again or receive an automatic reply. This release does **not** implement durable mention-to-intent reconciliation. Inspect the account's transaction history and claim before considering another instruction.

## Verification

Focused tests cover real booked amounts, all result states, malformed historical data, text bounds, parser inherited-property keys, deterministic image output, broadcast hash retention, storage errors, expired leases, text fallback, lost acknowledgements and hung network operations. These use fixtures and mocked signing/transport; they send no transaction or public post.

The disposable Postgres integration check is `pnpm exec tsx packages/db/scripts/test-x-reply-delivery-postgres.ts` (Docker required). It creates its own loopback-only database and removes its container afterward. See the [release evidence](../../../../../docs/marketing/receipt-release-2026-09-05.md) for the checks and deployment state recorded for this change.
