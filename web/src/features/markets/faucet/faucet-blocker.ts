import type { BlockerKind } from "@masayume/core/copy";
import type { WritePhase } from "@masayume/core/ports";
import type { WalletSession } from "@/lib/wallet-session";

export interface FaucetBlockerInput {
  session: WalletSession;
  hasSigner: boolean;
  phase: WritePhase;
  gasShort: boolean;
}

/** Ordered so the first fixable reason is the one the CTA names. */
export function deriveFaucetBlocker({ session, hasSigner, phase, gasShort }: FaucetBlockerInput): BlockerKind | null {
  if (!session.isConnected) return session.isConnecting ? "connecting" : "disconnected";
  if (!session.isRightChain) return "wrong-chain";
  // The signer binds one effect after the session settles; treat the gap as still connecting.
  if (!hasSigner) return "connecting";
  if (phase === "submitted") return "placing";
  if (gasShort) return "out-of-gas";
  return null;
}
