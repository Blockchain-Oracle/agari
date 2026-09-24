import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { PUSH_ERRORS, PUSH_KINDS, pushRegisterMessage, type PushKind } from "@/features/push/protocol";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";
import { expoPushToken, readRegistration, registerDevice, updateDevice, writeRegistration, type StoredRegistration } from "./push";
import { ALERTS } from "./copy";

export type PushState =
  | { phase: "loading" }
  | { phase: "off" }
  | { phase: "on"; reg: StoredRegistration }
  /** On, but for a wallet other than the one connected now. */
  | { phase: "other-wallet"; reg: StoredRegistration };

/**
 * Notifications settings: what this phone is registered for, and the three moves — turn on (one wallet signature),
 * change the kinds (the stored secret), turn off (the stored secret). A failure keeps the last good state and says why.
 */
export function usePushSettings() {
  const { address } = useWalletSession();
  const wallet = useOwnerWallet();
  const [reg, setReg] = useState<StoredRegistration | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void readRegistration().then(setReg);
  }, []);

  const state: PushState = reg === undefined ? { phase: "loading" } : reg === null ? { phase: "off" } : reg.wallet === address || !address ? { phase: "on", reg } : { phase: "other-wallet", reg };

  const run = useCallback(async (step: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      setError(await step());
    } catch (e) {
      setError(e instanceof Error ? e.message : ALERTS.errors.failed);
    } finally {
      setBusy(false);
    }
  }, []);

  /** Registers this phone for the connected wallet (also how it moves to a new wallet). */
  const turnOn = useCallback(
    (kinds: PushKind[] = [...PUSH_KINDS]) =>
      run(async () => {
        if (!address || !wallet) return ALERTS.errors.connect;
        const token = await expoPushToken();
        if (!token.ok) return token.why === "denied" ? ALERTS.errors.denied : `${ALERTS.errors.token}${token.detail ? ` (${token.detail})` : ""}`;
        const issuedAtMs = Date.now();
        const signature = await signText(wallet, pushRegisterMessage(address, token.token, issuedAtMs));
        const res = await registerDevice({ address, expoToken: token.token, platform: Platform.OS === "android" ? "android" : "ios", kinds, issuedAtMs, signature });
        if (!res.ok) return res.error;
        if (!res.value.secret) return ALERTS.errors.failed;
        const next: StoredRegistration = { expoToken: token.token, secret: res.value.secret, wallet: res.value.wallet, kinds: res.value.kinds };
        await writeRegistration(next);
        setReg(next);
        return null;
      }),
    [address, wallet, run],
  );

  const setKinds = useCallback(
    (kinds: PushKind[]) =>
      run(async () => {
        if (!reg) return null;
        if (kinds.length === 0) return turnOffNow(reg);
        const res = await updateDevice({ expoToken: reg.expoToken, secret: reg.secret, kinds });
        if (!res.ok) return res.error;
        const next = { ...reg, kinds: res.value.kinds };
        await writeRegistration(next);
        setReg(next);
        return null;
      }),
    [reg, run],
  );

  async function turnOffNow(current: StoredRegistration): Promise<string | null> {
    const res = await updateDevice({ expoToken: current.expoToken, secret: current.secret, kinds: null });
    // A device the server no longer knows is already off; forget it here too.
    if (!res.ok && res.error !== PUSH_ERRORS.unknownDevice) return res.error;
    await writeRegistration(null);
    setReg(null);
    return null;
  }

  const turnOff = useCallback(() => run(async () => (reg ? turnOffNow(reg) : null)), [reg, run]);

  return { state, busy, error, turnOn, setKinds, turnOff, connected: address !== null };
}
