import { assetTicker, basketOf, isTickerSymbol, TICKERS, type Basket, type ShareToken } from "@agari/core/market";
import type { ComponentType } from "react";
import { AssetMarkSvg } from "@/components/icons/asset-marks/AssetMarkSvg";
import { cn } from "@/lib/utils";

/**
 * The disc that names the asset — on the hero head, the rail card, the reel, the word board, the games,
 * the marquee, the ticker hub, the Sensei cards and the portfolio rows.
 *
 * Yosuku's venue only ever lists BTC, so it types "₿" on Bitcoin orange. Lanes here come from whatever
 * the venue lists: a registry ticker gets its own mark on its own colour (D-085, amending D-011's
 * monogram-only rule), a share token wears its underlying's mark with the issuer's badge, and an asset
 * the registry does not know keeps the disc as it was, with its initial.
 *
 * A basket (S19, D-124) is a group of companies bet on together, so its disc is a cluster of its members'
 * marks: up to four in a two-by-two, and a "+N" cell on the basket's own colour when it holds more. A
 * surface Masayume never had, drawn in its tokens (D-081); the sizes live in `styles/icons.css`.
 */
type Mark = ComponentType<{ className?: string }>;

/** The badge a token lane wears over the stock's mark: xStocks' "x", Ondo's "on", PreStocks' "pre". */
export const TOKEN_BADGE: Record<ShareToken["issuer"], string> = { xstocks: "x", ondo: "on", prestocks: "pre" };

/** How many member marks a basket cluster shows before the last cell counts the rest. */
export const BASKET_CLUSTER_CELLS = 4;

/** The letter on the disc: the registry's monogram for a listed ticker, else the name's first letter. */
export function assetMonogram(asset: string): string {
  return isTickerSymbol(asset) ? TICKERS[asset].monogram : asset.slice(0, 1).toUpperCase();
}

/** The drawn mark for an asset the registry knows (its own, or its underlying's), else null. */
export function assetMark(asset: string): Mark | null {
  const found = assetTicker(asset);
  if (!found) return null;
  const { brand, monogram } = found.ticker;
  return function AssetMark({ className }) {
    return <AssetMarkSvg slug={brand.slug} monogram={monogram} className={className} />;
  };
}

/** The cells of a basket's cluster: the first members' marks, then one "+N" cell when more remain. */
export function basketClusterCells(basket: Basket): Array<{ kind: "member"; symbol: Basket["members"][number]["symbol"] } | { kind: "more"; count: number }> {
  const shown = basket.members.length > BASKET_CLUSTER_CELLS ? BASKET_CLUSTER_CELLS - 1 : basket.members.length;
  const cells: Array<{ kind: "member"; symbol: Basket["members"][number]["symbol"] } | { kind: "more"; count: number }> = basket.members.slice(0, shown).map((m) => ({ kind: "member", symbol: m.symbol }));
  if (basket.members.length > shown) cells.push({ kind: "more", count: basket.members.length - shown });
  return cells;
}

/** The members' marks clustered inside one disc; the "+N" cell wears the basket's colour and the count. */
export function BasketMark({ basket, className }: { basket: Basket; className?: string }) {
  const cells = basketClusterCells(basket);
  return (
    <span className={cn("basket-mark", className)} data-cells={cells.length} data-brand={basket.brand.slug}>
      {cells.map((cell) =>
        cell.kind === "member" ? (
          <AssetMarkSvg key={cell.symbol} slug={TICKERS[cell.symbol].brand.slug} monogram={TICKERS[cell.symbol].monogram} className="basket-mark-cell" />
        ) : (
          <span key="more" className={`basket-mark-cell basket-mark-more mark-${basket.brand.slug}-more`}>
            +{cell.count}
          </span>
        ),
      )}
    </span>
  );
}

interface AssetDiscProps {
  asset: string;
  /** The disc's own class at this call site — `mh-asset-badge`, `glyph`, `reel-badge`, `wq-btc`, `marquee-mark`… */
  className: string;
}

/**
 * The disc itself: the vector mark when the registry knows the asset (`has-mark` clears the disc's paint;
 * `data-xstock` hangs the token badge), the members' cluster for a basket, the initial otherwise.
 */
export function AssetDisc({ asset, className }: AssetDiscProps) {
  const basket = basketOf(asset);
  if (basket) {
    return (
      <span aria-hidden className={cn(className, "has-mark", "is-basket")} data-brand={basket.brand.slug}>
        <BasketMark basket={basket} className="asset-mark" />
      </span>
    );
  }
  const found = assetTicker(asset);
  if (!found) {
    return (
      <span aria-hidden className={cn(className, "generic")}>
        <span>{assetMonogram(asset)}</span>
      </span>
    );
  }
  const { brand, monogram } = found.ticker;
  return (
    <span aria-hidden className={cn(className, "has-mark")} data-brand={brand.slug} data-xstock={found.token ? TOKEN_BADGE[found.token] : undefined}>
      <AssetMarkSvg slug={brand.slug} monogram={monogram} className="asset-mark" />
    </span>
  );
}
