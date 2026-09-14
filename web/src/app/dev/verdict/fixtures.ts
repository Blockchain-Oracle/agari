import { deriveVerdict, type VerdictInput } from "@agari/core/claims";
import type { Resolution, Verdict } from "@agari/core/types";
import { oneUnit } from "@agari/core/units";
import type { VerdictMarket } from "@/features/markets/verdict";
import { DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, TX_HASH } from "../states/fixtures";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

const ONE = oneUnit(DECIMALS);
const MARKET_ID = fixtureMarketId("0xff1b");
/** Prints on the engine's 10⁻⁸ scale (PRINT_EXPO), e.g. TSLA 365.48. */
const OPENING_CENTS = 36_548_270_000n;
const CLOSING_CENTS = 36_561_050_000n;

export const FIXTURE_MARKET: VerdictMarket = {
  marketId: MARKET_ID,
  asset: "TSLA",
  intervalSec: 300,
  expirySec: FIXED_NOW_SEC,
  openingPriceRaw: OPENING_CENTS,
};

export const FIXTURE_RESOLUTION: Resolution = {
  openingRaw: OPENING_CENTS,
  closingRaw: CLOSING_CENTS,
  settlementTxHash: TX_HASH,
  printSource: "redstone",
  singleSource: false,
  settledAtMs: FIXED_NOW_MS + 2_000,
  voided: false,
  voidReason: null,
};

const upWins: VerdictInput["settlement"] = { isResolved: true, isVoided: false, winningOutcome: 0 };
const voided: VerdictInput["settlement"] = { isResolved: false, isVoided: true, winningOutcome: null };

function fixture(input: Omit<VerdictInput, "marketId" | "decimals" | "settledAtMs" | "feeBps"> & { feeBps?: number }): Verdict {
  const verdict = deriveVerdict({ marketId: MARKET_ID, decimals: DECIMALS, settledAtMs: FIXTURE_RESOLUTION.settledAtMs, feeBps: 0, ...input });
  if (!verdict) throw new Error("fixture inputs must derive a verdict");
  return verdict;
}

export const VERDICT_FIXTURES = {
  win: fixture({ settlement: upWins, holdings: { upRaw: 10n * ONE, downRaw: 0n }, costBasisBase: 5n * ONE }),
  loss: fixture({ settlement: upWins, holdings: { upRaw: 0n, downRaw: 10n * ONE }, costBasisBase: 45n * ONE / 10n }),
  void: fixture({ settlement: voided, holdings: { upRaw: 10n * ONE, downRaw: 2n * ONE }, costBasisBase: 6n * ONE }),
  both: fixture({ settlement: upWins, holdings: { upRaw: 4n * ONE, downRaw: 10n * ONE }, costBasisBase: 7n * ONE }),
} as const;

export const VOID_RESOLUTION: Resolution = { ...FIXTURE_RESOLUTION, closingRaw: null, voided: true };
