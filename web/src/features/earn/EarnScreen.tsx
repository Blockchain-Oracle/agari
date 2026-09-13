"use client";

import type { MakerVaultState, MakerWindowView } from "@masayume/core/maker";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { isOk } from "@masayume/core/schemas";
import { useBalanceSheet, useMakerHistory, useMakerShares, useMakerVault, useMakerWindows, useMarketsLite } from "@masayume/markets/react";
import { useEffect, useMemo, useState } from "react";
import { CapabilityPending, SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { useVenue } from "../markets/useVenue";
import { EARN } from "./copy";
import { PositionCard, SupplyCard } from "./SupplyCards";
import { useEarnWrites } from "./useEarnWrites";
import { VaultPanel } from "./VaultPanel";
import { WindowsTable } from "./WindowsTable";
import "../parlay/parlay-page.css";
import "./earn-page.css";

/** `/earn` — `reference/yosuku/app/earn/page.tsx`: the hero with the live panel, §01 supply and your position; ours adds §02, where the capital is. */
export function EarnScreen() {
  const reading = useMakerVault();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const vault = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || vault !== null;
  return (
    <div className="earn-page ea-page">
      {deployed && <Hero vault={vault} symbol={symbol} />}
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page vault={state} symbol={symbol} /> : <NotDeployed />)}
      </ReadingBoundary>
    </div>
  );
}

/** The reference renders the hero at once and lets the panel say "loading the vault…" (page.tsx L222–224). */
function Hero({ vault, symbol }: { vault: MakerVaultState | null; symbol: string }) {
  return (
    <section className="page-hero">
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />
      <div className="container">
        <div className="hero-grid">
          <div className="hero-left">
            <h1 className="page-title">
              {EARN.title}
              <br />
              <span className="accent">{EARN.titleAccent}</span>.
            </h1>
          </div>
          <VaultPanel vault={vault} symbol={symbol} />
        </div>
      </div>
    </section>
  );
}

function NotDeployed() {
  const { notDeployed } = EARN;
  return (
    <div className="container">
      <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
        <p>{notDeployed.body}</p>
        <p>{notDeployed.why}</p>
      </CapabilityPending>
    </div>
  );
}

function Page({ vault, symbol }: { vault: MakerVaultState; symbol: string }) {
  const { address } = useWalletSession();
  const sheet = useBalanceSheet(address);
  const shares = useMakerShares(address);
  const open = useMakerWindows();
  const history = useMakerHistory(10);
  const nowMs = useChainNowMs();
  const writes = useEarnWrites();
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(writes.msg), [writes.msg]);

  const walletBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const held = shares && isOk(shares) ? shares.value : { shares: 0n, worthBase: 0n };
  const openViews = useMemo<MakerWindowView[]>(() => (open && isOk(open) ? open.value : []), [open]);
  const historyViews = useMemo<MakerWindowView[]>(() => (history && isOk(history) ? history.value : []), [history]);
  // One round for every Window the table names, so labels do not resolve one a second and the withdraw guard sees
  // every open Window, not the first two (the vault refused a withdraw on the third — context/49).
  const marketIds = useMemo<MarketId[]>(() => [...openViews, ...historyViews.filter((h) => h.settled).slice(0, 10)].map((v) => v.marketId), [openViews, historyViews]);
  const lite = useMarketsLite(marketIds);
  const markets = useMemo<ReadonlyMap<MarketId, EventMarket>>(() => (lite && isOk(lite) ? lite.value : new Map()), [lite]);
  const unsettledExpired =
    nowMs > 0 &&
    openViews.some((view) => {
      const market = markets.get(view.marketId);
      return market !== undefined && market.expirySec * 1000 <= nowMs;
    });
  const { sections } = EARN;

  return (
    <>
      <div>
        <div className="container ea-main">
          <SectionHead number={sections.supply.number} title={sections.supply.title} meta={sections.supply.meta} />
          {vault.paused && (
            <div className="ea-paused">
              <p className="ea-paused-title">{EARN.paused.title}</p>
              <p className="ea-paused-body">{EARN.paused.body}</p>
            </div>
          )}
          <div className="ea-cards">
            <SupplyCard connected={address !== null} vault={vault} symbol={symbol} walletBase={walletBase} busy={writes.busy} onSupply={writes.supply} onMessage={setMessage} />
            <PositionCard connected={address !== null} vault={vault} symbol={symbol} shares={held.shares} worthBase={held.worthBase} unsettledExpired={unsettledExpired} busy={writes.busy} onWithdraw={writes.withdraw} />
          </div>

          {message && <p className={message.includes("✓") ? "ea-msg" : "ea-msg ea-msg--err"}>{message}</p>}

          <SectionHead number={sections.windows.number} title={sections.windows.title} meta={sections.windows.meta} />
          <WindowsTable open={openViews} history={historyViews} markets={markets} decimals={vault.decimals} symbol={symbol} nowMs={nowMs} busy={writes.busy} canSign={writes.canSign} onMerge={writes.merge} onSettle={writes.settle} />
        </div>
      </div>
    </>
  );
}
