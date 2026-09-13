"use client";

import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { TUsdcMark } from "@/components/icons/AssetMarks";
import { FUNDING } from "@/features/funding";
import { useBalancePlate } from "@/features/markets/balance";

const AMOUNT_DP = 2;

/**
 * The reference's balance pill (`Header.tsx` L296–316): one compact total of the user's money, and a
 * vermilion `+` that opens Add money. It sits LEFT of the address pill and never hides once connected —
 * funding is one tap away at every balance, which is the whole point of it being in the bar.
 *
 * "Never show a half-loaded sum": until the balance sheet has answered, the figure is an em dash, not a
 * zero. The sum is what a bet can actually be paid from — the wallet's spendable plus the Trading Balance —
 * as the reference sums its account and wallet; claimable credit is different money and is not in it.
 *
 * The coin is the collateral's own mark (the reference draws a generic `Coins` glyph; the owner asked for
 * the token's logo, 2026-09-04), in the same 14px slot.
 */
export function HeaderMoneyPill({ onOpen }: { onOpen: () => void }) {
  const balance = useBalancePlate();
  if (balance.kind !== "connected") return null;
  const sheet = balance.reading && isOk(balance.reading) ? balance.reading.value : null;
  const total = sheet ? sheet.spendableBase + (sheet.vaultBase ?? 0n) : null;
  const symbol = balance.symbol ?? "";

  return (
    <button type="button" onClick={onOpen} title={FUNDING.pill.title} aria-label={FUNDING.pill.aria} className="dusdc-pill" data-cursor="hover">
      <TUsdcMark className="dusdc-coin" />
      <span className={`dusdc-total${total === null ? " dusdc-total--dim" : ""}`}>{total === null || !sheet ? "—" : formatBaseUnits(total, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP })}</span>
      <span className="dusdc-unit">{symbol}</span>
      <span className="dusdc-plus" aria-hidden>
        {FUNDING.pill.plus}
      </span>
    </button>
  );
}
