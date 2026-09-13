import { deriveVerdict, formatBaseUnits, formatOracleRaw, isOk, oneUnit } from "@masayume/core";
import { verdictStrings } from "@masayume/core/copy";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { ORACLE_PRICE_SCALE } from "@masayume/markets/identity";
import { runSpike, short } from "./lib/boot";

const SETTLED_PAGE = 40;
const HYPOTHETICAL_CONTRACTS = 10n;
/** Bought at 50¢ — the cost basis the hypothetical UP holding carries. */
const ENTRY_PRICE_BPS = 5_000n;
const BPS = 10_000n;

const dollars = (raw: bigint | null): string => (raw === null ? "—" : `$${formatOracleRaw(raw, ORACLE_PRICE_SCALE)}`);

/** Story 1.9 smoke: the most recently finalized BTC window's resolution, and what the verdict derivation stamps for a 10-contract UP holding. */
await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no venue");
  const settled = await marketsProvider.listSettled(venue.value.venueId, SETTLED_PAGE);
  if (!isOk(settled)) throw new Error(`settled: ${settled.error.technical}`);
  const market = settled.value.find((m) => m.asset === "BTC" && m.isUpDown);
  if (!market) throw new Error("no settled BTC window in the last page");

  const [resolution, onchain, fee] = await Promise.all([
    marketsProvider.getResolution(market.marketId),
    marketsProvider.getOnchain(market.marketId),
    marketsProvider.settlementFeeBps(market.marketId),
  ]);
  if (!isOk(resolution) || !isOk(onchain) || !isOk(fee)) throw new Error("resolution/onchain/fee read failed");

  const { openingRaw, closingRaw, settlementTxHash, oracleQuestionId, settledAtMs } = resolution.value;
  const winnerByPrint = openingRaw !== null && closingRaw !== null ? (closingRaw >= openingRaw ? "UP" : "DOWN") : "—";
  console.log(`market ${short(market.marketId)} BTC ${market.intervalSec}s · status=${market.status} · onchain resolved=${onchain.value.isResolved} voided=${onchain.value.isVoided} winner=${onchain.value.winningOutcome}`);
  console.log(`opening ${dollars(openingRaw)} → closing ${dollars(closingRaw)} · winner by print ${winnerByPrint} · fee ${fee.value} bps`);
  console.log(`settlement tx ${settlementTxHash ?? "—"} · oracle question ${oracleQuestionId ?? "—"} · settled ${settledAtMs ? new Date(settledAtMs).toISOString() : "—"}`);

  const decimals = onchain.value.decimals;
  const contracts = HYPOTHETICAL_CONTRACTS * oneUnit(decimals);
  const verdict = deriveVerdict({
    marketId: market.marketId,
    settlement: onchain.value,
    holdings: { upRaw: contracts, downRaw: 0n },
    feeBps: fee.value,
    decimals,
    costBasisBase: (contracts * ENTRY_PRICE_BPS) / BPS,
    settledAtMs,
  });
  if (!verdict) throw new Error("no verdict derived for a settled window with holdings");
  const strings = verdictStrings(verdict.outcome);
  console.log(`hypothetical 10 UP @ 50¢ → ${strings.kanji} ${strings.romaji} · payout ${formatBaseUnits(verdict.payoutBase, decimals)} · net ${formatBaseUnits(verdict.pnlBase, decimals, { signed: true })}`);
  for (const leg of verdict.legs) console.log(`  leg ${leg.outcomeIdx === 0 ? "UP" : "DOWN"} × ${formatBaseUnits(leg.amountRaw, decimals)} → ${formatBaseUnits(leg.payoutBase, decimals)}`);
});
