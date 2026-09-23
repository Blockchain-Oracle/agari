import { diagnosis, type Address } from "@agari/core/types";
import type { SubmitterSession } from "@agari/markets";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SessionBusy, SessionKeyActions, SessionKeyView } from "@/features/session/view";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Stands in for web/src/features/session/SessionKeyProvider.tsx until the app's Keychain-held session key lands
 * (S26.2 tap trading, D-128): an honest "not armed" view, so the ticket routes through the connected wallet —
 * web's own behaviour for anyone who has not switched tap trading on.
 */
interface SessionKeyContextValue {
  view: SessionKeyView;
  session: SubmitterSession | null;
  actions: SessionKeyActions;
  busy: SessionBusy;
  demandSponsor: () => () => void;
}

const NOT_YET = "Tap trading is not on this phone yet";
const refused = async () => ({ status: "refused" as const, diagnosis: diagnosis("unknown", NOT_YET) });
const ACTIONS: SessionKeyActions = {
  enable: async () => ({ outcome: await refused(), topUpHash: null, topUpError: NOT_YET }),
  rekey: async () => ({ outcome: await refused(), topUpHash: null, topUpError: NOT_YET }),
  revoke: refused,
  topUp: async () => null,
  forget: async () => undefined,
};

const Ctx = createContext<SessionKeyContextValue | null>(null);

export function SessionKeyProvider({ children }: { children: ReactNode }) {
  const { address } = useWalletSession();
  const value = useMemo<SessionKeyContextValue>(
    () => ({
      view: {
        status: address ? "disarmed" : "no-wallet",
        owner: (address as Address | null) ?? null,
        key: null,
        grant: null,
        deployment: null,
        decimals: 6,
        nowSec: Math.floor(Date.now() / 1000),
        sponsor: null,
        sponsorRefusal: null,
        keyFeeLamports: 0n,
        vaultAvailableBase: null,
      },
      session: null,
      actions: ACTIONS,
      busy: null,
      demandSponsor: () => () => undefined,
    }),
    [address],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSessionKey(): SessionKeyContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSessionKey needs a SessionKeyProvider above it");
  return ctx;
}

export function useSponsorWhileOpen(_open: boolean): void {}
