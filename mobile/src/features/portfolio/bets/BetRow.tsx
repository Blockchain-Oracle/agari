import { formatCadence } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { OpenPosition } from "@agari/core/types";
import { PORTFOLIO } from "@/lib/copy";
import { clockLeft, heldSide, sidesWord } from "../format";
import { CashOutLink } from "./CashOutLink";
import { BetsRow, Break, Call, Caption, Micro, MoneyText, Status } from "./RowParts";

/**
 * web `BetRow`: one open bet off the venue's cost basis and mark — live dot, the call, cadence, time left; then stake,
 * value, the unrealised result, and before lock the plain cash-out for a one-sided holding.
 */
export function BetRow({ position, symbol, nowMs, first }: { position: OpenPosition; symbol: string | undefined; nowMs: number; first?: boolean }) {
  const d = position.decimals;
  const settling = nowMs > 0 ? countdown(nowMs, position.expirySec, position.intervalSec).settling : false;
  const side = heldSide(position.balanceUpRaw, position.balanceDownRaw);
  const left = clockLeft(position.expirySec, position.intervalSec, nowMs);
  return (
    <BetsRow first={first}>
      <Status word={settling ? PORTFOLIO.settling : PORTFOLIO.live} dot={settling ? null : "accent"} />
      <Call marketId={position.marketId} asset={position.asset} text={`${position.asset} ${sidesWord(position.balanceUpRaw, position.balanceDownRaw)}`} />
      <Micro>{formatCadence(position.intervalSec)}</Micro>
      {!settling && left ? (
        <Caption>
          {left} {PORTFOLIO.left}
        </Caption>
      ) : null}
      <Break />
      <Caption>
        {PORTFOLIO.stake} <MoneyText value={position.costBasisBase} decimals={d} symbol={symbol} />
      </Caption>
      <Caption>
        {PORTFOLIO.value} <MoneyText value={position.markValueBase} decimals={d} />
      </Caption>
      <Caption>
        <MoneyText value={position.unrealizedPnlBase} decimals={d} pnl big />
      </Caption>
      {!settling && side ? (
        <CashOutLink
          marketId={position.marketId}
          side={side}
          heldRaw={side === "up" ? position.balanceUpRaw : position.balanceDownRaw}
          decimals={d}
          symbol={symbol}
        />
      ) : null}
    </BetsRow>
  );
}

