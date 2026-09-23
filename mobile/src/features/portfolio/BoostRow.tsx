import { formatCadence } from "@agari/core/copy";
import { equityOf, type LeveragePosition } from "@agari/core/leverage";
import { countdown } from "@agari/core/lifecycle";
import type { TxIntent } from "@agari/core/ports";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { invalidateAfterWrite, useLeverageMark, useMarket, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LEVERAGE } from "@/features/leverage/copy";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PORTFOLIO } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, type QuoteLine } from "~/components/kit";
import { BetLine, type Figure } from "./BetLine";
import { clockLeft, money } from "./format";
import { SignSheet } from "./SignSheet";
import { fromTx, useSignFlow } from "./useSignFlow";

/** web `LeverageBetRow`: the owner's own slippage guard on a cash-out, 97 % of the mark. */
const CASH_OUT_FLOOR_BPS = 9_700n;

type Act = "close" | "settle" | "claim";

function settledLabel(p: LeveragePosition): string {
  if (p.status === "knocked-out") return LEVERAGE.bets.knockedOut;
  if (p.status === "closed") return LEVERAGE.bets.closed;
  if (p.returnedBase === 0n) return LEVERAGE.bets.lost;
  return p.returnedBase > p.stakeBase ? LEVERAGE.bets.won : LEVERAGE.bets.settled;
}

/**
 * web `LeverageBetRow`: one boost the reserve holds — the multiple, the stake, the owner's equity at the Book's mark
 * and the knock-out line while live; what came back once settled, knocked out or cashed out. Cash out, Settle and Claim
 * send web's own `leverage-close` / `leverage-settle` / `leverage-claim` intents after a SignSheet review.
 */
export function BoostRow({ position, symbol, decimals, nowMs }: { position: LeveragePosition; symbol: string | undefined; decimals: number; nowMs: number }) {
  const { address } = useWalletSession();
  const submitter = useSubmitter();
  const queryClient = useQueryClient();
  const market = useMarket(position.marketId);
  const live = position.status === "live";
  const mark = useLeverageMark(live ? position.positionId : null);
  const flow = useSignFlow();
  const [act, setAct] = useState<Act | null>(null);

  const info = market && isOk(market) && market.value ? market.value : null;
  const markValue = mark && isOk(mark) ? mark.value : null;
  const settling = live && info && nowMs > 0 ? countdown(nowMs, position.expirySec, info.intervalSec).settling : false;
  const priced = markValue !== null && markValue.filledRaw >= position.quantityRaw;
  const equity = markValue ? equityOf(markValue.markBase, position.frontedBase) : null;
  const minProceeds = markValue ? (markValue.markBase * CASH_OUT_FLOOR_BPS) / 10_000n : 0n;
  const isOwner = address === position.owner;
  const canSign = submitter !== null && address !== null;
  const m = (base: bigint) => money(base, decimals, symbol);
  const multiple = Math.round(position.leverageBps / 1_000) / 10;
  const left = info ? clockLeft(position.expirySec, info.intervalSec, nowMs) : null;

  const figures: Figure[] = [{ label: LEVERAGE.bets.staked, value: m(position.stakeBase) }];
  const notes: string[] = [];
  if (live) {
    if (priced && equity !== null) figures.push({ label: LEVERAGE.bets.yours, value: m(equity), tone: "accent" });
    else notes.push(LEVERAGE.bets.unpriced);
    if (markValue && position.frontedBase > 0n) notes.push(markValue.knockable ? LEVERAGE.bets.knockable : LEVERAGE.bets.line(formatBaseUnits(markValue.lineBase, decimals)));
  } else if (position.owedBase > 0n) {
    notes.push(LEVERAGE.bets.waiting(formatBaseUnits(position.owedBase, decimals), symbol ?? ""));
  } else {
    notes.push(position.returnedBase > 0n ? LEVERAGE.bets.paid(formatBaseUnits(position.returnedBase, decimals), symbol ?? "") : LEVERAGE.bets.nothingBack);
  }

  const ask = (next: Act) => {
    setAct(next);
    flow.start();
  };
  const review = reviewOf(act, position, m, minProceeds, equity);
  const confirm = () => {
    if (!act || !submitter || !address) return;
    const intent: TxIntent =
      act === "close" ? { kind: "leverage-close", positionId: position.positionId, marketId: position.marketId, minProceedsBase: minProceeds }
      : act === "settle" ? { kind: "leverage-settle", positionId: position.positionId, marketId: position.marketId }
      : { kind: "leverage-claim", positionId: position.positionId };
    void flow.run(async () => {
      const outcome = await submitter.submitTx(intent);
      await invalidateAfterWrite(queryClient, { wallet: address, marketId: position.marketId });
      return fromTx(outcome, review.landed);
    });
  };

  let action = null;
  if (live && settling && canSign) action = <Button label={LEVERAGE.bets.settle} variant="outline" size="sm" block={false} onPress={() => ask("settle")} />;
  else if (live && !settling && isOwner && canSign && priced) action = <Button label={LEVERAGE.bets.cashOut} variant="outline" size="sm" block={false} onPress={() => ask("close")} />;
  else if (!live && position.owedBase > 0n && isOwner && canSign) action = <Button label={LEVERAGE.bets.claim} size="sm" block={false} onPress={() => ask("claim")} />;

  return (
    <>
      <BetLine
        status={!live ? settledLabel(position) : settling ? PORTFOLIO.settling : PORTFOLIO.live}
        live={live && !settling}
        asset={info?.asset ?? null}
        title={`${info?.asset ?? "…"} ${SIDE_WORD[position.side]}`}
        marketId={position.marketId}
        meta={[info ? formatCadence(info.intervalSec) : null, LEVERAGE.bets.boosted(multiple), live && !settling && left ? `${left} ${PORTFOLIO.left}` : null]}
        figures={figures}
        notes={notes}
        action={action}
      />
      <SignSheet visible={flow.open} onClose={flow.close} {...review} onConfirm={confirm} phase={flow.phase} outcome={flow.outcome} />
    </>
  );
}

