"use client";

import type { LeverageReserveState } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useBalanceSheet, useLeverageReserve } from "@agari/markets/react";
import { useState } from "react";
import { CapabilityPending, SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { MarketSessionChip } from "../markets/session";
import { useChainNowMs } from "../markets/useChainNow";
import { useVenue } from "../markets/useVenue";
import { SHORT } from "./copy";
import { ShortPicker } from "./ShortPicker";
import { ShortPositions } from "./ShortPositions";
import { ShortTicket } from "./ShortTicket";
import { useShortWindows } from "./useShortWindows";
import "./short-page.css";
import "./short-picker.css";

/** `/short` — A-1b: the inverse position, over the leverage reserve that is already deployed (Q-004). */
export function ShortScreen() {
  const reading = useLeverageReserve();
  return (
    <div className="container sh-page">
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page reserve={state} /> : <NotDeployed />)}
      </ReadingBoundary>
    </div>
  );
}

function NotDeployed() {
  const { notDeployed } = SHORT;
  return (
    <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
      <p>{notDeployed.body}</p>
      <p>{notDeployed.why}</p>
    </CapabilityPending>
  );
}

function Page({ reserve }: { reserve: LeverageReserveState }) {
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const nowMs = useChainNowMs();
  const { stocks, loading } = useShortWindows(nowMs);
  const { address } = useWalletSession();
  const balance = useBalanceSheet(address);
  const [picked, setPicked] = useState<EventMarket | null>(null);
  const { sections } = SHORT;

  // The pick follows the board: a Window that rolled out from under the ticket is replaced by that stock's next one,
  // and with nothing picked yet the soonest is offered — so the picker's highlight and the ticket never disagree.
  const live = stocks.flatMap((s) => s.windows);
  const selected =
    live.find((m) => m.marketId === picked?.marketId) ??
    (picked ? stocks.find((s) => s.asset === picked.asset)?.windows[0] : undefined) ??
    live[0] ??
    null;

  return (
    <>
      <div className="sh-hero">
        <div className="sh-hero-top">
          <span className="sh-eyebrow">{SHORT.eyebrow}</span>
          <MarketSessionChip />
        </div>
        <h1 className="page-title">
          {SHORT.title}
          <span className="accent">.</span>
        </h1>
        <p className="sh-lede">{SHORT.lede}</p>
      </div>

      <section className="sh-block" aria-label={sections.open.title}>
        <SectionHead number={sections.open.number} title={sections.open.title} desc={sections.open.desc} />
        <div className="sh-block-body sh-open">
          <ShortPicker stocks={stocks} loading={loading} selected={selected} onSelect={setPicked} nowMs={nowMs} />
          <ShortTicket
            market={selected}
            nowMs={nowMs}
            reserve={reserve}
            symbol={symbol}
            walletBase={balance && isOk(balance) ? balance.value.spendableBase : null}
            connected={address !== null}
          />
        </div>
      </section>

      <section className="sh-block" aria-label={sections.positions.title}>
        <SectionHead number={sections.positions.number} title={sections.positions.title} desc={sections.positions.desc} />
        <div className="sh-block-body">
          <ShortPositions symbol={symbol} decimals={reserve.decimals} nowMs={nowMs} />
        </div>
      </section>

      <section className="sh-block" aria-label={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <div className="sh-block-body sh-how">
          {SHORT.how(percentOf(reserve.params.premiumBps), percentOf(reserve.params.maintenanceBps)).map((c) => (
            <div key={c.n} className="sh-how-card">
              <div className="sh-how-n">{c.n}</div>
              <div className="sh-how-t">{c.t}</div>
              <p className="sh-how-d">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** A bps parameter as the percentage the copy names: 800 → "8%", 12_000 → "120%". */
function percentOf(bps: number): string {
  return `${Math.round(bps / 10) / 10}%`;
}
