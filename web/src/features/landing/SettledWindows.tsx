"use client";

import type { Address, EventMarket } from "@agari/core/types";
import { addressUrl } from "@agari/core/urls";
import Link from "next/link";
import { ReadingBoundary } from "@/components/states";
import { webEnv } from "@/lib/env";
import { proofHref } from "@/lib/routes";
import { AssetDisc } from "../markets/hero/asset-mark";
import { etWhen, laneAssetLabel, laneCadenceLabel } from "../markets/lanes/lane-view";
import { LANDING } from "./copy";
import { useSettledWindows } from "./useSettledWindows";

type Outcome = keyof typeof LANDING.proof.outcome;

/** Outcome 0 is Up, 1 is Down (core `claims/enumerate.ts`); a void pays both sides back. Null while the winner is unread. */
function outcomeOf(market: EventMarket): Outcome | null {
  if (market.voided) return "void";
  if (market.winningOutcome === null) return null;
  return market.winningOutcome === 1 ? "down" : "up";
}

function SettledRow({ market }: { market: EventMarket }) {
  const label = laneAssetLabel(market.asset, market.lane);
  const outcome = outcomeOf(market);
  const title = `${label} ${laneCadenceLabel(market.lane, market.intervalSec)}`;
  return (
    <li className="lp-settled-row">
      <AssetDisc asset={label} className="lp-mark" />
      <span className="lp-settled-name">{title}</span>
      <span className="lp-settled-when">{LANDING.proof.closed(etWhen(market.expirySec))}</span>
      <span className="lp-settled-outcome" data-outcome={outcome ?? undefined}>
        {outcome ? LANDING.proof.outcome[outcome] : "—"}
      </span>
      <span className="lp-settled-links">
        <Link href={proofHref(market.marketId)} className="lp-link" data-cursor="hover">
          {LANDING.proof.printProof}
        </Link>
        <a
          href={addressUrl(market.marketAddress, webEnv.markets.cluster)}
          target="_blank"
          rel="noreferrer"
          className="lp-link"
          aria-label={LANDING.proof.explorerAria(title)}
          data-cursor="hover"
        >
          {LANDING.proof.explorer}
        </a>
      </span>
    </li>
  );
}

/** The client half of the proof strip: the newest settled Windows from the index, each with its proof and its account. */
export function SettledWindows({ venueId }: { venueId: Address | null }) {
  const reading = useSettledWindows(venueId);
  return (
    <div className="lp-settled">
      <h3 className="lp-proof-label">{LANDING.proof.settled}</h3>
      {venueId === null ? (
        <p className="lp-note">{LANDING.proof.unset}</p>
      ) : (
        <ReadingBoundary reading={reading} shape="row" isEmpty={(rows) => rows.length === 0} empty={{ why: LANDING.proof.none }}>
          {(rows) => (
            <ul className="lp-settled-list">
              {rows.map((market) => (
                <SettledRow key={market.marketId} market={market} />
              ))}
            </ul>
          )}
        </ReadingBoundary>
      )}
    </div>
  );
}
