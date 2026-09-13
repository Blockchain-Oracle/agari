import { execSync } from "node:child_process";

import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import {
  closeRuntime,
  configureMarkets,
  createMemoryJournal,
  createSubmitterSession,
  loadCollateral,
  marketsProvider,
  parseMarketsEnv,
  unwrap,
} from "@masayume/markets";

/**
 * Drives the vault through the REAL adapter against a local Anvil fork of Shannon (RESUME.md §Stage 4):
 * faucet → deposit → an owner order from the Trading Balance → a STRATEGY grant → a delegated order →
 * warp + void → crank → history and balance sheet. Every step goes through the port's own lanes.
 *
 * Env: RPC_HTTP_URLS / RPC_WS_URLS (the fork), EVENT_VAULT_ADDRESS, FORWARDER_ADDRESS, FORK_MARKET_ID
 * (bytes32 or decimal), OWNER_KEY, ACTOR_KEY (funded fork keys; defaults to OWNER_KEY — the owner then grants
 * to itself and the grant route runs from the one session, one key one writer).
 * LIVE=1 runs against the real network: no time travel — the Window settles by the oracle and the crank waits for it.
 */
const LIVE = process.env.LIVE === "1";
const RPC = process.env.RPC_HTTP_URLS ?? (LIVE ? undefined : "http://127.0.0.1:8546");
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const rpc = (method: string, ...params: string[]) => execSync(`cast rpc ${method} ${params.join(" ")} --rpc-url ${RPC}`, { encoding: "utf8" }).trim();
const call = (to: string, sig: string) => execSync(`cast call ${to} "${sig}" --rpc-url ${RPC}`, { encoding: "utf8" }).trim();

function marketIdOf(raw: string) {
  return toMarketId(raw.startsWith("0x") ? raw : `0x${BigInt(raw).toString(16).padStart(64, "0")}`);
}

/** The soonest Trading Window with room for four writes before its no-entry buffer. */
async function pickLiveWindow() {
  const { resolveVenueId } = await import("@masayume/markets");
  const venue = unwrap(await resolveVenueId(env.venueId));
  if (!venue.venueId) throw new Error("no venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.venueId));
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const pick = lanes.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.status === "Trading" && m.expirySec - nowSec >= 240)
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!pick) throw new Error("no Trading Window with four minutes left");
  return pick.marketId;
}

function expectStatus<T extends { status: string }>(label: string, outcome: T, ...ok: string[]): T {
  if (!ok.includes(outcome.status)) throw new Error(`${label}: ${json(outcome)}`);
  console.log(`${label}: ${outcome.status}`);
  return outcome;
}

const env = parseMarketsEnv({
  rpcHttpUrls: RPC,
  rpcWsUrls: process.env.RPC_WS_URLS ?? (LIVE ? undefined : "ws://127.0.0.1:8546"),
  venueId: process.env.VENUE_ID,
  eventVaultAddress: process.env.EVENT_VAULT_ADDRESS,
  forwarderAddress: process.env.FORWARDER_ADDRESS,
  eventVaultFromBlock: process.env.EVENT_VAULT_FROM_BLOCK ?? "0",
});
configureMarkets(env);

