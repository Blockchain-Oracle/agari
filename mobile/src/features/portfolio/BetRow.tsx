import { estPayoutBase } from "@agari/core/claims";
import { formatCadence } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { OpenPosition } from "@agari/core/types";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PORTFOLIO, TICKET } from "@/lib/copy";
import { BetLine, type Figure } from "./BetLine";
import { CashOutButton } from "./CashOutButton";
import { clockLeft, heldSide, money, pnlTone, signedMoney, sidesWord } from "./format";

interface Props {
  position: OpenPosition;
  symbol: string | undefined;
  /** Chain-corrected clock; 0 before the first tick. */
  nowMs: number;
}

/**
 * web `BetRow`: one open bet off the venue's `getOpenPositionsWithPnL` — what it cost, what the Book marks it at now,
 * what it pays if the call lands (one contract pays one unit on a win, `estPayoutBase`), the unrealised result, and
 * before lock the plain cash-out for a one-sided holding.
 */
export function BetRow({ position, symbol, nowMs }: Props) {
  const d = position.decimals;
  const state = nowMs > 0 ? countdown(nowMs, position.expirySec, position.intervalSec) : null;
  const settling = state?.settling ?? false;
  const side = heldSide(position.balanceUpRaw, position.balanceDownRaw);
  const left = clockLeft(position.expirySec, position.intervalSec, nowMs);
  const cadence = formatCadence(position.intervalSec);

  const figures: Figure[] = [
    { label: PORTFOLIO.stake, value: money(position.costBasisBase, d, symbol) },
    { label: PORTFOLIO.value, value: money(position.markValueBase, d, symbol) },
  ];
  if (position.balanceUpRaw > 0n) figures.push({ label: TICKET.payoutIfRight(SIDE_WORD.up), value: money(estPayoutBase(position.balanceUpRaw, "win"), d, symbol), tone: "accent" });
  if (position.balanceDownRaw > 0n) figures.push({ label: TICKET.payoutIfRight(SIDE_WORD.down), value: money(estPayoutBase(position.balanceDownRaw, "win"), d, symbol), tone: "accent" });
  figures.push({ label: "Unrealised", value: signedMoney(position.unrealizedPnlBase, d, symbol), tone: pnlTone(position.unrealizedPnlBase) });

  return (
    <BetLine
      status={settling ? PORTFOLIO.settling : PORTFOLIO.live}
      live={!settling}
      asset={position.asset}
      title={`${position.asset} ${sidesWord(position.balanceUpRaw, position.balanceDownRaw)}`}
      marketId={position.marketId}
      meta={[cadence, !settling && left ? `${left} ${PORTFOLIO.left}` : null]}
      figures={figures}
      action={
        !settling && side ? (
          <CashOutButton
            marketId={position.marketId}
            side={side}
            heldRaw={side === "up" ? position.balanceUpRaw : position.balanceDownRaw}
            decimals={d}
            symbol={symbol}
            costBase={position.costBasisBase}
            windowLabel={`${position.asset} · ${cadence}`}
          />
        ) : null
      }
    />
  );
}
