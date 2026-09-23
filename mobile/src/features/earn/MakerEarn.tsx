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
import { ReadingView, SectionHeader } from "~/components/kit";
import type { ReviewRequest } from "~/features/short/ReviewSheet";
import { EarnHero, Message, NotDeployed, PausedNote } from "./EarnParts";
import { PositionCard, SupplyCard } from "./SupplyCards";
import { WindowsList } from "./WindowsList";

const WORDS = RESERVES.maker;

/** web's `features/earn/MakerEarn.tsx`: the maker vault tab — hero panel, §01 supply and position, §02 its Windows. */
export function MakerEarn({ symbol, tabs, onReview }: { symbol: string; tabs: ReactNode; onReview: (r: ReviewRequest) => void }) {
  const reading = useMakerVault();
  const vault = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || vault !== null;
  const status = vault && !vault.paused && vault.maker === null ? EARN.panel.noMaker : undefined;
  return (
    <>
      {deployed ? <EarnHero words={WORDS} sheet={vault ? makerSheet(vault) : null} symbol={symbol} status={status} /> : null}
      {tabs}
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page vault={state} symbol={symbol} onReview={onReview} /> : <NotDeployed />)}
      </ReadingView>
    </>
  );
}

function Page({ vault, symbol, onReview }: { vault: MakerVaultState; symbol: string; onReview: (r: ReviewRequest) => void }) {
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
  // web's one round for every Window the list names, so the withdraw guard sees every open Window.
  const marketIds = useMemo<MarketId[]>(() => [...openViews, ...historyViews.filter((h) => h.settled).slice(0, 10)].map((v) => v.marketId), [openViews, historyViews]);
  const lite = useMarketsLite(marketIds);
  const markets = useMemo<ReadonlyMap<MarketId, EventMarket>>(() => (lite && isOk(lite) ? lite.value : new Map()), [lite]);
  const unsettledExpired =
    nowMs > 0 &&
    openViews.some((view) => {
      const market = markets.get(view.marketId);
      return market !== undefined && market.expirySec * 1000 <= nowMs;
    });
  const vaultSheet = makerSheet(vault);
  const { sections } = EARN;

  const crank = (kind: "merge" | "settle", marketId: MarketId, label: string) =>
    onReview({
      title: `${kind === "merge" ? "Merge" : "Settle"} the vault's ${label} Window`,
      lines: [
        { label: "Window", value: label },
        { label: "What it does", value: kind === "merge" ? "Pairs UP with DOWN back into cash" : "Books the closed Window" },
      ],
      maxLoss: null,
      confirmLabel: `Slide to ${kind}`,
      send: async () => {
        if (kind === "merge") writes.merge(marketId);
        else writes.settle(marketId);
        return null;
      },
    });

  return (
    <>
      <SectionHeader index={sections.supply.number} title={WORDS.supplyTitle} desc={WORDS.supplyMeta} />
      {vault.paused ? <PausedNote body={EARN.paused.body} /> : null}
      <SupplyCard sheet={vaultSheet} words={WORDS} symbol={symbol} walletBase={walletBase} busy={writes.busy} onSupply={writes.supply} onMessage={setMessage} onReview={onReview} />
      <PositionCard
        connected={address !== null}
        sheet={vaultSheet}
        words={WORDS}
        symbol={symbol}
        shares={held.shares}
        worthBase={held.worthBase}
        suppliedBase={held.suppliedBase}
        withdrawnBase={held.withdrawnBase}
        unsettledExpired={unsettledExpired}
        busy={writes.busy}
        onWithdraw={writes.withdraw}
        onReview={onReview}
      />
      <Message text={message} />
      <SectionHeader index={sections.windows.number} title={sections.windows.title} desc={sections.windows.meta} />
      <WindowsList
        open={openViews}
        history={historyViews}
        markets={markets}
        decimals={vault.decimals}
        symbol={symbol}
        nowMs={nowMs}
        busy={writes.busy}
        canSign={writes.canSign}
        onMerge={(id, label) => crank("merge", id, label)}
        onSettle={(id, label) => crank("settle", id, label)}
      />
    </>
  );
}
