"use client";

import { isOk } from "@masayume/core/schemas";
import { keys, usePositions } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Pager, SectionHeader } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { LEVERAGE, useLeverageBetItems } from "@/features/leverage";
import { useVaultBetItems } from "@/features/vault";
import { PORTFOLIO } from "@/lib/copy";
import { type ListItem, usePager } from "@/lib/use-pager";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { HistoryRows, type HistoryReading } from "../history";
import { useChainNowMs } from "../useChainNow";
import { BetRow } from "./BetRow";

const PAGE_SIZE = 8;
type Tab = "open" | "history";

interface BetsPanelProps {
  symbol: string | undefined;
  index: string;
  history: HistoryReading;
}

function TabButton({ tab, current, count, label, onPick }: { tab: Tab; current: Tab; count: number | null; label: string; onPick: (tab: Tab) => void }) {
  const on = tab === current;
  return (
    <button type="button" role="tab" aria-selected={on} className={cn("bets-tab", on && "bets-tab--on")} onClick={() => onPick(tab)} data-cursor="hover">
      {label}
      {count !== null && <span className="bets-tab-count numbers">{count}</span>}
    </button>
  );
}

/**
 * Your bets — Yosuku's own portfolio spec (`PORTFOLIO_UX_SPEC.md` §Section 4, which its pinned page
 * never finished): one bordered plate, two tabs. **Open** is every position still running — the
 * wallet's, off `getOpenPositionsWithPnL` (the venue's own cost basis, mark and unrealised PnL), the
 * vault's, and the live boosts. **History** is every settled Window from the fill projection, then
 * the boosts that settled, knocked out or cashed out. Eight rows a page with a pager, in place of the
 * endless scroll the owner refused (2026-09-04).
 *
 * Two sources for the wallet's rows on purpose. The venue's engine clamps a sell beyond inventory to
 * zero and drops the complement, so an open short would read as no position; the projection books it
 * as the other side (verified against chain balances). A settled row therefore never depends on the
 * open-position engine, and the two cannot disagree about a Window that has closed.
 */
export function BetsPanel({ symbol, index, history }: BetsPanelProps) {
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const reading = usePositions(address);
  const vaultItems = useVaultBetItems(symbol);
  const boosts = useLeverageBetItems(symbol);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const retry = () => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.positions(address) });
  };

  const positionItems: ListItem[] =
    reading && isOk(reading) ? reading.value.map((position) => ({ key: `wallet:${position.marketId}`, node: <BetRow position={position} symbol={symbol} nowMs={nowMs} /> })) : [];
  const openItems = [...positionItems, ...vaultItems, ...boosts.live];
  const pager = usePager(openItems, PAGE_SIZE);
  const openCount = reading && isOk(reading) ? openItems.length : null;
  const settledCount = history.reading?.ok ? history.reading.value.rounds.length + boosts.done.length : null;

  return (
    <section className="flex flex-col gap-4" aria-label={PORTFOLIO.betsTitle}>
      <SectionHeader
        index={index}
        title={PORTFOLIO.betsTitle}
        aside={
          <div className="bets-tabs" role="tablist" aria-label={PORTFOLIO.betsTitle}>
            <TabButton tab="open" current={tab} count={openCount} label={PORTFOLIO.tabs.open} onPick={setTab} />
            <TabButton tab="history" current={tab} count={settledCount} label={PORTFOLIO.tabs.history} onPick={setTab} />
          </div>
        }
      />
      <div className="bets-plate" role="tabpanel">
        {tab === "open" ? (
          <ReadingBoundary
            reading={reading}
            shape="row"
            retry={retry}
            isEmpty={() => openItems.length === 0}
            empty={{ why: PORTFOLIO.noBets, nextAction: { label: PORTFOLIO.firstCall, href: "/markets" } }}
          >
            {() => (
              <>
                <ul className="bets-list">
                  {pager.slice.map((item) => (
                    <Fragment key={item.key}>{item.node}</Fragment>
                  ))}
                </ul>
                <Pager pager={pager} />
              </>
            )}
          </ReadingBoundary>
        ) : (
          <>
            <HistoryRows history={history} symbol={symbol} />
            {boosts.done.length > 0 && (
              <div className="bets-sublist">
                <span className="type-label-micro text-ink-muted">{LEVERAGE.bets.history}</span>
                <ul className="bets-list">
                  {boosts.done.map((item) => (
                    <Fragment key={item.key}>{item.node}</Fragment>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <Link href="/markets" data-cursor="hover" className="type-caption text-accent">
        {PORTFOLIO.toMarkets} →
      </Link>
    </section>
  );
}