function reviewOf(act: Act | null, p: LeveragePosition, m: (base: bigint) => string, minProceeds: bigint, equity: bigint | null): { title: string; lines: QuoteLine[]; maxLoss: string | null; confirmLabel: string; landed: string } {
  if (act === "close") {
    const atFloor = minProceeds > p.frontedBase ? minProceeds - p.frontedBase : 0n;
    return {
      title: `${LEVERAGE.bets.cashOut} · ${LEVERAGE.bets.boosted(Math.round(p.leverageBps / 1_000) / 10)}`,
      lines: [
        { label: LEVERAGE.bets.yours, value: equity === null ? "—" : m(equity), tone: "accent" },
        { label: "Sells for at least", value: m(minProceeds), hint: "97% of the mark; the reserve is repaid first" },
        { label: "Reserve repaid", value: m(p.frontedBase) },
        { label: LEVERAGE.bets.staked, value: m(p.stakeBase) },
      ],
      maxLoss: m(p.stakeBase > atFloor ? p.stakeBase - atFloor : 0n),
      confirmLabel: "Slide to cash out",
      landed: LEVERAGE.bets.cashedOut(m(minProceeds), ""),
    };
  }
  if (act === "settle") {
    return { title: LEVERAGE.bets.settle, lines: [{ label: LEVERAGE.bets.staked, value: m(p.stakeBase) }], maxLoss: m(0n), confirmLabel: "Slide to settle", landed: LEVERAGE.bets.settledToast };
  }
  return {
    title: LEVERAGE.bets.claim,
    lines: [{ label: "Paid to your wallet", value: m(p.owedBase), tone: "accent" }],
    maxLoss: m(0n),
    confirmLabel: "Slide to claim",
    landed: LEVERAGE.bets.claimedToast(m(p.owedBase), ""),
  };
}
