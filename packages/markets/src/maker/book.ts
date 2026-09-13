import type { Address } from "@masayume/core/types";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { getClient } from "../runtime/read-runtime";

/** The two pool reads a maker needs: the top of each side, and the grid every order must sit on. */
const poolAbi = [
  {
    type: "function",
    name: "getBookLevels",
    stateMutability: "view",
    inputs: [{ type: "bool", name: "isBid" }, { type: "uint64", name: "numLevels" }],
    outputs: [{ type: "tuple[]", components: [{ type: "uint256", name: "price" }, { type: "uint256", name: "quantity" }] }],
  },
  {
    type: "function",
    name: "getOrderBookParameters",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "tuple", components: [{ type: "uint256", name: "tickSize" }, { type: "uint256", name: "minQuantity" }, { type: "uint256", name: "lotSize" }] }],
  },
] as const;

export interface PoolTop {
  bestBidRaw: bigint | null;
  bestAskRaw: bigint | null;
  bidDepthRaw: bigint;
  askDepthRaw: bigint;
  tickRaw: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
}

/** One multicall: the best level a side, the depth over the first levels, and the grid. */
export async function readPoolTop(pool: Address, levels = 5): Promise<PoolTop> {
  const client = getClient().getViemClient() as PublicClient;
  const contract = { address: pool, abi: poolAbi } as const;
  const [asks, bids, grid] = await client.multicall({
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: false,
    contracts: [
      { ...contract, functionName: "getBookLevels", args: [false, BigInt(levels)] },
      { ...contract, functionName: "getBookLevels", args: [true, BigInt(levels)] },
      { ...contract, functionName: "getOrderBookParameters" },
    ],
  });
  const depth = (side: readonly { price: bigint; quantity: bigint }[]) => side.reduce((sum, level) => sum + level.quantity, 0n);
  return {
    bestBidRaw: bids[0]?.price ?? null,
    bestAskRaw: asks[0]?.price ?? null,
    bidDepthRaw: depth(bids),
    askDepthRaw: depth(asks),
    tickRaw: grid.tickSize,
    lotRaw: grid.lotSize,
    minQuantityRaw: grid.minQuantity,
  };
}
