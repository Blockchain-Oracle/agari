"use client";

import { formatSessionSpan, sessionCountdown } from "@agari/core/copy";
import { formatEtClock, type TickerSymbol } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { HERO_HEAD } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { cn } from "@/lib/utils";
import { formatDayChange } from "../asset-history/day-change";
import { historyDayChange, useAssetHistory, type AssetHistory } from "../asset-history/useAssetHistory";
import { AssetDisc } from "../hero/asset-mark";
import { ScheduleCallButton } from "../hero/ScheduleCallButton";
import { usdLine } from "../hero/units";
import type { MarketSession } from "../session";
import { CardSpark } from "./CardSpark";
import { etWhen, laneCadenceLabel } from "./lane-view";
import { firstWindowStartSec } from "./next-window";
import "./next-window.css";

export interface NextWindowCardViewProps {
  asset: TickerSymbol;
  basis: LaneBasis;
  intervalSec: number;
  session: MarketSession;
  nowSec: number;
  history: AssetHistory | null;
}

/**
 * The Window that lists next, in the slot its live card will take (D-086): Masayume's between-rounds card
 * (`.market-card.market-card-pending`, as `PausedCard` and `GapListedCard` draw it) carrying the last price, the day's
 * move and the last session's sparkline against the previous close, then when the first Window opens. Not a button
 * until 18f's schedule seam fills.
 */
export function NextWindowCardView({ asset, basis, intervalSec, session, nowSec, history }: NextWindowCardViewProps) {
  const cadence = laneCadenceLabel(basis, intervalSec);
  const countdown = sessionCountdown(session.status, nowSec);
  const opensSec = firstWindowStartSec(session, intervalSec);
  const latest = history?.latest ?? null;
  const change = history ? historyDayChange(history) : null;
  const move = change ? formatDayChange(change) : null;
  return (
    <div className="market-card market-card-pending" data-lane={basis} data-next="">
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={asset} className="glyph" />
          <span className="mc-ticker">{asset}</span>
          <span className="mc-cadence">{cadence}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          {countdown?.kind === "opens" ? SESSION_COPY.next.opensIn(formatSessionSpan(countdown.remainingSec)) : SESSION_COPY.next.clock}
        </span>
      </div>
      <div className="mc-body">
        <div className="mc-pricebar">
          <div className="px">
            <span className="big">{latest ? usdLine(latest.valueRaw) : HERO_HEAD.noPrice}</span>
            {move && (
              <span className={cn("chg", move.direction === "down" ? "down" : "up")}>
                {move.dollars} · {move.percent}
              </span>
            )}
          </div>
        </div>
        <div className="mc-spark">
          <CardSpark points={history?.points ?? []} openingRaw={history?.prevClose?.priceRaw ?? null} />
        </div>
      </div>
      <div className="mc-pending">
        <span className="mc-pending-dot" aria-hidden />
        <p className="mc-pending-copy">
          {opensSec !== null && <strong>{SESSION_COPY.next.first(cadence, etWhen(opensSec))}.</strong>}
          {history?.lastClose ? ` ${SESSION_COPY.next.lastClose(usdLine(history.lastClose.priceRaw), formatEtClock(history.lastClose.sec))}.` : null}
        </p>
        <ScheduleCallButton asset={asset} session={session} />
      </div>
    </div>
  );
}

/** The live card: the asset's archive and tick behind the view. */
export function NextWindowCard(props: Omit<NextWindowCardViewProps, "history">) {
  const history = useAssetHistory(props.asset, props.session);
  return <NextWindowCardView {...props} history={history?.ok ? history.value : null} />;
}
