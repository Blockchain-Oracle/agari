import { toMarketId } from "@masayume/core/types";
import { closeRuntime, configureMarkets, listVaultTallies, loadCollateral, marketsProvider, parseMarketsEnv, tallyToLedger, toRoundMarket, unwrap, vaultRound } from "@masayume/markets";
import { getClient } from "@masayume/markets/runtime";

/** Read-only half of vault-fork.ts: the snapshot, holdings, the tally-based history and the balance sheet for OWNER. */
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const env = parseMarketsEnv({
  rpcHttpUrls: process.env.RPC_HTTP_URLS ?? "http://127.0.0.1:8546",
  rpcWsUrls: process.env.RPC_WS_URLS ?? "ws://127.0.0.1:8546",
  eventVaultAddress: process.env.EVENT_VAULT_ADDRESS,
  forwarderAddress: process.env.FORWARDER_ADDRESS,
  eventVaultFromBlock: process.env.EVENT_VAULT_FROM_BLOCK ?? "0",
});
configureMarkets(env);
try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const owner = process.env.OWNER as `0x${string}`;
  const marketId = toMarketId(process.env.FORK_MARKET_ID as string);
  const onchain = unwrap(await marketsProvider.getOnchain(marketId));
  console.log("snapshot", json(unwrap(await marketsProvider.getVaultSnapshot(owner))));
  console.log("holdings", json(unwrap(await marketsProvider.getVaultHoldings(owner, onchain))));
  const sheet = unwrap(await marketsProvider.getBalanceSheet(owner));
  console.log("sheet", json({ spendable: sheet.spendableBase, vault: sheet.vaultBase, credit: sheet.venueCreditBase }));
  // The vault seat on its own — the wallet seat needs the indexer, which can time out independently.
  const tallies = await listVaultTallies(owner);
  console.log("tallies", json(tallies));
  for (const t of tallies.tallies) {
    const row = await getClient().getBinaryMarket(t.marketId);
    const round = row ? vaultRound(t, toRoundMarket(row), 0) : null;
    console.log("vault round", json(round ? { source: round.source, outcome: round.outcome, stake: round.stakeBase, payout: round.payoutBase, pnl: round.pnlBase, claim: round.claim, fills: round.fillCount } : { open: tallyToLedger(t).heldUpRaw + tallyToLedger(t).heldDownRaw }));
  }
  const history = unwrap(await marketsProvider.listWalletHistory(owner));
  console.log("history", json({ openCount: history.openCount, fillCount: history.fillCount, complete: history.complete, rounds: history.rounds.map((r) => ({ source: r.source, outcome: r.outcome, stake: r.stakeBase, payout: r.payoutBase, claim: r.claim })) }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeRuntime();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
}
