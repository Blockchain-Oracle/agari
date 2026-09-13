import type { ComponentType } from "react";
import { BitcoinMark, EthereumMark } from "@/components/icons/AssetMarks";
import { cn } from "@/lib/utils";

/**
 * The disc that names the asset — on the hero head, the rail card, the reel and the word board.
 *
 * Yosuku's venue only ever lists BTC, so it types "₿" on Bitcoin orange. Lanes here come from whatever
 * the venue actually lists: an asset the reference drew (BTC, ETH) gets that drawing — the user's call
 * over the typed glyph — and one it did not gets its initial on the disc as it was, never another
 * asset's mark or colour.
 */
type Mark = ComponentType<{ className?: string }>;

const MARKS: Record<string, Mark> = { BTC: BitcoinMark, ETH: EthereumMark };

export function assetMark(asset: string): Mark | null {
  return MARKS[asset.toUpperCase()] ?? null;
}

interface AssetDiscProps {
  asset: string;
  /** The disc's own class at this call site — `mh-asset-badge`, `glyph`, `reel-badge`, `wq-btc`. */
  className: string;
}

/** The disc itself: the vector mark when there is one (`has-mark` clears the disc's paint), the initial otherwise. */
export function AssetDisc({ asset, className }: AssetDiscProps) {
  const Mark = assetMark(asset);
  return (
    <span aria-hidden className={cn(className, Mark ? "has-mark" : "generic")}>
      {Mark ? <Mark className="asset-mark" /> : <span>{asset.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}
