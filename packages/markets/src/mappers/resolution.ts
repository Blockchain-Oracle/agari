import type { Hex, Resolution } from "@masayume/core/types";
import type { SomniaMarketsClient } from "@somnia-chain/markets-sdk";
import { bigintOf, secToMsOrNull } from "./scalars";

type SdkResolution = Awaited<ReturnType<SomniaMarketsClient["getMarketResolution"]>>;

/** Claim time and oracle print time are distinct; this is the print side — `settledAtMs` is when the chain resolved. */
export function toResolution(r: SdkResolution): Resolution {
  const last = r.events.at(-1) ?? null;
  return {
    openingRaw: bigintOf(r.openingAnswer?.numericValue),
    closingRaw: bigintOf(r.closingAnswer?.numericValue),
    settlementTxHash: (last?.txHash as Hex | undefined) ?? null,
    oracleQuestionId: r.reference?.oracleQuestionId ?? r.closingAnswer?.oracleQuestionId ?? null,
    settledAtMs: secToMsOrNull(last?.timestamp),
    voided: r.events.some((e) => e.voided === true) || (r.closingAnswer?.voidReason ?? null) !== null,
  };
}
