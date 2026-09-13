import { execSync } from "node:child_process";

import { formatCadence } from "@masayume/core/copy";
import { privateOpenMessage } from "@masayume/core/private";
import type { Hex } from "@masayume/core/types";
import { formatBaseUnits, oneUnit } from "@masayume/core/units";
import { closeRuntime, configureMarkets, createMemoryJournal, createSubmitterSession, getCollateral, loadCollateral, marketsProvider, parseMarketsEnv, resolveVenueId, unwrap } from "@masayume/markets";
import { cashOutPrivateBet, createDeskClient, deriveSlotKeys, deskHealth, getPrivateBudget, getPrivateDeskState, getPrivateSlot, openPrivateBet, sizePrivateForStake } from "@masayume/markets/private";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Drives the private desk through the REAL adapter on Shannon: the owner (HOUSE_KEY) deposits and allows in one
 * transaction, the desk (PRIVATE_DESK_PRIVATE_KEY) opens 10 on the soonest Trading Window with enough time left —
 * three sends, each measured — and, with WAIT=1, waits for the Window to settle, cashes out (settle, sweep,
 * credit, each measured) and the owner withdraws. SKIP_FUND=1 skips the deposit when the balance already covers it.
 *
 *   HOUSE_KEY=… PRIVATE_DESK_PRIVATE_KEY=… pnpm --filter @masayume/scripts spike:private-live        (WAIT=1 to settle)
 */
const WAIT = process.env.WAIT === "1";
const SKIP_FUND = process.env.SKIP_FUND === "1";
const RPC = process.env.RPC_HTTP_URLS ?? "https://dream-rpc.somnia.network";
const MIN_LEFT_SEC = Number(process.env.MIN_LEFT_SEC ?? 420);
const STAKE_UNITS = BigInt(process.env.STAKE ?? "10");
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const gasOf = (hash: string) => (hash && hash !== "0x" ? Number(execSync(`cast receipt ${hash} gasUsed --rpc-url ${RPC}`, { encoding: "utf8" }).trim()) : null);

const env = parseMarketsEnv({ rpcHttpUrls: RPC, venueId: process.env.VENUE_ID });
configureMarkets(env);

