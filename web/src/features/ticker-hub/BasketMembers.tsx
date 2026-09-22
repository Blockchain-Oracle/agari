"use client";

import { TICKERS, type Basket } from "@agari/core/market";
import Link from "next/link";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { usdLine } from "@/features/markets/hero/units";
import { tickerHref } from "@/features/takes/cashtags";
import { TICKER_HUB } from "./copy";
import type { BasketMemberView } from "./usePreIpoFacts";

interface BasketMembersProps {
  basket: Basket;
  /** The members' prices and moves from the feed's row; null before it answers (weights still show). */
  members: readonly BasketMemberView[] | null;
  /** Members this wallet holds; null with no wallet connected (the column then reads "—"). */
  held: ReadonlySet<string> | null;
}

const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

/** The basket's members (S19 §5.2): each company, its weight, its token price, how far it sits from its base, and whether the wallet holds it. */
export function BasketMembers({ basket, members, held }: BasketMembersProps) {
  const T = TICKER_HUB.basket.table;
  return (
    <table className="tkh-members">
      <thead>
        <tr>
          <th scope="col">{T.member}</th>
          <th scope="col">{T.weight}</th>
          <th scope="col">{T.price}</th>
          <th scope="col">{T.sinceBase}</th>
          <th scope="col">{T.held}</th>
        </tr>
      </thead>
      <tbody>
        {basket.members.map((m) => {
          const row = members?.find((r) => r.symbol === m.symbol) ?? null;
          const move = row?.moveBps ?? null;
          const holds = held?.has(m.symbol) ?? null;
          return (
            <tr key={m.symbol}>
              <td>
                <span className="tkh-member">
                  <AssetDisc asset={m.symbol} className="tkh-member-mark" />
                  <span>
                    <span className="tkh-member-name">{TICKERS[m.symbol].name}</span>
                    <Link href={tickerHref(m.symbol)} className="tkh-member-tag" data-cursor="hover">
                      ${m.symbol}
                    </Link>
                  </span>
                </span>
              </td>
              <td className="numbers">{`${(m.weightBps / 100).toFixed(m.weightBps % 100 === 0 ? 0 : 1)}%`}</td>
              <td className="numbers">{row ? usdLine(row.tokenPriceE8) : TICKER_HUB.dash}</td>
              <td className={`numbers tkh-move ${move === null ? "" : move > 0 ? "up" : move < 0 ? "down" : ""}`}>{move === null ? TICKER_HUB.dash : signedPct(move)}</td>
              <td className={holds ? "tkh-held-yes" : ""}>{holds === null ? TICKER_HUB.dash : holds ? T.yes : T.no}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
