/** MarketMakerVault (Earn) on Solana is `agari-maker` (S8). Until deployed: empty reads; the book top needs the engine (S4). */
import type { MakerDeployment, MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { notDeployedError } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** The best level a side, the depth over the first levels, and the grid, in raw units. */
export interface PoolTop {
  bestBidRaw: bigint | null;
  bestAskRaw: bigint | null;
  bidDepthRaw: bigint;
  askDepthRaw: bigint;
  tickRaw: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
}

export const resolveMakerDeployment = (_env?: Partial<MarketsEnv>): MakerDeployment | null => null;
export const getMakerVaultState = (): Promise<Reading<MakerVaultState | null>> => absent(null);
export const listMakerOpenWindows = (): Promise<Reading<MakerWindowView[]>> => absent([]);
export const listMakerHistory = (_limit = 20, _offset = 0): Promise<Reading<MakerWindowView[]>> => absent([]);
export const getMakerSharesOf = (_wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> => absent({ shares: 0n, worthBase: 0n });
export const getMakerUnsettledExpired = (): Promise<Reading<MarketId | null>> => absent(null);

/** The maker's view of one Window's Book (a plain promise: it throws the not-deployed reading until the engine exists). */
export async function readPoolTop(_book: Address, _levels = 5): Promise<PoolTop> {
  throw notDeployedError();
}
