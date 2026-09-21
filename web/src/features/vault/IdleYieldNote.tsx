"use client";

import { oneUnit } from "@agari/core/units";
import { sharePriceRawOf } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { useLeverageReserve, useMakerVault, useParlayReserve, useRangeReserve } from "@agari/markets/react";
import Link from "next/link";
import { formatSharePrice } from "@/features/earn/format";
import { VAULT } from "./copy";

/** One reserve's share price, and how far it has actually moved from par. Nothing here is a rate or a forecast. */
interface Moved {
  label: string;
  price: string;
  since: string;
}

/**
 * A-2a: what idle collateral in the Trading Balance does, and does not, earn (Q-005's recorded answer).
 *
 * It earns nothing sitting here, and this says so. The lending markets that would pay for idle collateral —
 * Kamino, Jupiter Lend — do not run on the cluster this venue is deployed to, so no rate from them is shown or
 * implied. What does pay on this cluster is supplying a house reserve, and the only honest number for that is what
 * each reserve's share price has already done: money that moved, not money that might.
 */
export function IdleYieldNote({ idleBase, decimals }: { idleBase: bigint; decimals: number }) {
  const maker = useMakerVault();
  const range = useRangeReserve();
  const parlay = useParlayReserve();
  const boost = useLeverageReserve();
  const words = VAULT.idleYield;

  const one = oneUnit(decimals);
  const moved: Moved[] = [];
  const add = (label: string, sharePriceRaw: bigint | null) => {
    if (sharePriceRaw === null) return;
    const delta = sharePriceRaw - one;
    moved.push({
      label,
      price: formatSharePrice(sharePriceRaw, decimals),
      since: delta === 0n ? words.flat : delta > 0n ? words.up : words.down,
    });
  };
  if (maker && isOk(maker) && maker.value) add(words.maker, maker.value.sharePriceRaw);
  if (range && isOk(range) && range.value) add(words.range, sharePriceRawOf(range.value.totalValueBase, range.value.supplyShares, range.value.decimals));
  if (parlay && isOk(parlay) && parlay.value) add(words.parlay, sharePriceRawOf(parlay.value.totalValueBase, parlay.value.supplyShares, parlay.value.decimals));
  if (boost && isOk(boost) && boost.value) add(words.boost, sharePriceRawOf(boost.value.totalValueBase, boost.value.supplyShares, boost.value.decimals));

  return (
    <div className="vault-idle">
      <p className="vault-idle-head">{idleBase > 0n ? words.idle : words.empty}</p>
      <p className="vault-idle-body">{words.mainnetOnly}</p>
      {moved.length > 0 && (
        <>
          <p className="vault-idle-body">{words.hereInstead}</p>
          <dl className="vault-idle-rows">
            {moved.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <span className="numbers">{row.price}</span> {row.since}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <Link className="vault-idle-link" href="/earn" data-cursor="hover">
        {words.cta}
      </Link>
    </div>
  );
}
