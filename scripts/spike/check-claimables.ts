import { toMarketId, type Address } from "@masayume/core";
import { bootMarkets, marketsProvider } from "@masayume/markets";
import { runSpike } from "./lib/boot";

const WALLET: Address = "0xd357019E2c55375477802A047dB7bC1A77819358";

const json = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

/** Read-only check of the wallet-scoped money reads: an empty wallet must yield ok readings with empty rows, never a throw. */
await runSpike(async ({ env, client }) => {
  const boot = await bootMarkets(env);
  console.log("boot:", boot.ok ? `ok · venue ${boot.value.venue.venueId} (${boot.value.venue.source})` : json(boot.error));
  const venueId = boot.ok ? (boot.value.venue.venueId ?? env.venueId) : env.venueId;

  const [claimables, balances] = await Promise.all([marketsProvider.listClaimables(WALLET, venueId), marketsProvider.getBalanceSheet(WALLET)]);
  console.log("claimables:", json(claimables));
  console.log("balances:", json(balances));

  const [live] = await client.listLiveBinaryMarkets({ venueId, limit: 1 });
  if (live) console.log("fee (live market):", json(await marketsProvider.settlementFeeBps(toMarketId(live.marketId))));
});
