import { diagnosis, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import { ReadingError } from "./reading-error";

/** Wallet Standard wallets (Phantom, Solflare, Backpack) use 4001 for a user's refusal, as EIP-1193 did. */
const USER_REJECTED_CODE = 4001;

/** Chain-agnostic message patterns. Anchor program error codes map here once the Solana adapter exists (S4). */
const MESSAGE_KINDS: ReadonlyArray<readonly [RegExp, DiagnosisKind]> = [
  [/user (rejected|denied|cancel)|rejected the request/i, "user-rejected"],
  [/insufficient (funds|lamports)|attempt to debit an account but found no record of a prior credit/i, "out-of-gas"],
  [/blockhash not found|block height exceeded|transaction expired/i, "send-unknown"],
  [/fetch failed|network ?error|ECONNREFUSED|ETIMEDOUT|429/i, "rpc-down"],
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
  return causeChain(error).some((e) => typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === USER_REJECTED_CODE);
}

/** Translates any failure into a typed diagnosis; the raw message survives as `technical`. */
export function diagnose(error: unknown): Diagnosis {
  if (error instanceof ReadingError) return error.diagnosis;
  const technical = messageOf(error);
  if (isUserRejection(error)) return diagnosis("user-rejected", technical);
  for (const [pattern, kind] of MESSAGE_KINDS) if (pattern.test(technical)) return diagnosis(kind, technical);
  return diagnosis("unknown", technical);
}
