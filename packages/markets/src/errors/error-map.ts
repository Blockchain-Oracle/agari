import { diagnosis, type Diagnosis, type DiagnosisKind } from "@masayume/core/types";
import {
  ContractRevertError,
  IndexerError,
  InvalidInputError,
  NotConfiguredError,
  RpcError,
  SignerRequiredError,
} from "@somnia-chain/markets-sdk";
import { ReadingError } from "./reading-error";

const USER_REJECTED_CODE = 4001;

/** Revert names observed on the venue, mapped to the one diagnosis vocabulary (AD-13). */
const REVERT_KINDS: Record<string, DiagnosisKind> = {
  InsufficientBalance: "insufficient-collateral",
  ERC20InsufficientBalance: "insufficient-collateral",
  ERC20InsufficientAllowance: "insufficient-allowance",
  PostOnlyWouldCross: "post-only-would-cross",
  OrderAlreadyExpired: "order-expired",
  OrderExpiryBeyondMarket: "order-expired",
  InvalidPrice: "invalid-price",
  InvalidQuantity: "below-min-quantity",
  QuantityBelowMinimum: "below-min-quantity",
  MarketNotTrading: "market-not-trading",
  MarketNotSettled: "not-settled",
  NothingToRedeem: "already-claimed",
  FaucetCapExceeded: "faucet-refused",
};

const MESSAGE_KINDS: ReadonlyArray<readonly [RegExp, DiagnosisKind]> = [
  [/user (rejected|denied|cancel)/i, "user-rejected"],
  [/chain mismatch|wrong (chain|network)|does not match the target chain/i, "wrong-chain"],
  // Somnia surfaces an unfunded gas envelope as a malformed request, not as "insufficient funds".
  [/insufficient funds|missing or invalid parameters/i, "out-of-gas"],
];

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error);
}

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && chain.length < 8) {
    chain.push(current);
    current = typeof current === "object" && current !== null && "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return chain;
}

function isUserRejection(error: unknown): boolean {
  return causeChain(error).some(
    (e) => typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === USER_REJECTED_CODE,
  );
}

function kindFromMessage(message: string): DiagnosisKind | null {
  for (const [pattern, kind] of MESSAGE_KINDS) if (pattern.test(message)) return kind;
  for (const [name, kind] of Object.entries(REVERT_KINDS)) if (message.includes(name)) return kind;
  return null;
}

/** Translates any provider/SDK failure into a typed diagnosis; the raw message survives as `technical`. */
export function diagnose(error: unknown): Diagnosis {
  if (error instanceof ReadingError) return error.diagnosis;
  const technical = messageOf(error);
  if (error instanceof SignerRequiredError) return diagnosis("signer-required", technical);
  if (isUserRejection(error)) return diagnosis("user-rejected", technical);
  if (error instanceof ContractRevertError) {
    const named = error.errorName ? REVERT_KINDS[error.errorName] : undefined;
    const kind = named ?? kindFromMessage(technical) ?? "contract-revert";
    return diagnosis(kind, technical, { errorName: error.errorName });
  }
  const fromMessage = kindFromMessage(technical);
  if (fromMessage) return diagnosis(fromMessage, technical);
  if (error instanceof IndexerError) return diagnosis("indexer-down", technical);
  if (error instanceof RpcError) return diagnosis("rpc-down", technical);
  if (error instanceof NotConfiguredError || error instanceof InvalidInputError) return diagnosis("unknown", technical);
  return diagnosis("unknown", technical);
}
