"use client";

import { LoadingState } from "@/components/states";
import { HeroAssetChart } from "../markets/hero/HeroAssetChart";
import { useMarketSession } from "../markets/session";
import { FEATURED_TICKER, FEATURED_TICKERS } from "./data";

/** The dial follows no picker: one featured asset, so the pick is a no-op the chart never offers. */
const keepAsset = () => undefined;

/**
 * The hero's live dial (D-093): 18a's asset hero for the featured ticker, block for block. Open, it is the live tick and
 * the day's move over the chart; closed, the last close "as of" its time with the session phrase and the countdown to
 * the open (D-086, D-087). It reads only the shared `/session`, archive and price keys, on their own stale and gc
 * times, and adds no poll of its own. No schedule seam: the landing sends a call to `/markets`.
 */
export function LandingDial() {
  const session = useMarketSession(FEATURED_TICKER);
  if (!session) {
    return (
      <div className="hero-chart lp-dial-wait">
        <LoadingState shape="chart" />
      </div>
    );
  }
  return <HeroAssetChart asset={FEATURED_TICKER} tickers={FEATURED_TICKERS} onPickAsset={keepAsset} />;
}
