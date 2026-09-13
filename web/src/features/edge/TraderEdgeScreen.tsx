"use client";

import { computeTraderEdge } from "@masayume/core/projection";
import { isOk } from "@masayume/core/schemas";
import Link from "next/link";
import { useMemo } from "react";
import { useHistoryReading } from "@/features/markets/history";
import { useVenue } from "@/features/markets/useVenue";
import { ConnectButton } from "@/features/markets/wallet";
import { MARKETS_PATH } from "@/lib/routes";
import { diagnosisCopy } from "@/lib/copy";
import { EDGE } from "./copy";
import { EdgeReport } from "./EdgeReport";
import { EdgeSkeleton, EdgeState } from "./EdgeState";

const FALLBACK_SYMBOL = "";

function Intro() {
  const words = EDGE.intro;
  return (
    <header className="edge-intro edge-enter">
      <div className="edge-intro-lead">
        <h1 className="edge-title">{words.title}</h1>
        <p className="edge-lede">{words.lede}</p>
      </div>
      <div className="edge-intro-meta" aria-label={words.detailsLabel}>
        <div className="edge-folio" aria-hidden="true">
          {words.folio}
        </div>
        <div className="edge-meta-item">
          <span>{words.source.label}</span>
          <strong>{words.source.value}</strong>
        </div>
        <div className="edge-meta-item">
          <span>{words.method.label}</span>
          <strong>{words.method.value}</strong>
        </div>
      </div>
    </header>
  );
}

/**
 * Trader Edge — ported from `reference/yosuku/app/portfolio/edge/page.tsx`.
 *
 * The reference reads the account's durable per-expiry ledger; this reads the fill projection,
 * which is the same idea on DreamDEX: fills plus the settlement rule, so redeeming a position
 * never erases it. Every state the reference draws is here: connect, reading, failed with a
 * retry, nothing settled yet, and the report.
 */
export function TraderEdgeScreen() {
  const history = useHistoryReading();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : FALLBACK_SYMBOL;
  const value = history.reading?.ok ? history.reading.value : null;
  const report = useMemo(() => (value ? computeTraderEdge(value.rounds, value.openCount) : null), [value]);

  let body: React.ReactNode;
  if (!history.address) {
    body = <EdgeState {...EDGE.states.connect} action={<ConnectButton />} />;
  } else if (history.reading === null) {
    body = <EdgeSkeleton />;
  } else if (!history.reading.ok) {
    body = (
      <EdgeState
        eyebrow={EDGE.states.failed.eyebrow}
        title={EDGE.states.failed.title}
        copy={diagnosisCopy(history.reading.error.kind).headline}
        action={
          <button type="button" className="edge-state-action" onClick={history.retry}>
            {EDGE.states.failed.retry}
          </button>
        }
      />
    );
  } else if (!value || !report || report.settledRounds === 0) {
    const open = value?.openCount ?? 0;
    body = (
      <EdgeState
        eyebrow={EDGE.states.none.eyebrow}
        title={EDGE.states.none.title}
        copy={open > 0 ? EDGE.states.none.open(open) : EDGE.states.none.first}
        action={
          <Link href={MARKETS_PATH} className="edge-state-action">
            {EDGE.states.none.action}
          </Link>
        }
      />
    );
  } else {
    body = <EdgeReport history={value} report={report} symbol={symbol} />;
  }

  return (
    <div className="edge-page">
      <div className="edge-main">
        <Link href="/portfolio" className="edge-back" data-cursor="hover">
          <span aria-hidden="true">←</span> {EDGE.back}
        </Link>
        <Intro />
        {body}
      </div>
    </div>
  );
}
