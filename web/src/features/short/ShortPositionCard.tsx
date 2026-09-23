"use client";

import { shortHealth, shortMarkPriceRaw, shortPnl, shortPriced, shortResult, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { countdown } from "@agari/core/lifecycle";
import { bpsToOddsCents, formatBaseUnits, priceRawToBps, shortHex } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { Countdown, Money } from "@/components/data";
import { formatCadence, PORTFOLIO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../markets/hero/asset-mark";
import type { LeverageBusyKey } from "../leverage";
import { SHORT } from "./copy";

/** The owner's own slippage guard on a close, as `LeverageBetRow` uses: the book may move between the mark and the send. */
const CLOSE_FLOOR_BPS = 9_700n;

export interface ShortPositionCardProps {
  position: LeveragePosition;
  /** The Window's asset and cadence; null while the read is in flight, and also for a Window this app does not list. */
  market: { asset: string; intervalSec: number } | null;
  /** Whether that read has landed. A drive-only Series (D-027) resolves to nothing, and saying so beats "…" forever. */
  marketKnown?: boolean;
  mark: LeverageMark | null;
  symbol: string;
  decimals: number;
  nowMs: number;
  busy: LeverageBusyKey | null;
  canSign: boolean;
  onClose: (position: LeveragePosition, minProceedsBase: bigint) => void;
  onSettle: (position: LeveragePosition) => void;
  onClaim: (position: LeveragePosition) => void;
}

/**
 * One short, as a position rather than a row in a bet list.
 *
 * Every figure is the chain's or a difference of two of them: the entry price the position recorded, the same
 * price recomputed at the book's mark, the owner's equity against their stake, and the fall that reaches the
 * knock-out line. A position the book cannot take in full is not marked at all — the reserve would refuse the
 * exit, so a number there would be one nobody could act on.
 */
export function ShortPositionCard(p: ShortPositionCardProps) {
  const { position, market, marketKnown = false, mark, symbol, decimals, nowMs, busy, canSign, onClose, onSettle, onClaim } = p;
  const { positions } = SHORT;
  const live = position.status === "live";
  const settling = live && market && nowMs > 0 ? (countdown(nowMs, position.expirySec, market.intervalSec).settling ?? false) : false;
  const priced = shortPriced(position, mark);
  const multiple = Math.round(position.leverageBps / 1_000) / 10;

  return (
    <li className={cn("sh-pos", !live && "sh-pos--done")}>
      <div className="sh-pos-head">
        {market && <AssetDisc asset={market.asset} className="sh-pos-mark" />}
        <Link href={marketDeepLink({ marketId: position.marketId })} data-cursor="hover" className="sh-pos-asset">
          {market?.asset ?? (marketKnown ? shortHex(position.marketId, 4, 4) : "…")}
        </Link>
        <span className="sh-pos-x">{multiple}×</span>
        {market && <span className="sh-pos-c">{formatCadence(market.intervalSec)}</span>}
        <span className="sh-pos-flex" />
        {live && market && !settling && (
          <span className="sh-pos-left">
            <Countdown expirySec={position.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {SHORT.picker.left}
          </span>
        )}
        {settling && <span className="sh-pos-left">{PORTFOLIO.settling}</span>}
        {!live && <span className="sh-pos-state">{resultWord(position)}</span>}
      </div>

      {live ? <LiveBody {...p} priced={priced} /> : <DoneBody position={position} decimals={decimals} symbol={symbol} />}

      <div className="sh-pos-foot">
        {live && settling && canSign && (
          <button type="button" className="sh-act" disabled={busy === `settle:${position.positionId}`} onClick={() => onSettle(position)} data-cursor="hover">
            {busy === `settle:${position.positionId}` ? positions.settling : positions.settle}
          </button>
        )}
        {live && !settling && canSign && priced && mark && (
          <button type="button" className="sh-act sh-act--primary" disabled={busy === `close:${position.positionId}`} onClick={() => onClose(position, (mark.markBase * CLOSE_FLOOR_BPS) / 10_000n)} data-cursor="hover">
            {busy === `close:${position.positionId}` ? positions.closing : positions.close}
          </button>
        )}
        {position.owedBase > 0n && (
          <>
            <span className="sh-owed">{positions.owed(formatBaseUnits(position.owedBase, decimals), symbol)}</span>
            {canSign && (
              <button type="button" className="sh-act sh-act--primary" disabled={busy === `claim:${position.positionId}`} onClick={() => onClaim(position)} data-cursor="hover">
                {busy === `claim:${position.positionId}` ? positions.claiming : positions.claim}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function LiveBody({ position, mark, decimals, symbol, priced }: ShortPositionCardProps & { priced: boolean }) {
  const { positions } = SHORT;
  const entryCents = bpsToOddsCents(priceRawToBps(position.entryPriceRaw, decimals));
  if (!priced || !mark) {
    return (
      <div className="sh-pos-body">
        <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={null} worth={null} />
        <p className="sh-pos-unpriced">
          <span className="sh-pos-unpriced-t">{positions.unpriced}</span> {positions.unpricedWhy}
        </p>
      </div>
    );
  }
  const pnl = shortPnl(position, mark.markBase);
  const health = shortHealth(mark, position.frontedBase);
  const nowCents = bpsToOddsCents(priceRawToBps(shortMarkPriceRaw(position, mark.markBase), decimals));
  return (
    <div className="sh-pos-body">
      <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={nowCents} worth={pnl} />
      <p className={cn("sh-line", `sh-line--${health.band}`)}>
        {health.band === "at-line"
          ? positions.atLine
          : health.band === "unfronted"
            ? positions.noLine
            : `${positions.drop(`${Math.round((health.dropToLineBps ?? 0) / 100)}%`)} · ${positions.line(formatBaseUnits(mark.lineBase, decimals), symbol)}`}
      </p>
    </div>
  );
}

function Figures({
  position,
  decimals,
  symbol,
  entryCents,
  nowCents,
  worth,
}: {
  position: LeveragePosition;
  decimals: number;
  symbol: string;
  entryCents: number;
  nowCents: number | null;
  worth: { equityBase: bigint; pnlBase: bigint } | null;
}) {
  const { positions } = SHORT;
  return (
    <dl className="sh-figs">
      <div className="sh-fig">
        <dt>{positions.size}</dt>
        <dd className="numbers">{formatBaseUnits(position.quantityRaw, decimals, { minDp: 0, maxDp: 2 })}</dd>
      </div>
      <div className="sh-fig">
        <dt>{positions.entry}</dt>
        <dd className="numbers">
          {entryCents}¢{nowCents !== null && <span className="sh-fig-now"> → {nowCents}¢</span>}
        </dd>
      </div>
      <div className="sh-fig">
        <dt>{positions.staked}</dt>
        <dd>
          <Money value={position.stakeBase} decimals={decimals} symbol={symbol} />
        </dd>
      </div>
      <div className="sh-fig">
        <dt>{positions.worth}</dt>
        <dd>
          {worth ? (
            <>
              <Money value={worth.equityBase} decimals={decimals} symbol={symbol} />
              <span className="sh-fig-pnl">
                <Money value={worth.pnlBase} decimals={decimals} tone="pnl" />
              </span>
            </>
          ) : (
            <span className="numbers">—</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function DoneBody({ position, decimals, symbol }: { position: LeveragePosition; decimals: number; symbol: string }) {
  const { positions } = SHORT;
  const result = shortResult(position);
  return (
    <div className="sh-pos-body">
      <p className="sh-done">
        <span className="numbers">{position.returnedBase > 0n ? positions.back(formatBaseUnits(position.returnedBase, decimals), symbol) : positions.nothingBack}</span>
        <span className="sh-fig-pnl">
          <Money value={result.pnlBase} decimals={decimals} tone="pnl" />
        </span>
      </p>
    </div>
  );
}

function resultWord(position: LeveragePosition): string {
  const { result } = SHORT.positions;
  if (position.status === "knocked-out") return result.knockedOut;
  if (position.status === "closed") return result.closed;
  if (position.returnedBase === 0n) return result.lost;
  return position.returnedBase > position.stakeBase ? result.won : result.settled;
}
