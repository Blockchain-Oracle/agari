"use client";

import { isOk } from "@agari/core/schemas";
import { ErrorState } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { useViewerZone } from "@/lib/when";
import { DecisionSkeleton } from "./decision/DecisionSkeleton";
import { DecisionSections } from "./DecisionSections";
import { useDecision, useDeskView } from "./useDesk";
import { deskView } from "./view";

/**
 * `/desk/[id]/decision/[seq]`: one decision read live; the desk's liveness is read off the proof. The desk's own view
 * (usually already cached from the desk page) adds the premium ceiling to the price strip; without it the strip has no band.
 */
export function DecisionScreen({ id, seq }: { id: string; seq: number }) {
  const { address } = useWalletSession();
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  const nowSec = Math.floor((nowMs || Date.now()) / 1000);
  const reading = useDecision(id, seq, address);
  const desk = useDeskView(id, address);
  const view = desk && isOk(desk) ? deskView(desk.value) : null;
  const ceilingBps = view && (view.mandate || view.wire.chain) ? view.limits.maxPremiumBps : null;
  if (reading === null) return <DecisionSkeleton />;
  if (!isOk(reading)) return <div className="container py-8"><ErrorState diagnosis={reading.error} backHref={`/desk/${id}/record`} /></div>;
  return <DecisionSections decision={reading.value} base={`/desk/${id}`} nowSec={nowSec} zone={zone} isLive={reading.value.proof.kind !== "practice"} ceilingBps={ceilingBps} />;
}
