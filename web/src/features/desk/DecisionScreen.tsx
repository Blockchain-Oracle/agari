"use client";

import { isOk } from "@agari/core/schemas";
import { ErrorState, LoadingState } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { useViewerZone } from "@/lib/when";
import { DecisionSections } from "./DecisionSections";
import { useDecision } from "./useDesk";

/** `/desk/[id]/decision/[seq]`: one decision read live; the desk's liveness is read off the proof, so no second request. */
export function DecisionScreen({ id, seq }: { id: string; seq: number }) {
  const { address } = useWalletSession();
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  const nowSec = Math.floor((nowMs || Date.now()) / 1000);
  const reading = useDecision(id, seq, address);
  if (reading === null) return <LoadingState shape="plate" className="container py-8" />;
  if (!isOk(reading)) return <div className="container py-8"><ErrorState diagnosis={reading.error} backHref={`/desk/${id}/record`} /></div>;
  return <DecisionSections decision={reading.value} base={`/desk/${id}`} nowSec={nowSec} zone={zone} isLive={reading.value.proof.kind !== "practice"} />;
}
