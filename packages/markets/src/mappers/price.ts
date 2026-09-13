import type { AssetPrice, PricePoint } from "@masayume/core/types";
import type { LivePrice, PricePoint as FeedPoint } from "@somnia-chain/markets-sdk";
import { bigintOf, type Scalar } from "./scalars";

/** A malformed feed tick surfaces as an error arm, never as $0 (AD-6). */
function rawOrThrow(value: Scalar, field: string): bigint {
  const raw = bigintOf(value);
  if (raw === null) throw new Error(`price feed returned a malformed ${field}: ${String(value)}`);
  return raw;
}

/** The feed's float fields are for display only; we carry the raw 18-dp integers (AD-2). */
export function toAssetPrice(price: LivePrice): AssetPrice {
  return {
    asset: price.asset,
    priceRaw: rawOrThrow(price.raw.price, "price"),
    emaRaw: rawOrThrow(price.raw.ema, "ema"),
    decimals: price.decimals,
    blockTimestampSec: price.blockTimestamp,
  };
}

export function toPricePoint(point: FeedPoint): PricePoint {
  return {
    priceRaw: rawOrThrow(point.raw.price, "price"),
    emaRaw: rawOrThrow(point.raw.ema, "ema"),
    blockTimestampSec: point.blockTimestamp,
  };
}
