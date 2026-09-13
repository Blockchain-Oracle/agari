import type { OrderOutcome } from "@masayume/core/ports";
import type { XReceipt, XRefusalCode } from "@masayume/core/x";
import { REFUSAL_DETAILS } from "./reply-format";
import type { Diagnosis } from "@masayume/core/types";

type OutcomeReceipt = Pick<XReceipt, "status" | "reason" | "txHash" | "refusalCode" | "bookedCostBase" | "bookedContractsRaw" | "avgPriceBps">;

/** Stable categories replace provider exception text in both stored public receipts and replies. */
function refusalCode(diagnosis: Diagnosis): XRefusalCode {
  if (diagnosis.kind === "grant-refused") {
    const names: Record<string, XRefusalCode> = {
      OverStakeCap: "grant-update-required", OverDailyCap: "grant-update-required", OverPriceCap: "price-limit",
      OverPositionCap: "position-limit", Insufficient: "insufficient-funds", GrantExpired: "grant-expired",
      GrantIsRevoked: "grant-missing", NoSuchGrant: "grant-missing", NotGrantActor: "grant-mismatch",
    };
    if (diagnosis.errorName && Object.hasOwn(names, diagnosis.errorName)) return names[diagnosis.errorName]!;
  }
  const codes: Record<string, XRefusalCode> = {
    "grant-refused": "permission-denied",
    "daily-stop": "execution-paused",
    "insufficient-collateral": "insufficient-funds",
    "out-of-gas": "execution-unavailable",
    "not-deployed": "not-deployed",
    "market-not-trading": "window-entry-closed",
  };
  return Object.hasOwn(codes, diagnosis.kind) ? (codes[diagnosis.kind] ?? "unconfirmed") : "unconfirmed";
}

export function outcomeToReceipt(outcome: OrderOutcome): OutcomeReceipt {
  switch (outcome.status) {
    case "confirmed":
      return { status: "filled", reason: null, txHash: outcome.booked.txHash, bookedCostBase: outcome.booked.costBase.toString(), bookedContractsRaw: outcome.booked.contractsRaw.toString(), avgPriceBps: outcome.booked.avgPriceBps };
    case "nothingFilled":
      return { status: "nothing-filled", reason: "No position was booked.", txHash: outcome.txHash };
    case "requote":
      return { status: "refused", refusalCode: "price-moved", reason: REFUSAL_DETAILS["price-moved"], txHash: null };
    case "refused": {
      const code = refusalCode(outcome.diagnosis);
      return { status: "refused", refusalCode: code, reason: REFUSAL_DETAILS[code], txHash: outcome.diagnosis.txHash ?? null };
    }
    case "reverted":
      return { status: "reverted", reason: "The trade reverted on-chain.", txHash: outcome.txHash };
    case "unknown":
      return { status: "unknown", reason: "Transaction status needs checking before another instruction.", txHash: outcome.txHash ?? outcome.diagnosis.txHash ?? null };
  }
}
