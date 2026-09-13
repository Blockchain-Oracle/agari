"use client";

import type { BlockerContext, BlockerKind } from "@masayume/core/copy";
import type { Side } from "@masayume/core/types";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { TICKET } from "@/lib/copy";
import { SIDE_WORD } from "../side-styles";

interface TicketCtaProps {
  blocker: BlockerKind | null;
  ctx: BlockerContext;
  side: Side | null;
  /** The escrow the order locks — the most the bet can cost. */
  costBase: bigint | null;
  decimals: number;
  symbol: string;
  onClick: () => void;
}

/** The 52px CTA: armed it carries the side wash and the exact max cost; blocked, its label is the blocker (UX-DR4). */
export function TicketCta({ blocker, ctx, side, costBase, decimals, symbol, onClick }: TicketCtaProps) {
  return (
    <BlockedButton blocker={blocker} ctx={ctx} tone={side ?? "primary"} size="lg" className="w-full" onClick={onClick}>
      {side && costBase !== null ? (
        <>
          {TICKET.buy(SIDE_WORD[side])} <Money value={costBase} decimals={decimals} symbol={symbol} />
        </>
      ) : (
        TICKET.buyPlain
      )}
    </BlockedButton>
  );
}
