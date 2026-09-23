import { deliverWalletReturn } from "~/wallet/link-port";

/** Wallet replies (agari://wallet/<method>) finish their hand-off and never navigate; every other link routes as usual. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    return deliverWalletReturn(path) ? null : path;
  } catch {
    return path;
  }
}
