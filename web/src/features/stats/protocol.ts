import type { Address, Hex, MarketId } from "@masayume/core/types";
import { z } from "zod";

/** Wire shape of the traction slice — base units travel as decimal strings, never floats. */
const callSchema = z.object({
  id: z.string(),
  wallet: z.string(),
  kind: z.enum(["call", "cash-out"]),
  side: z.enum(["up", "down"]),
  asset: z.string(),
  marketId: z.string(),
  stakeBase: z.string(),
  txHash: z.string(),
  atMs: z.number(),
});

export const tractionSchema = z.object({
  wallets: z.number(),
  calls: z.number(),
  cashOuts: z.number(),
  stakedBase: z.string(),
  unattributed: z.number(),
  windows: z.number(),
  settledWindows: z.number(),
  curve: z.array(z.object({ atMs: z.number(), cumulative: z.number() })),
  recent: z.array(callSchema),
});

export const tractionMetaSchema = z.object({
  period: z.literal("24h"),
  windowStartMs: z.number(),
  windowEndMs: z.number(),
  computedAtMs: z.number(),
  /** False when a paging cap or a dropped page means the window is not fully covered — every count is then a floor. */
  complete: z.boolean(),
  decimals: z.number(),
  symbol: z.string(),
});

export const tractionPayloadSchema = z.object({ traction: tractionSchema, meta: tractionMetaSchema });

export type TractionPayload = z.infer<typeof tractionPayloadSchema>;

export interface TractionEvent {
  id: string;
  wallet: Address;
  kind: "call" | "cash-out";
  side: "up" | "down";
  asset: string;
  marketId: MarketId;
  stakeBase: bigint;
  txHash: Hex;
  atMs: number;
}

export interface TractionData {
  wallets: number;
  calls: number;
  cashOuts: number;
  stakedBase: bigint;
  unattributed: number;
  windows: number;
  settledWindows: number;
  curve: { atMs: number; cumulative: number }[];
  recent: TractionEvent[];
  meta: TractionPayload["meta"];
}

export function toTractionData(payload: TractionPayload): TractionData {
  const { traction, meta } = payload;
  return {
    ...traction,
    stakedBase: BigInt(traction.stakedBase),
    recent: traction.recent.map((event) => ({ ...event, wallet: event.wallet as Address, marketId: event.marketId as MarketId, txHash: event.txHash as Hex, stakeBase: BigInt(event.stakeBase) })),
    meta,
  };
}
