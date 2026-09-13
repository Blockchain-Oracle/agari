import { deriveVerdict, type VerdictInput } from "@masayume/core/claims";
import { toMarketId, type Resolution, type Verdict } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import type { VerdictMarket } from "@/features/markets/verdict";
import { DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, TX_HASH } from "../states/fixtures";

const ONE = oneUnit(DECIMALS);
const MARKET_ID = toMarketId(`0x${"ff1b".padStart(64, "0")}`);
const OPENING_CENTS = 7_805_525n;
const CLOSING_CENTS = 7_812_010n;

export const FIXTURE_MARKET: VerdictMarket = {
  marketId: MARKET_ID,
  asset: "BTC",
  intervalSec: 300,
  expirySec: FIXED_NOW_SEC,
  openingPriceRaw: OPENING_CENTS,
};

export const FIXTURE_RESOLUTION: Resolution = {
  openingRaw: OPENING_CENTS,
  closingRaw: CLOSING_CENTS,
  settlementTxHash: TX_HASH,
  oracleQuestionId: "1842",
  settledAtMs: FIXED_NOW_MS + 2_000,
  voided: false,
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
