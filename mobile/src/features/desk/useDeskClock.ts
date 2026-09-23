import { useChainNowMs } from "@/features/markets/useChainNow";
import { useViewerZone } from "@/lib/when";

/** The chain's clock in seconds and the reader's zone, as every web desk screen reads them. */
export function useDeskClock(): { nowSec: number; zone: string | null } {
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  return { nowSec: Math.floor((nowMs || Date.now()) / 1000), zone };
}
