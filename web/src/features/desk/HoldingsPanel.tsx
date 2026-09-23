"use client";

import { CircleDollarSign, Layers, TriangleAlert } from "lucide-react";
import { EmptyState, Sparkline } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { cn } from "@/lib/utils";
import { brandColor } from "./cockpit/OverviewTab";
import { COCKPIT } from "./cockpit/copy-cockpit";
import { DESK } from "./copy";
import { pct, tokens, usd } from "./format";
import type { DeskView, HoldingRow } from "./view";

const K = COCKPIT.holdings;

/** One company as 21st's Asset Card (#7945): its mark, value, the price line across checks, now against target, flags. */
function HoldingCard({ h, index }: { h: HoldingRow; index: number }) {
  const H = DESK.page.holdings;
  const line = h.priceHistoryE8.map((v) => Number(v));
  const tone = h.driftBps === 0 || h.standing === H.inLine ? "in" : h.driftBps > 0 ? "over" : "under";
  return (
    <article className="cp-card cp-holding" style={{ animationDelay: `${index * 60}ms`, ["--brand" as string]: brandColor(h.symbol) }}>
      <header className="cp-holding-head">
        <AssetDisc asset={h.symbol} className="cp-holding-disc" />
        <div className="cp-holding-id">
          <span className="cp-holding-name">{h.name}</span>
          <span className="cp-holding-sym">{K.tokens(tokens(h.raw), h.symbol)}</span>
        </div>
        <span className="cp-holding-value">{h.valueE6 === null ? "—" : usd(h.valueE6)}</span>
      </header>
      <div className="cp-holding-spark" title={K.week}>
        <Sparkline values={line} width={320} height={44} className="cp-spark" />
      </div>
      <div className="cp-weight">
        <div className="cp-weight-labels">
          <span><span className="cp-stat-label">{K.now}</span> <b>{h.valueE6 === null ? "—" : pct(h.weightBps)}</b></span>
          <span><span className="cp-stat-label">{K.target}</span> <b>{pct(h.targetBps)}</b></span>
        </div>
        <div className="cp-weight-bar" aria-hidden>
          <span className="cp-weight-fill" style={{ width: `${Math.min(100, h.weightBps / 100)}%` }} />
          <span className="cp-weight-tick" style={{ left: `${Math.min(100, h.targetBps / 100)}%` }} />
        </div>
      </div>
      <div className="cp-chips">
        {h.valueE6 !== null && <span className="cp-chip" data-tone={tone}>{h.standing}</span>}
        {h.premiumBps !== null && <span className={cn("cp-chip", h.premiumBps > 0 && "cp-chip-accent")}>{h.premiumBps >= 0 ? H.premium(pct(h.premiumBps)) : H.discount(pct(h.premiumBps))}</span>}
      </div>
      {h.flags.map((flag) => (
        <p key={flag} className="cp-flag"><TriangleAlert /> <span>{flag}</span></p>
      ))}
    </article>
  );
}

/** Item 5: the USDC the desk holds, as its own card. */
function CashCard({ view }: { view: DeskView }) {
  const C = DESK.page.cash;
  const share = view.plate.totalE6 && view.plate.totalE6 > 0n ? Number((view.plate.cashE6 * 10_000n) / view.plate.totalE6) : null;
  return (
    <article className="cp-card cp-holding cp-cash">
      <header className="cp-holding-head">
        <span className="cp-holding-disc cp-usdc" aria-hidden><CircleDollarSign /></span>
        <div className="cp-holding-id">
          <span className="cp-holding-name">{K.cashName}</span>
          <span className="cp-holding-sym">{K.cashTitle}</span>
        </div>
        <span className="cp-holding-value">{usd(view.plate.cashE6)}</span>
      </header>
      {share !== null && (
        <div className="cp-weight">
          <div className="cp-weight-labels">
            <span><span className="cp-stat-label">{K.now}</span> <b>{pct(share)}</b></span>
            <span><span className="cp-stat-label">{K.target}</span> <b>{pct(view.mandate?.targets.cashBps ?? 0)}</b></span>
          </div>
          <div className="cp-weight-bar" aria-hidden>
            <span className="cp-weight-fill" style={{ width: `${Math.min(100, share / 100)}%` }} />
            <span className="cp-weight-tick" style={{ left: `${Math.min(100, (view.mandate?.targets.cashBps ?? 0) / 100)}%` }} />
          </div>
        </div>
      )}
      <p className="type-caption text-ink-secondary">{view.isLive ? C.line(usd(view.plate.cashE6)) : C.practiceLine(usd(view.plate.cashE6))}</p>
    </article>
  );
}

/** Items 4 and 5 (plan §5.7): a card per company held, then the cash. */
export function HoldingsTab({ view }: { view: DeskView }) {
  const H = DESK.page.holdings;
  return (
    <div className="cp-holdings">
      {view.holdings.length === 0 ? (
        <div className="cp-holdings-empty">
          <EmptyState icon={<Layers />} title={H.title} body={H.none} />
        </div>
      ) : (
        view.holdings.map((h, i) => <HoldingCard key={h.symbol} h={h} index={i} />)
      )}
      <CashCard view={view} />
    </div>
  );
}
