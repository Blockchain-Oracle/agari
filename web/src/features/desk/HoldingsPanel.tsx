"use client";

import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "./copy";
import { Panel } from "./DeskPanels";
import { pct, tokens, usd } from "./format";
import type { DeskView } from "./view";

/** Item 4 (plan §5.7): one bar per company, actual against the target tick, in line / over / under, the flags. */
export function Holdings({ view }: { view: DeskView }) {
  const H = DESK.page.holdings;
  return (
    <Panel title={H.title}>
      {view.holdings.length === 0 ? (
        <p className="type-body text-ink-secondary">{H.none}</p>
      ) : (
        <div className="dk-rows">
          {view.holdings.map((h) => (
            <div key={h.symbol} className="dk-holding">
              <AssetDisc asset={h.symbol} className="dk-holding-mark" />
              <div className="dk-holding-text">
                <span className="dk-holding-name">{h.name}</span>
                <div className="dk-bar" aria-hidden>
                  <span className="dk-bar-fill" data-tone={h.valueE6 === null ? "quiet" : undefined} style={{ width: `${Math.min(100, h.weightBps / 100)}%` }} />
                  <span className="dk-bar-target" style={{ left: `${Math.min(100, h.targetBps / 100)}%` }} />
                </div>
                <span className="dk-holding-line">
                  {h.valueE6 === null ? `${tokens(h.raw)} · ${H.target(pct(h.targetBps))}` : `${pct(h.weightBps)} · ${H.target(pct(h.targetBps))} · ${h.standing}`}
                  {h.premiumBps !== null ? ` · ${h.premiumBps >= 0 ? H.premium(pct(h.premiumBps)) : H.discount(pct(h.premiumBps))}` : ""}
                </span>
                {h.flags.map((flag) => (
                  <span key={flag} className="dk-holding-flag">{flag}</span>
                ))}
              </div>
              <span className="dk-holding-value">{h.valueE6 === null ? tokens(h.raw) : usd(h.valueE6)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Item 5: USDC in the desk. */
export function Cash({ view }: { view: DeskView }) {
  const C = DESK.page.cash;
  return (
    <Panel title={C.title}>
      <p className="dk-plate-value">{usd(view.plate.cashE6)}</p>
      <p className="type-caption text-ink-secondary">{view.isLive ? C.line(usd(view.plate.cashE6)) : C.practiceLine(usd(view.plate.cashE6))}</p>
    </Panel>
  );
}

/** Item 6: spent today of the daily limit, most in one action, the premium ceiling, the loss stop, the ask-first size. */
export function LimitsInUse({ view }: { view: DeskView }) {
  const L = DESK.page.limits;
  const { limits } = view;
  return (
    <Panel title={L.title}>
      <div className="dk-rows">
        <div className="dk-row"><span>{L.spentToday}</span><b>{L.spentOf(usd(limits.spentTodayE6, 0), usd(limits.dailyCapE6, 0))}</b></div>
        <div className="dk-row"><span>{L.perAction}</span><b>{usd(limits.perActionE6, 0)}</b></div>
        <div className="dk-row"><span>{L.premium}</span><b>{pct(limits.maxPremiumBps)}</b></div>
        <div className="dk-row"><span>{L.loss}</span><b>{pct(limits.lossStopBps)}</b></div>
        <div className="dk-row"><span>{L.large}</span><b>{usd(limits.largeActionE6, 0)}</b></div>
      </div>
      {!view.isLive && <p className="type-caption text-ink-muted">{L.practiceNote}</p>}
    </Panel>
  );
}
