import { formatCadence, TICKERS } from "@agari/core/market";
import { roundSettledAtMs, type SettledRound } from "@agari/core/projection";
import type { OpenPosition } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { usePositions, useWalletHistory } from "@agari/markets/react";
import { useMemo } from "react";
import { useHoldings, type HoldingView } from "@/features/hedge/useHoldings";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import type { SenseiHolding, SenseiPosition, SenseiRecord, SenseiSession } from "@/features/sensei/protocol";
import { baseToCents } from "@/features/sensei/units";
import type { SenseiContext } from "@/features/sensei/useSenseiContext";
import { useWalletSession } from "@/lib/wallet-session";

const MAX_POSITIONS = 8;
const MAX_HOLDINGS = 4;
const TICK_MS = 60_000;
const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_E6_PER_CENT = 10_000n;

function sideOf(position: OpenPosition): SenseiPosition["side"] {
  if (position.balanceUpRaw > 0n && position.balanceDownRaw > 0n) return "both";
  return position.balanceUpRaw > 0n ? "up" : "down";
}

function toPositions(positions: readonly OpenPosition[], nowMs: number): SenseiPosition[] {
  return positions
    .filter((position) => position.expirySec * 1000 > nowMs)
    .sort((a, b) => a.expirySec - b.expirySec)
    .slice(0, MAX_POSITIONS)
    .map((position) => ({
      asset: position.asset,
      cadence: formatCadence(position.intervalSec),
      side: sideOf(position),
      stakeCents: Math.max(0, baseToCents(position.costBasisBase, position.decimals)),
      markCents: Math.max(0, baseToCents(position.markValueBase, position.decimals)),
      minsToClose: Math.max(0, Math.round((position.expirySec * 1000 - nowMs) / 60_000)),
    }));
}

function toHoldings(holdings: readonly HoldingView[]): SenseiHolding[] {
  const value = (h: HoldingView) => h.exposureUsdE6 ?? -1n;
  return [...holdings]
    .sort((a, b) => (value(b) > value(a) ? 1 : value(b) < value(a) ? -1 : 0))
    .slice(0, MAX_HOLDINGS)
    .map((h) => ({
      name: TICKERS[h.underlying].name,
      symbol: h.symbol,
      issuer: h.issuer,
      tokens: formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 }),
      valueCents: h.exposureUsdE6 === null ? null : Number((h.exposureUsdE6 + USD_E6_PER_CENT / 2n) / USD_E6_PER_CENT),
    }));
}

function toRecord(rounds: readonly SettledRound[]): SenseiRecord {
  const decided = rounds
    .filter((round) => round.outcome === "win" || round.outcome === "loss")
    .sort((a, b) => roundSettledAtMs(b) - roundSettledAtMs(a));
  const wins = decided.filter((round) => round.outcome === "win").length;
  const newest = decided[0]?.outcome;
  let run = 0;
  while (run < decided.length && decided[run]!.outcome === newest) run += 1;
  return { settled: rounds.length, wins, losses: decided.length - wins, streak: newest === "loss" ? -run : run };
}

/**
 * web's `useSenseiContext` (features/sensei/useSenseiContext.ts), rule for rule: the session, the reader's open
 * positions, settled record and stock tokens, read only while the sheet is open with a wallet connected; no address
 * leaves the phone. Web's file imports the hedge barrel (DOM cards and CSS) and the desk reader (the browser's mainnet
 * signer), so the app keeps the same mapping here; the desk block is left out, which the request reads as unknown.
 */
export function useSenseiContext(open: boolean, nowMs: number): SenseiContext {
  const { address } = useWalletSession();
  const market = useMarketSession();
  const positions = usePositions(open ? address : null);
  const history = useWalletHistory(address, open);
  const holdings = useHoldings(open ? address : null);
  const tick = Math.floor(nowMs / TICK_MS);

  const state = market?.status.state ?? null;
  const label = market?.label ?? null;
  const session = useMemo<SenseiSession | null>(() => (state === null || label === null ? null : { state, label }), [state, label]);

  const positionRows = open && address !== null && positions?.ok ? positions.value : null;
  const rounds = open && address !== null && history?.ok ? history.value.rounds : null;
  const holdingRows = open && address !== null && holdings?.ok ? holdings.value : null;

  return useMemo<SenseiContext>(
    () => ({
      session,
      ...(positionRows ? { positions: toPositions(positionRows, tick * TICK_MS) } : {}),
      ...(rounds ? { record: toRecord(rounds) } : {}),
      ...(holdingRows ? { holdings: toHoldings(holdingRows) } : {}),
    }),
    [session, positionRows, rounds, holdingRows, tick],
  );
}
