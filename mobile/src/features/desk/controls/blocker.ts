import { DESK_ERRORS_UI } from "@/features/desk/copy-controls";
import type { DeskActions } from "@/features/desk/useDeskWrites";

/** Why a mainnet transaction cannot be asked for from this wallet, or null when it can (web's `tx` refusal, said first). */
export function mainnetBlocker(actions: Pick<DeskActions, "mainnet">): string | null {
  if (actions.mainnet.kind === "ready") return null;
  return actions.mainnet.kind === "unsupported" ? actions.mainnet.why : DESK_ERRORS_UI.noWallet;
}
