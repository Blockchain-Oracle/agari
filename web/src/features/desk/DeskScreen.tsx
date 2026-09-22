"use client";

import { isOk } from "@agari/core/schemas";
import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ConnectButton } from "@/features/markets/wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { useViewerZone } from "@/lib/when";
import { DESK } from "./copy";
import { DESK_ERRORS_UI } from "./copy-controls";
import { DeskPage } from "./DeskPage";
import { DeskStudio } from "./DeskStudio";
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

function Notice({ children }: { children: string }) {
  return (
    <div className="dk-page container">
      <div className="dk-panel">
        <p className="type-body text-ink-secondary">{children}</p>
      </div>
    </div>
  );
}

/** `/desk`, `/desk/new` and `/desk/[id]`: the studio when the wallet has no desk, the page when it has, read-only for anyone else's. */
export function DeskScreen({ id = null, studio = false }: DeskScreenProps) {
  const { address, isConnected, isConnecting, connect } = useWalletSession();
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  const nowSec = Math.floor((nowMs || Date.now()) / 1000);
  const key = id ?? address;
  const reading = useDeskView(key, address);
  const writes = useDeskWrites(key);
  // `?basket=` from /baskets and `?edit=1` from the mandate panel, read once after mount so both renders agree.
  const [params, setParams] = useState<{ basket: string | null; edit: boolean }>({ basket: null, edit: false });
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({ basket: search.get("basket"), edit: search.get("edit") !== null });
  }, []);

  if (key === null) {
    if (isConnecting) return <LoadingState shape="plate" className="container py-8" />;
    return (
      <div className="dk-page container">
        <div className="dk-panel">
          <span className="dk-eyebrow">{DESK.eyebrow.studio}</span>
          <p className="type-body text-ink-secondary">{DESK.studio.read.connect}</p>
          <div><ConnectButton /></div>
        </div>
      </div>
    );
  }
  if (reading === null) return <LoadingState shape="plate" className="container py-8" />;
  if (!isOk(reading)) {
    if (reading.error.technical === DESK_NOT_CONFIGURED) return <Notice>{DESK_ERRORS_UI.notConfigured}</Notice>;
    if (reading.error.technical === DESK_NOT_SHARED) return <Notice>{DESK.visitor}</Notice>;
    return (
      <div className="container py-8">
        <ErrorState diagnosis={reading.error} />
      </div>
    );
  }
  const view = deskView(reading.value);
  const own = view.isOwner && isConnected;
  if (!view.exists || (studio && own)) {
    return <DeskStudio owner={own || !view.exists ? address : null} view={view.exists ? view : null} writes={writes} initialBasket={params.basket} editing={studio && view.exists && params.edit} onConnect={connect} zone={zone} nowSec={nowSec} />;
  }
  return <DeskPage view={view} actions={own ? writes : null} zone={zone} nowSec={nowSec} />;
}
