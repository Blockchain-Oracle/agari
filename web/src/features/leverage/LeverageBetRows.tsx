"use client";

import type { LeveragePosition } from "@masayume/core/leverage";
import { isOk } from "@masayume/core/schemas";
import { useLeverageMark, useLeverageReserve, useMarket, useMyLeveragePositions } from "@masayume/markets/react";
import type { ListItem } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { LeverageBetRow } from "./LeverageBetRow";
import { useLeverageWrites } from "./useLeverageWrites";

const NONE: readonly ListItem[] = [];

interface RowProps {
  position: LeveragePosition;
  symbol: string | undefined;
  decimals: number;
  nowMs: number;
  writes: ReturnType<typeof useLeverageWrites>;
}

function Row({ position, symbol, decimals, nowMs, writes }: RowProps) {
  const market = useMarket(position.marketId);
  const mark = useLeverageMark(position.status === "live" ? position.positionId : null);
  const info = market && isOk(market) && market.value ? { asset: market.value.asset, intervalSec: market.value.intervalSec } : null;
  return (
    <LeverageBetRow
      position={position}
      market={info}
      mark={mark && isOk(mark) ? mark.value : null}
      symbol={symbol}
      decimals={decimals}
      nowMs={nowMs}
      busy={writes.busy}
      canSign={writes.canSign}
      isOwner={writes.address?.toLowerCase() === position.owner}
      onCashOut={(p, min) => void writes.close(p.positionId, p.marketId, min, decimals, symbol ?? "")}
      onSettle={(p) => void writes.settle(p.positionId, p.marketId)}
    />
  );
}

/**
 * The wallet's boosts as rows for the portfolio's two tabs: the live ones (with their mark) belong
 * with the open bets, the ones that settled, knocked out or cashed out with the history. The tabs
 * own the lists and their pages, so this returns items rather than sections. Empty without a
 * reserve or without positions — the wallet's panel already carries the empty state.
 */
export function useLeverageBetItems(symbol: string | undefined): { live: readonly ListItem[]; done: readonly ListItem[] } {
  const { address } = useWalletSession();
  const reserve = useLeverageReserve();
  const decimals = reserve && isOk(reserve) && reserve.value ? reserve.value.decimals : 6;
  const nowMs = useChainNowMs();
  const reading = useMyLeveragePositions(address);
  const writes = useLeverageWrites();
  if (!reading || !isOk(reading) || reading.value.length === 0) return { live: NONE, done: NONE };
  const item = (p: LeveragePosition): ListItem => ({
    key: `boost:${p.positionId.toString()}`,
    node: <Row position={p} symbol={symbol} decimals={decimals} nowMs={nowMs} writes={writes} />,
  });
  return {
    live: reading.value.filter((p) => p.status === "live").map(item),
    done: reading.value.filter((p) => p.status !== "live").map(item),
  };
}
