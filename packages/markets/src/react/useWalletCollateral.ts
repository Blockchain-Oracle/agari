import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { Address } from "@agari/core/types";
import { getWalletCollateral } from "../provider/wallet-collateral";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

export function useWalletCollateral(wallet: Address | null) {
  return useReadingQuery(keys.walletCollateral(wallet), () => getWalletCollateral(wallet!), { needs: [], enabled: wallet !== null, pollMs: MARKETS_POLL_MS });
}
