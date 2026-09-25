import { formatCadence } from "@agari/core/copy";
import { equityOf, type LeveragePosition } from "@agari/core/leverage";
import { countdown } from "@agari/core/lifecycle";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useLeverageMark, useMarket } from "@agari/markets/react";
import { LEVERAGE, useLeverageWrites } from "@/features/leverage";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PORTFOLIO } from "@/lib/copy";
import { clockLeft } from "../format";
import { BetsRow, Break, Call, Caption, Micro, MoneyText, Status, TextAction } from "./RowParts";

/** web `LeverageBetRow`: the owner's own slippage guard on a cash-out, 97 % of the mark. */
const CASH_OUT_FLOOR_BPS = 9_700n;

function settledLabel(p: LeveragePosition): string {
  const { bets } = LEVERAGE;
  if (p.status === "knocked-out") return bets.knockedOut;
  if (p.status === "closed") return bets.closed;
  if (p.returnedBase === 0n) return bets.lost;
  return p.returnedBase > p.stakeBase ? bets.won : bets.settled;
}

interface Props {
  position: LeveragePosition;
  symbol: string | undefined;
  decimals: number;
  nowMs: number;
  writes: ReturnType<typeof useLeverageWrites>;
  first: boolean;
}

/**
 * web `LeverageBetRow` (+ `LeverageBetRows.Row`'s reads): the multiple, the stake, equity at the Book's mark and the
 * knock-out line while live, what came back once it ended; Cash out, Settle and Claim through web's `useLeverageWrites`.
 */
export function BoostRow({ position, symbol, decimals, nowMs, writes, first }: Props) {
  const { bets } = LEVERAGE;
  const market = useMarket(position.marketId);
  const live = position.status === "live";
  const markReading = useLeverageMark(live ? position.positionId : null);
  const info = market && isOk(market) && market.value ? market.value : null;
  const mark = markReading && isOk(markReading) ? markReading.value : null;
  const settling = live && info && nowMs > 0 ? countdown(nowMs, position.expirySec, info.intervalSec).settling : false;
  const priced = mark !== null && mark.filledRaw >= position.quantityRaw;
  const equity = mark ? equityOf(mark.markBase, position.frontedBase) : null;
  const minProceeds = mark ? (mark.markBase * CASH_OUT_FLOOR_BPS) / 10_000n : 0n;
  const isOwner = writes.address === position.owner;
  const { busy, canSign } = writes;
  const id = position.positionId;
  const left = info ? clockLeft(position.expirySec, info.intervalSec, nowMs) : null;

  return (
    <BetsRow first={first}>
      <Status word={!live ? settledLabel(position) : settling ? PORTFOLIO.settling : PORTFOLIO.live} dot={live && !settling ? "accent" : null} />
      <Call marketId={position.marketId} asset={info?.asset ?? null} text={`${info?.asset ?? "…"} ${SIDE_WORD[position.side]}`} />
      {info ? <Micro>{formatCadence(info.intervalSec)}</Micro> : null}
      <Micro tone="accent">{bets.boosted(Math.round(position.leverageBps / 1_000) / 10)}</Micro>
      {live && !settling && left ? (
        <Caption>
          {left} {PORTFOLIO.left}
        </Caption>
      ) : null}
      <Break />
      <Caption>
        {bets.staked} <MoneyText value={position.stakeBase} decimals={decimals} symbol={symbol} />
      </Caption>
      {live ? (
        <>
          {priced && equity !== null ? (
            <Caption>
              {bets.yours} <MoneyText value={equity} decimals={decimals} symbol={symbol} />
            </Caption>
          ) : (
            <Caption tone="muted">{bets.unpriced}</Caption>
          )}
          {mark && position.frontedBase > 0n ? <Caption tone={mark.knockable ? "warning" : "muted"}>{mark.knockable ? bets.knockable : bets.line(formatBaseUnits(mark.lineBase, decimals))}</Caption> : null}
          {settling
            ? canSign && <TextAction label={busy === `settle:${id}` ? bets.settling : bets.settle} disabled={busy === `settle:${id}`} onPress={() => void writes.settle(id, position.marketId)} />
            : isOwner &&
              canSign &&
              priced && (
                <TextAction
                  label={busy === `close:${id}` ? bets.cashingOut : bets.cashOut}
                  disabled={busy === `close:${id}`}
                  onPress={() => void writes.close(id, position.marketId, minProceeds, decimals, symbol ?? "")}
                />
              )}
        </>
      ) : position.owedBase > 0n ? (
        <>
          <Caption>{bets.waiting(formatBaseUnits(position.owedBase, decimals), symbol ?? "")}</Caption>
          {isOwner && canSign ? (
            <TextAction
              label={busy === `claim:${id}` ? bets.claiming : bets.claim}
              disabled={busy === `claim:${id}`}
              onPress={() => void writes.claim(id, position.marketId, position.owedBase, decimals, symbol ?? "")}
            />
          ) : null}
        </>
      ) : (
        <Caption>{position.returnedBase > 0n ? bets.paid(formatBaseUnits(position.returnedBase, decimals), symbol ?? "") : bets.nothingBack}</Caption>
      )}
    </BetsRow>
  );
}
