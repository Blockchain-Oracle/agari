/**
 * Canned readings for `/dev/pyth-index` (S20, D-125): the OpenAI hub's figure bar as it reads today, with the venue's
 * key refused the valuation index, and as it reads once a key that may read the index answers. Figures are shaped on
 * the 2026-09-22 catalogue read (OPENAI token $1,127.38, mark 15.1 % under it) and the 11 % token-to-index gap the
 * plan measured; none is a live read.
 */
import type { PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import type { PythIndexRow } from "@/features/ticker-hub/usePythIndex";

const TOKEN_E8 = 1_127_380_000_000n;
const MARK_E8 = 979_478_000_000n;
const INDEX_E8 = 1_015_657_000_000n;
const READ_SEC = 1_790_100_000;

const bps = (tokenE8: bigint, referenceE8: bigint) => Number(((tokenE8 - referenceE8) * 10_000n) / referenceE8);

export const OPENAI_FACTS: PreIpoFactsView = {
  tokenPriceE8: TOKEN_E8,
  markPriceE8: MARK_E8,
  premiumBps: bps(TOKEN_E8, MARK_E8),
  ageSec: 8,
  fresh: true,
  move: { windowSec: 7_180, samples: 718, rangeBps: 131, changeBps: -42 },
  holders: 1_842,
  holdersMonthAgo: 1_722,
  week: "2026-09-21",
};

export const OPENAI_INDEX: PythIndexRow = {
  indexE8: INDEX_E8,
  publishTimeSec: READ_SEC,
  ageSec: 1,
  fresh: true,
  tokenPriceE8: TOKEN_E8,
  premiumBps: bps(TOKEN_E8, INDEX_E8),
};

/** The token price as the tab's price stream would carry it. */
export const OPENAI_SPOT_E8 = TOKEN_E8;
