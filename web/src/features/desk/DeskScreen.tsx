"use client";

import { isOk } from "@agari/core/schemas";
import { Lock, ServerOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/states";
import { EmptyState } from "@/components/ui/desk-kit";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { useViewerZone } from "@/lib/when";
import { DESK } from "./copy";
import { DESK_ERRORS_UI } from "./copy-controls";
import { DeskPage } from "./DeskPage";
import { DeskStudio } from "./DeskStudio";
import { ENTRY } from "./entry/copy-entry";
import { DeskEntry } from "./entry/DeskEntry";
import { DeskSkeleton } from "./entry/DeskSkeleton";
import { DESK_NOT_CONFIGURED, DESK_NOT_SHARED, useDeskView } from "./useDesk";
import { useDeskWrites } from "./useDeskWrites";
import { deskView } from "./view";
import "./desk.css";

export interface DeskScreenProps {
  /** `/desk/[id]`: a desk id or an owner address; null on `/desk` and `/desk/new`, which are the connected wallet's. */
  id?: string | null;
  /** `/desk/new`: the studio, editing when the wallet already has a desk. */
  studio?: boolean;
}

function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: string }) {
  return (
    <div className="dk-page container en-notice">
      <EmptyState icon={icon} title={title} body={children} />
    </div>
  );
}

/**
 * `/desk`, `/desk/new` and `/desk/[id]`. `/desk` with no desk yet (no wallet, or a wallet without one) is the entry:
 * what a desk does and a live shared desk, with the way into the studio. `/desk/new` (and `/desk?basket=`) is the
 * studio. A wallet with a desk lands on it; anyone else's is read-only.
 */
export function DeskScreen({ id = null, studio = false }: DeskScreenProps) {
  const { address, isConnected, isConnecting, connect } = useWalletSession();
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  const nowSec = Math.floor((nowMs || Date.now()) / 1000);
  const key = id ?? address;
  const reading = useDeskView(key, address);
  const writes = useDeskWrites(key);
  // A visitor on someone else's desk: their own, to offer "Your desk" or "Create your desk" in its place.
  const mine = useDeskView(id !== null ? address : null, address);
  const mineExists = mine !== null && isOk(mine) && mine.value.desk !== null;
  // `?basket=` from /baskets and `?edit=1` from the mandate panel, read once after mount so both renders agree.
  const [params, setParams] = useState<{ basket: string | null; edit: boolean }>({ basket: null, edit: false });
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({ basket: search.get("basket"), edit: search.get("edit") !== null });
  }, []);

  const entry = !studio && params.basket === null;
  if (key === null) {
    // A remembered wallet is still restoring (at most 3 s): a skeleton, never the entry flashing before the page.
    if (isConnecting) return <DeskSkeleton />;
    if (entry) return <DeskEntry />;
    // Drafting is open to anyone (Shijima's rule, the app's never-empty rule): steps 01 and 02 render and edit with no
    // wallet, the draft kept in this browser; the test read and Create ask for the wallet inline where it is needed.
    return <DeskStudio owner={null} view={null} writes={writes} initialBasket={params.basket} editing={false} onConnect={connect} zone={zone} nowSec={nowSec} />;
  }
  if (reading === null) return <DeskSkeleton />;
  if (!isOk(reading)) {
    if (reading.error.technical === DESK_NOT_CONFIGURED) return <Notice icon={<ServerOff />} title={ENTRY.notConfiguredTitle}>{DESK_ERRORS_UI.notConfigured}</Notice>;
    if (reading.error.technical === DESK_NOT_SHARED) return <Notice icon={<Lock />} title={ENTRY.notSharedTitle}>{DESK.visitor}</Notice>;
    return (
      <div className="container py-8">
        <ErrorState diagnosis={reading.error} />
      </div>
    );
  }
  const view = deskView(reading.value);
  const own = view.isOwner && isConnected;
  if (!view.exists && id === null && entry) return <DeskEntry />;
  if (!view.exists || (studio && own)) {
    return <DeskStudio owner={own || !view.exists ? address : null} view={view.exists ? view : null} writes={writes} initialBasket={params.basket} editing={studio && view.exists && params.edit} onConnect={connect} zone={zone} nowSec={nowSec} />;
  }
  const visitorCta = view.isOwner ? null : mineExists ? { href: "/desk", label: ENTRY.yours, primary: false } : { href: "/desk/new", label: ENTRY.start, primary: true };
  return <DeskPage view={view} actions={own ? writes : null} zone={zone} nowSec={nowSec} visitorCta={visitorCta} />;
}