try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const state = unwrap(await getPrivateDeskState());
  if (!state) throw new Error("PrivateDesk is not deployed on this network");
  const one = oneUnit(state.decimals);
  const stake = STAKE_UNITS * one;
  console.log("desk", json({ contract: state.deployment.privateDesk, desk: state.desk, paused: state.paused, pool: state.poolBase, owed: state.owedBase, inSlots: state.inSlotsBase, params: state.params }));

  const desk = createDeskClient({ privateKey: process.env.PRIVATE_DESK_PRIVATE_KEY as Hex, rpcUrl: RPC });
  console.log("health", json(await deskHealth(desk)));

  const owner = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: process.env.HOUSE_KEY as Hex }, journal: createMemoryJournal() });
  console.log("owner", owner.address);
  let budget = unwrap(await getPrivateBudget(owner.address));
  console.log("budget", json(budget));
  if (!SKIP_FUND && budget.spendableBase < stake) {
    const funded = await owner.submitter.submitTx({ kind: "private-deposit-and-allow", amountBase: 5n * stake, allowanceBase: budget.balanceBase + 5n * stake });
    if (funded.status !== "confirmed") throw new Error(`deposit: ${json(funded)}`);
    console.log("depositAndAllow", json({ tx: funded.txHash, gas: gasOf(funded.txHash) }));
    budget = unwrap(await getPrivateBudget(owner.address));
    console.log("budget", json(budget));
  }

  const venue = unwrap(await resolveVenueId(env.venueId));
  if (!venue.venueId) throw new Error("no venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.venueId));
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const window = lanes.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.status === "Trading" && m.expirySec - nowSec >= MIN_LEFT_SEC)
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!window) throw new Error(`no Trading Window with ${MIN_LEFT_SEC}s left`);
  console.log("window", json({ id: BigInt(window.marketId).toString(), asset: window.asset, cadence: window.intervalSec, left: window.expirySec - nowSec }));

  const quote = unwrap(await sizePrivateForStake(window.marketId, "up", stake));
  console.log("10 on UP quoted", json({ contracts: quote.quantityRaw, cost: quote.costBase, limitYes: quote.limitYesRaw, price: quote.priceRaw }));

  // The owner's authorisation: the exact message the wallet would show, signed once — also the desk's seed for the three keys.
  const account = privateKeyToAccount(process.env.HOUSE_KEY as Hex);
  const issuedAtMs = Date.now();
  const collateral = getCollateral();
  const message = privateOpenMessage({ owner: owner.address, contract: state.deployment.privateDesk, chainId: state.deployment.chainId, marketId: window.marketId, asset: window.asset, cadenceText: formatCadence(window.intervalSec), expirySec: window.expirySec, side: "up", stakeText: formatBaseUnits(stake, state.decimals, { maxDp: state.decimals, minDp: 0, group: false }), symbol: collateral.symbol, issuedAtMs });
  const authSignature = await account.signMessage({ message });
  const keys = deriveSlotKeys(authSignature);
  console.log("keys", json(keys));

  const opened = await openPrivateBet(desk, { owner: owner.address, marketId: window.marketId, side: "up", stakeBase: stake, minQuantityRaw: (quote.quantityRaw * 95n) / 100n, authSignature, issuedAtMs, asset: window.asset, intervalSec: window.intervalSec, expirySec: window.expirySec });
  console.log("open", json(opened));
  if (opened.status !== "opened") throw new Error(`open: ${opened.status}`);
  const t = opened.ticket;
  console.log("gas: charge / fund / mint", gasOf(t.txs.charge), gasOf(t.txs.fund), gasOf(t.txs.mint));
  console.log("slot", json(unwrap(await getPrivateSlot(t.claim.slotId))));
  console.log("budget after", json(unwrap(await getPrivateBudget(owner.address))));

  // Idempotent: the same authorisation again returns the same slot's ticket without a second charge.
  const again = await openPrivateBet(desk, { owner: owner.address, marketId: window.marketId, side: "up", stakeBase: stake, minQuantityRaw: 0n, authSignature, issuedAtMs, asset: window.asset, intervalSec: window.intervalSec, expirySec: window.expirySec });
  console.log("open again (resumed, nothing sent)", json(again.status === "opened" ? { slot: again.ticket.claim.slotId, txs: again.ticket.txs } : again));

  const early = await cashOutPrivateBet(desk, t.claim, t.signature);
  console.log("cash out before settlement", json(early));

  if (WAIT) {
    const deadline = Date.now() + 40 * 60_000;
    for (;;) {
      const now = unwrap(await marketsProvider.getOnchain(window.marketId));
      if (now.isResolved || now.isVoided) break;
      if (Date.now() > deadline) throw new Error("the Window did not settle within 40 minutes");
      console.log(`waiting… status ${now.status}, ${Math.max(0, now.expirySec - Math.floor(marketsProvider.nowMs() / 1000))}s to expiry`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
    const out = await cashOutPrivateBet(desk, t.claim, t.signature);
    console.log("cash out", json(out));
    if (out.status === "credited") console.log("gas: settle / sweep / credit", gasOf(out.txs.settle ?? ""), gasOf(out.txs.sweep ?? ""), gasOf(out.txs.credit ?? ""));
    console.log("cash out again (nothing owed)", json(await cashOutPrivateBet(desk, t.claim, t.signature)));
    const after = unwrap(await getPrivateBudget(owner.address));
    console.log("budget after cash-out", json(after));
    const withdrew = await owner.submitter.submitTx({ kind: "private-withdraw", amountBase: after.balanceBase });
    if (withdrew.status !== "confirmed") throw new Error(`withdraw: ${json(withdrew)}`);
    console.log("withdraw", json({ tx: withdrew.txHash, gas: gasOf(withdrew.txHash) }));
    console.log("budget after withdraw", json(unwrap(await getPrivateBudget(owner.address))));
  }
  await owner.dispose();
} finally {
  await closeRuntime();
  // The SDK session leaves a handle open after dispose; say so and leave rather than hang at the end.
  process.exit(0);
}
