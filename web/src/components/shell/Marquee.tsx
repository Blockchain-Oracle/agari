"use client";

import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useMarqueeItems } from "./useMarqueeItems";

export default function Marquee() {
  const items = useMarqueeItems();

  const renderCells = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="marquee-cell">
        {item.asset && <AssetDisc asset={item.asset} className="marquee-mark" />}
        <span className="lbl">{item.label}</span>
        <span className="val">{item.value}</span>
        {item.direction && <span className={item.direction}>{item.tag ?? (item.direction === "up" ? "↑" : "↓")}</span>}
        {item.note && <span className="lbl">{item.note}</span>}
      </span>
    ));

  return (
    <div className="marquee">
      <div className="marquee-track">
        {renderCells("a")}
        {renderCells("b")}
        {renderCells("c")}
      </div>
    </div>
  );
}
