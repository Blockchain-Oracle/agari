import { z } from "zod";
import { isAddress, type Address } from "./primitives";

declare const marketIdBrand: unique symbol;

/**
 * A Window's identity everywhere off-chain: the address of its `Market` PDA
 * (`["market", series, index]` in agari-events). Never the recycled Book account (NFR-3).
 */
export type MarketId = Address & { readonly [marketIdBrand]: true };

export const isMarketId = (v: unknown): v is MarketId => isAddress(v);

export function toMarketId(value: string): MarketId {
  if (!isMarketId(value)) throw new Error(`not a market id (base58 Market address): ${value}`);
  return value;
}

export const marketIdSchema = z.custom<MarketId>(isMarketId, "expected a base58 Market address");
