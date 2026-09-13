"use client";

import { formatCadence, type BlockerContext } from "@masayume/core/copy";
import type { Side } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { SIDE_WORD } from "../markets/side-styles";
import { PRIVATE } from "./copy";
import type { PrivateTicketState } from "./usePrivateTicket";
import "./private-ticket.css";

interface PartProps {
  priv: PrivateTicketState;
  side: Side | null;
  stakeBase: bigint;
  decimals: number;
  symbol: string;
}

/**
 * The reference's line under the control (`Ticket624Drawer.tsx` L1221–1247): the one case worth
 * interrupting for is Private chosen with nothing behind it, so the bet WILL refuse — said here, before a
 * signature. An allowance that ran short gets its own line, because the fix is a re-allow and not a deposit.
 * Otherwise one quiet line, and the honest one-liner under it.
 */
export function PrivateNote({ priv, stakeBase, decimals, symbol }: Omit<PartProps, "side">) {
  const fmt = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const budget = priv.budget;
  const short = budget !== null && stakeBase > 0n && priv.depositShortBase > 0n;
  const busy = priv.busy !== null;
  if (priv.pending) {
    return (
      <div className="flex flex-col gap-1">
        <p className="tk-priv-line">{PRIVATE.note.pending(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`)}</p>
        <p className="tk-lev-note">{PRIVATE.note.honesty}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {short ? (
        <div className="tk-priv-box">
          <span className="tk-priv-box-text">{budget.balanceBase > 0n ? PRIVATE.note.balance(fmt(budget.balanceBase)) : PRIVATE.note.empty}</span>
          <button type="button" onClick={() => void priv.fund()} disabled={busy || priv.topUpBase === 0n} className="tk-priv-box-action" data-cursor="hover">
            {priv.busy === "fund" ? PRIVATE.note.adding : PRIVATE.note.addFunds}
          </button>
        </div>
      ) : priv.reallowOnly && budget ? (
        <div className="tk-priv-box">
          <span className="tk-priv-box-text">{PRIVATE.note.reallow(fmt(budget.balanceBase), fmt(budget.allowanceBase))}</span>
          <button type="button" onClick={() => void priv.fund()} disabled={busy} className="tk-priv-box-action" data-cursor="hover">
            {priv.busy === "fund" ? PRIVATE.note.adding : PRIVATE.note.reallowAction}
          </button>
        </div>
      ) : (
        <p className="tk-priv-line">{PRIVATE.note.always}</p>
      )}
      <p className="tk-lev-note">{PRIVATE.note.honesty}</p>
      {(short || priv.reallowOnly) && <p className="tk-lev-note">{PRIVATE.note.signatures}</p>}
    </div>
  );
}

/** The 52px CTA: "Buy UP privately for X", or the top-up / re-allow and the bet as one action, or the resume of a lost reply; blocked, its label is the blocker. */
export function PrivateCta({ priv, side, decimals, symbol, ctx }: PartProps & { ctx: BlockerContext }) {
  const q = priv.quote;
  const label = (() => {
    if (priv.pending) return PRIVATE.cta.resume(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`);
    if (!side || !q) return null;
    if (priv.depositShortBase > 0n) return PRIVATE.cta.fundAndBuy(`${formatBaseUnits(priv.topUpBase, decimals)} ${symbol}`, SIDE_WORD[side]);
    if (priv.reallowOnly) return PRIVATE.cta.reallowAndBuy(SIDE_WORD[side]);
    return null;
  })();
  return (
    <BlockedButton blocker={priv.blocker} ctx={{ ...ctx, ...priv.ctx }} tone={side ?? "primary"} size="lg" className="w-full" onClick={() => void priv.place()}>
      {label ?? (side && q ? (
        <>
          {PRIVATE.cta.buy(SIDE_WORD[side])} <Money value={q.costBase} decimals={decimals} symbol={symbol} />
        </>
      ) : (
        PRIVATE.cta.buyPlain
      ))}
    </BlockedButton>
  );
}
