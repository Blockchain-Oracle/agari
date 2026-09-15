import { assetTicker, isTickerSymbol, TICKERS, type ShareToken } from "@agari/core/market";
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
 */
type Mark = ComponentType<{ className?: string }>;

/** The badge a token lane wears over the stock's mark: xStocks' "x", Ondo's "on". */
export const TOKEN_BADGE: Record<ShareToken["issuer"], string> = { xstocks: "x", ondo: "on" };

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

interface AssetDiscProps {
  asset: string;
  /** The disc's own class at this call site — `mh-asset-badge`, `glyph`, `reel-badge`, `wq-btc`, `marquee-mark`… */
  className: string;
}

/**
 * The disc itself: the vector mark when the registry knows the asset (`has-mark` clears the disc's paint;
 * `data-xstock` hangs the token badge), the initial otherwise.
 */
export function AssetDisc({ asset, className }: AssetDiscProps) {
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
