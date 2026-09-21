"use client";

import type { MakerVaultState, MakerWindowView } from "@agari/core/maker";
import { makerSheet } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId } from "@agari/core/types";
import { useBalanceSheet, useMakerHistory, useMakerShares, useMakerVault, useMakerWindows, useMarketsLite } from "@agari/markets/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { EARN } from "./copy";
import { Hero, NotDeployed } from "./Hero";
import { RESERVES } from "./reserves";
import { PositionCard, SupplyCard } from "./SupplyCards";
import { useEarnWrites } from "./useEarnWrites";
import { WindowsTable } from "./WindowsTable";

const WORDS = RESERVES.maker;

/** `/earn`'s maker tab — `reference/yosuku/app/earn/page.tsx`: the hero with the live panel, §01 supply and your position; ours adds §02, where the capital is. */
export function MakerEarn({ symbol, tabs }: { symbol: string; tabs: ReactNode }) {
  const reading = useMakerVault();
  const vault = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || vault !== null;
  const status = vault && !vault.paused && vault.maker === null ? EARN.panel.noMaker : undefined;
  return (
    <>
      {deployed && <Hero words={WORDS} sheet={vault ? makerSheet(vault) : null} symbol={symbol} status={status} />}
      {tabs}
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page vault={state} symbol={symbol} /> : <NotDeployed />)}
      </ReadingBoundary>
    </>
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
  const held = shares && isOk(shares) ? shares.value : { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };
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
  const vaultSheet = makerSheet(vault);

  return (
    <div className="container ea-main">
      <SectionHead number={sections.supply.number} title={WORDS.supplyTitle} meta={WORDS.supplyMeta} />
      {vault.paused && (
        <div className="ea-paused">
          <p className="ea-paused-title">{EARN.paused.title}</p>
          <p className="ea-paused-body">{EARN.paused.body}</p>
        </div>
      )}
      <div className="ea-cards">
        <SupplyCard connected={address !== null} sheet={vaultSheet} symbol={symbol} walletBase={walletBase} busy={writes.busy} onSupply={writes.supply} onMessage={setMessage} />
        <PositionCard connected={address !== null} sheet={vaultSheet} words={WORDS} symbol={symbol} shares={held.shares} worthBase={held.worthBase} suppliedBase={held.suppliedBase} withdrawnBase={held.withdrawnBase} unsettledExpired={unsettledExpired} busy={writes.busy} onWithdraw={writes.withdraw} />
      </div>

      {message && <p className={message.includes("✓") ? "ea-msg" : "ea-msg ea-msg--err"}>{message}</p>}

      <SectionHead number={sections.windows.number} title={sections.windows.title} meta={sections.windows.meta} />
      <WindowsTable open={openViews} history={historyViews} markets={markets} decimals={vault.decimals} symbol={symbol} nowMs={nowMs} busy={writes.busy} canSign={writes.canSign} onMerge={writes.merge} onSettle={writes.settle} />
    </div>
  );
}
