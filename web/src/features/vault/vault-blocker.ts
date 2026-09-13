import type { BlockerKind } from "@masayume/core/copy";
import type { WalletSession } from "@/lib/wallet-session";

export interface VaultBlockerInput {
  session: WalletSession;
  hasSigner: boolean;
  busy: boolean;
  gasShort: boolean;
}

/** Ordered so the first fixable reason is the one the control names — the claim plate's ladder. */
export function deriveVaultBlocker({ session, hasSigner, busy, gasShort }: VaultBlockerInput): BlockerKind | null {
  if (!session.isConnected) return session.isConnecting ? "connecting" : "disconnected";
  if (!session.isRightChain) return "wrong-chain";
  if (!hasSigner) return "connecting";
  if (busy) return "placing";
  if (gasShort) return "out-of-gas";
  return null;
}