try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const marketId = process.env.FORK_MARKET_ID ? marketIdOf(process.env.FORK_MARKET_ID) : await pickLiveWindow();
  const market = unwrap(await marketsProvider.getMarket(marketId));
  if (!market) throw new Error(`indexer has no row for ${marketId}`);
  const onchain = unwrap(await marketsProvider.getOnchain(marketId));
  console.log("window", marketId, market.asset, market.intervalSec, "onchain status", onchain.status);
  const one = oneUnit(market.decimals);

  const owner = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: process.env.OWNER_KEY as Hex }, journal: createMemoryJournal() });
  const actorKey = (process.env.ACTOR_KEY ?? process.env.OWNER_KEY) as Hex;
  const actor = actorKey === process.env.OWNER_KEY ? owner : await createSubmitterSession({ env, authority: "strategy-runner", signer: { privateKey: actorKey }, journal: createMemoryJournal() });
  console.log("owner", owner.address, "actor", actor.address);

  if (!process.env.SKIP_FAUCET) expectStatus("faucet", await owner.submitter.submitTx({ kind: "faucet", amountBase: 10_000n * one }), "confirmed");
  expectStatus("deposit", await owner.submitter.submitTx({ kind: "vault-deposit", amountBase: 2_000n * one }), "confirmed");
  const afterDeposit = unwrap(await marketsProvider.getVaultSnapshot(owner.address));
  console.log("snapshot after deposit", json(afterDeposit?.account));

  const target = { marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const upQuote = unwrap(await marketsProvider.freshQuoteStake(target, "up", 5n * one));
  if (!upQuote) throw new Error("no UP quote on the fork book");
  const upOrder = expectStatus(
    "owner UP from the Trading Balance",
    await owner.submitter.submitOrder({ market, side: "up", stakeBase: 5n * one, displayedQuote: upQuote, wallet: owner.address, route: { kind: "vault" } }),
    "confirmed",
    "nothingFilled",
  );
  console.log(json(upOrder));

  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  expectStatus(
    "grant STRATEGY",
    await owner.submitter.submitTx({
      kind: "vault-grant",
      terms: {
        kind: "strategy",
        actor: actor.address,
        caps: { maxStakePerTradeBase: 500n * one, maxDailySpendBase: 1_000n * one, maxOpenPositions: 4, maxPriceRaw: 0n },
        expiresAtSec: nowSec + 86_400,
        budgetBase: 800n * one,
      },
    }),
    "confirmed",
  );
  const withGrant = unwrap(await marketsProvider.getVaultSnapshot(owner.address));
  const grant = withGrant?.grants.strategy;
  if (!grant) throw new Error("no live STRATEGY grant after granting");
  console.log("grant", json(grant));

  const downQuote = unwrap(await marketsProvider.freshQuoteStake(target, "down", 5n * one));
  if (!downQuote) throw new Error("no DOWN quote on the fork book");
  const downOrder = expectStatus(
    "actor DOWN from the grant",
    await actor.submitter.submitOrder({ market, side: "down", stakeBase: 5n * one, displayedQuote: downQuote, wallet: actor.address, route: { kind: "vault-grant", grantId: grant.grantId } }),
    "confirmed",
    "nothingFilled",
  );
  console.log(json(downOrder));
  console.log("holdings", json(unwrap(await marketsProvider.getVaultHoldings(owner.address, onchain))));

  // A cap breach is refused BEFORE any signature (simulateCaps), never sent.
  const bigQuote = unwrap(await marketsProvider.freshQuoteStake(target, "down", 600n * one));
  if (bigQuote) {
    const refused = await actor.submitter.submitOrder({ market, side: "down", stakeBase: 600n * one, displayedQuote: bigQuote, wallet: actor.address, route: { kind: "vault-grant", grantId: grant.grantId } });
    console.log("over-cap order:", refused.status, "diagnosis" in refused ? refused.diagnosis.kind : "", "diagnosis" in refused ? refused.diagnosis.technical : "");
  }

  if (LIVE) {
    // The oracle settles the Window after expiry; wait for the chain to say so (canon #1), then crank.
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      const now = unwrap(await marketsProvider.getOnchain(marketId));
      if (now.isResolved || now.isVoided) {
        console.log("settled on-chain:", now.isVoided ? "void" : `winner ${now.winningOutcome}`);
        break;
      }
      if (Date.now() > deadline) throw new Error("the Window did not settle within 15 minutes");
      console.log(`waiting for settlement… status ${now.status}, ${Math.max(0, now.expirySec - Math.floor(marketsProvider.nowMs() / 1000))}s to expiry`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
  } else {
    // On a fork: past the settlement window with no oracle answer, anyone voids; then anyone cranks.
    const settlementWindow = Number(call(onchain.marketAddress, "settlementWindow()(uint64)").split(" ")[0]);
    rpc("evm_setNextBlockTimestamp", String(onchain.expirySec + settlementWindow + 5));
    rpc("evm_mine");
    execSync(`cast send ${onchain.marketAddress} "voidExpired()" --private-key ${actorKey} --rpc-url ${RPC}`, { stdio: "ignore" });
    console.log("voided:", call(onchain.marketAddress, "isVoided()(bool)"));
  }
  expectStatus("crank by the actor", await actor.submitter.submitTx({ kind: "vault-crank-settle", owner: owner.address as Address, marketId }), "confirmed");

  const settled = unwrap(await marketsProvider.getVaultSnapshot(owner.address));
  console.log("snapshot after crank", json(settled?.account));
  const sheet = unwrap(await marketsProvider.getBalanceSheet(owner.address));
  console.log("balance sheet vaultBase", sheet.vaultBase?.toString());
  const history = unwrap(await marketsProvider.listWalletHistory(owner.address));
  console.log("history rounds", json(history.rounds.map((r) => ({ source: r.source, outcome: r.outcome, stake: r.stakeBase, payout: r.payoutBase, pnl: r.pnlBase, claim: r.claim, fills: r.fillCount }))));
  expectStatus("withdraw all", await owner.submitter.submitTx({ kind: "vault-withdraw", amountBase: settled?.account.availableBase ?? 0n }), "confirmed");
  await owner.dispose();
  if (actor !== owner) await actor.dispose();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeRuntime();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
}
