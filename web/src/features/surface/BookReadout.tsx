"use client";

import { phase } from "@masayume/core/lifecycle";
import { neededMove } from "@masayume/core/market";
import type { BookStructure } from "@masayume/core/surface";
import type { EventMarket } from "@masayume/core/types";
import { bpsToOddsCents } from "@masayume/core/units";
import type { ReactNode } from "react";
import { Countdown } from "@/components/data";
import { HERO } from "@/lib/copy";
import { oraclePriceText } from "../markets/hero/OraclePrice";
import { SIDE_WORD } from "../markets/side-styles";
import { SURFACE } from "./copy";
import { centsText, pctOfText } from "./format";

interface BookReadoutProps {
  market: EventMarket;
  /** Null while the book is hydrating or after a failed first read. */
  structure: BookStructure | null;
  hydrating: boolean;
  openingRaw: bigint | null;
  spotRaw: bigint | null;
  nowMs: number;
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode; index: number }) {
  return (
    <div className="sf-tile">
      <div className="sf-tile-k">{label}</div>
      <div className="sf-tile-v">{value}</div>
      <div className="sf-tile-sub">{sub}</div>
    </div>
  );
}

const price = (bps: number) => `${bpsToOddsCents(bps)}¢`;

function OpeningTile({ openingRaw, spotRaw }: { openingRaw: bigint | null; spotRaw: bigint | null }) {
  const { tiles } = SURFACE;
  let sub: string = tiles.noSpot;
  if (openingRaw !== null && spotRaw !== null) {
    const move = neededMove(spotRaw, openingRaw);
    sub = `${tiles.spot(oraclePriceText(spotRaw))} · ${tiles.leading(SIDE_WORD[move.leading])}`;
  } else if (spotRaw !== null) {
    sub = tiles.spot(oraclePriceText(spotRaw));
  }
  return <Tile index={0} label={tiles.opening} value={openingRaw === null ? <span className="sf-tile-pending">{tiles.pendingPrint}</span> : oraclePriceText(openingRaw)} sub={sub} />;
}

function UpTile({ structure, hydrating }: { structure: BookStructure | null; hydrating: boolean }) {
  const { tiles } = SURFACE;
  if (!structure) return <Tile index={1} label={tiles.up.none} value={hydrating ? tiles.hydrating : "—"} sub={hydrating ? SURFACE.reading : tiles.empty} />;
  const { upAskBps: ask, upBidBps: bid, midBps: mid } = structure;
  if (mid !== null && ask !== null && bid !== null) return <Tile index={1} label={tiles.up.mid} value={price(mid)} sub={tiles.bidAsk(price(bid), price(ask))} />;
  if (structure.crossed && ask !== null && bid !== null) return <Tile index={1} label={tiles.up.ask} value={price(ask)} sub={tiles.crossedUp(price(bid), price(ask))} />;
  if (ask !== null) return <Tile index={1} label={tiles.up.ask} value={price(ask)} sub={tiles.noBids(price(ask))} />;
  if (bid !== null) return <Tile index={1} label={tiles.up.bid} value={price(bid)} sub={tiles.noAsks(price(bid))} />;
  return <Tile index={1} label={tiles.up.none} value="—" sub={tiles.empty} />;
}

function SpreadTile({ structure, hydrating }: { structure: BookStructure | null; hydrating: boolean }) {
  const { tiles } = SURFACE;
  if (!structure) return <Tile index={2} label={tiles.spread} value={hydrating ? tiles.hydrating : "—"} sub={hydrating ? SURFACE.reading : tiles.empty} />;
  if (structure.crossed) return <Tile index={2} label={tiles.spread} value={<span className="sf-tile-word">{tiles.crossed}</span>} sub={tiles.crossedWhy} />;
  if (structure.spreadBps === null || structure.midBps === null) {
    return <Tile index={2} label={tiles.spread} value="—" sub={structure.levels === 0 ? tiles.empty : tiles.oneSided} />;
  }
  return <Tile index={2} label={tiles.spread} value={centsText(structure.spreadBps)} sub={tiles.spreadOfMid(pctOfText(structure.spreadBps, structure.midBps))} />;
}

/**
 * §01 — the reference's four readout tiles (`Forward · ATM implied vol · Time to expiry · Live markets`,
 * `SurfacePage` L253–270) with the venue's real figures in their places: the opening print is the
 * level everything is measured against, the UP mid is the price, the spread is the cost of the
 * round trip, and the countdown is the clock. Each tile's second line says where its number comes from.
 */
export function BookReadout({ market, structure, hydrating, openingRaw, spotRaw, nowMs }: BookReadoutProps) {
  const { tiles } = SURFACE;
  const word = nowMs > 0 ? HERO.phase[phase(market, nowMs)] : "";
  return (
    <div className="sf-tiles">
      <OpeningTile openingRaw={openingRaw} spotRaw={spotRaw} />
      <UpTile structure={structure} hydrating={hydrating} />
      <SpreadTile structure={structure} hydrating={hydrating} />
      <Tile index={3} label={tiles.close} value={<Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />} sub={word} />
    </div>
  );
}
