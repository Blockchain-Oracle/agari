import type { Reading } from "@masayume/core/schemas";
import type { Address, BalanceSheet, VenueCredit } from "@masayume/core/types";
import { oneUnit, ownTermsPriceRaw } from "@masayume/core/units";
import type { Portfolio, VaultPayoutFallback } from "@somnia-chain/markets-sdk";
import { getCollateral } from "../collateral";
import { getClient, getVaultDeployment } from "../runtime/read-runtime";
import { getVaultSnapshot } from "../vault/read";
import { bigintOrZero, lowerAddress } from "../mappers/scalars";
import { isBuy } from "../mappers/side";
import { withReading } from "./reading";

const ORDERS_LIMIT = 200;
const FALLBACKS_LIMIT = 50;
const MAX_CREDIT_POOLS = 10;

/** Buys escrow collateral at placement: remaining quantity × own-terms price. Prices index in YES terms (canon #20). */
function orderEscrow(portfolio: Portfolio, decimals: number): bigint {
  const one = oneUnit(decimals);
  return portfolio.openOrders
    .filter((order) => isBuy(order.side))
    .reduce((sum, order) => {
      const yesPrice = bigintOrZero(order.price);
      const price = ownTermsPriceRaw(yesPrice, order.side === "BUY_YES" ? "up" : "down", decimals);
      return sum + (bigintOrZero(order.quantityRemaining) * price) / one;
    }, 0n);
}

/** `fallback.market` is the bytes32 market id (the indexer PK), never an address; pools dedupe before the cap. */
async function poolsWithCredits(portfolio: Portfolio, fallbacks: readonly VaultPayoutFallback[]): Promise<Address[]> {
  const client = getClient();
  const marketIds = [...new Set(fallbacks.map((fallback) => fallback.market))];
  const markets = await Promise.all(marketIds.map((id) => client.getBinaryMarket(id)));
  const pools = new Set<Address>(portfolio.positions.map((p) => lowerAddress(p.market.poolAddress)));
  for (const market of markets) if (market) pools.add(lowerAddress(market.poolAddress));
  return [...pools].slice(0, MAX_CREDIT_POOLS);
}

async function venueCredits(wallet: Address, token: Address, pools: readonly Address[]): Promise<VenueCredit[]> {
  const client = getClient();
  const amounts = await Promise.all(pools.map((pool) => client.getVaultBalance({ vault: pool, owner: wallet, token })));
  return pools.map((pool, i) => ({ pool, amountBase: amounts[i] ?? 0n })).filter((credit) => credit.amountBase > 0n);
}

/** Every pool of money labeled separately; nothing is silently summed (FR-5). The venue spends per-pool credit first on the next buy. */
export async function getBalanceSheet(wallet: Address): Promise<Reading<BalanceSheet>> {
  return withReading(`balances:${wallet}`, async (inner) => {
    const { address: collateral, decimals } = getCollateral();
    const client = getClient();
    const [spendableBase, nativeWei, portfolio, fallbacks] = await Promise.all([
      client.getErc20Balance(collateral, wallet),
      client.getNativeBalance(wallet),
      client.getPortfolio(wallet, { ordersLimit: ORDERS_LIMIT, tradesLimit: 0 }),
      client.getVaultPayoutFallbacks(wallet, { token: collateral, limit: FALLBACKS_LIMIT }),
    ]);
    const credits = await venueCredits(wallet, collateral, await poolsWithCredits(portfolio, fallbacks));
    const vault = getVaultDeployment() ? inner(await getVaultSnapshot(wallet)) : null;
    return {
      decimals,
      spendableBase,
      nativeWei,
      orderEscrowBase: orderEscrow(portfolio, decimals),
      venueCreditBase: credits.reduce((sum, c) => sum + c.amountBase, 0n),
      venueCreditByPool: credits,
      vaultBase: vault ? vault.account.availableBase : null,
    };
  });
}
