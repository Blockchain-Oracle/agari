import type { BlockerKind } from "@masayume/core/copy";
import type { WalletSession } from "@/lib/wallet-session";
import type { ClaimRun } from "./types";

export interface ClaimBlockerInput {
  session: WalletSession;
  hasSigner: boolean;
  run: ClaimRun;
}

/** Ordered so the first fixable reason is the one the CTA names. */
export function deriveClaimBlocker({ session, hasSigner, run }: ClaimBlockerInput): BlockerKind | null {
  if (!session.isConnected) return session.isConnecting ? "connecting" : "disconnected";
  if (!session.isRightChain) return "wrong-chain";
  if (!hasSigner) return "connecting";
  if (run.status === "running") return "placing";
  if (run.gasShort) return "out-of-gas";
  return null;
}
