"use client";

import type { ReserveKind } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { useState } from "react";
import { useVenue } from "../markets/useVenue";
import { HouseEarn } from "./HouseEarn";
import { MakerEarn } from "./MakerEarn";
import { ReserveTabs } from "./ReserveTabs";
import "../parlay/parlay-page.css";
import "./earn-page.css";

/**
 * `/earn` — one page per house reserve, under one hero.
 *
 * Agari has four places a wallet can be the house: the maker vault that quotes the venue's own books, and the
 * range, parlay and boost reserves that take the other side of a ticket outright. They keep the same books and
 * the same two liquidity instructions, so they are tabs rather than four pages (A-2b).
 */
export function EarnScreen() {
  const [tab, setTab] = useState<ReserveKind>("maker");
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const tabs = <ReserveTabs active={tab} onSelect={setTab} />;
  return (
    <div className="earn-page ea-page">
      {tab === "maker" ? <MakerEarn symbol={symbol} tabs={tabs} /> : <HouseEarn key={tab} kind={tab} symbol={symbol} tabs={tabs} />}
    </div>
  );
}
