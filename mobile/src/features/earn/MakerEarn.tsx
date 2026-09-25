import type { MakerVaultState, MakerWindowView } from "@agari/core/maker";
import { makerSheet } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId } from "@agari/core/types";
import { useBalanceSheet, useMakerHistory, useMakerShares, useMakerVault, useMakerWindows, useMarketsLite } from "@agari/markets/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EARN } from "@/features/earn/copy";
import { RESERVES } from "@/features/earn/reserves";
import { useEarnWrites } from "@/features/earn/useEarnWrites";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { ReadingView } from "~/components/kit";
import { EarnMain } from "./EarnMain";
import { EarnHero, NotDeployed } from "./EarnParts";
import { WindowsTable } from "./WindowsTable";

const WORDS = RESERVES.maker;

/** web's `features/earn/MakerEarn.tsx`: the maker vault tab — the hero with the live panel, §01 supply and position, §02 where the capital is. */
export function MakerEarn({ symbol, tabs }: { symbol: string; tabs: ReactNode }) {
  const reading = useMakerVault();
  const vault = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || vault !== null;
  const status = vault && !vault.paused && vault.maker === null ? EARN.panel.noMaker : undefined;
  return (
    <>
      {deployed ? <EarnHero words={WORDS} sheet={vault ? makerSheet(vault) : null} symbol={symbol} status={status} /> : null}
      {tabs}
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page vault={state} symbol={symbol} /> : <NotDeployed />)}
      </ReadingView>
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
  // One round for every Window the table names, so the withdraw guard sees every open Window.
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
    <EarnMain
      words={WORDS}
      sheet={makerSheet(vault)}
      symbol={symbol}
      pausedBody={vault.paused ? EARN.paused.body : null}
      connected={address !== null}
      walletBase={walletBase}
      held={held}
      unsettledExpired={unsettledExpired}
      busy={writes.busy}
      onSupply={writes.supply}
      onWithdraw={writes.withdraw}
      message={message}
      onMessage={setMessage}
      second={{ number: sections.windows.number, title: sections.windows.title }}
    >
      <WindowsTable open={openViews} history={historyViews} markets={markets} decimals={vault.decimals} symbol={symbol} nowMs={nowMs} busy={writes.busy} canSign={writes.canSign} onMerge={writes.merge} onSettle={writes.settle} />
    </EarnMain>
  );
}
