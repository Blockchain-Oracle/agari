// The first-call drive on devnet (the S4 gate, NYSE hours; the stage owner runs it): one Up IOC fill through the order
// lane against the soak's seed maker on the live TSLA-5m Window, the settler's resolution, then the claim through the
// redeem lane, which reconciles to the settler's `redeem_for` when the 300 s grace (D-032) has already paid it.

import { readMarket, readSeries } from "@agari/markets";
import { windowAddresses } from "@agari/markets/deploy";
import { check, costOf, phases, quoteNow, saveEvidence, sleep, userSession, type Drive } from "./first-call-kit";

const STAKE_BASE = 2_000_000n;
/** 0.02 SOL: the faucet top-up a wallet holds (D-012); it pays the order and the claim. */
const USER_LAMPORTS = 20_000_000n;
const POLL_MS = 10_000;

export async function devnetDrive(d: Drive) {
  const series = d.venue.series!["TSLA-5m"]!;
  const onchainSeries = await d.client.agariEvents.accounts.series.fetch(series.address as never);
  const w = await windowAddresses(series.address as never, onchainSeries.data.nextIndex - 1n);
  const account = await readMarket(w.market);
  if (!account || account.data.state !== 0) throw new Error(`TSLA-5m #${w.index} (${w.market}) is not open: run during NYSE hours with the soak rolling`);
  const facts = await readSeries(series.address as never);
  const market = {
    marketId: w.market, venueId: d.config, asset: "TSLA", lane: "regular", question: "", intervalSec: facts.cadenceSec,
    tradingStartSec: Number(account.data.tradingStart), lockAtSec: Number(account.data.lockAt), expirySec: Number(account.data.expiry),
    poolAddress: account.data.book, marketAddress: w.market, seriesAddress: series.address, nonce: w.index, policyVersion: account.data.policyVersion,
    printSource: "pyth", collateral: d.mint, decimals: 6, status: "Trading", winningOutcome: null, voided: false, voidReason: null, finalized: false,
    openingPriceRaw: null, volumeQuoteRaw: 0n, tradeCount: 0, lastPriceRaw: null, resolvedAtMs: null,
  } as never;

  const user = await d.newUser("user", USER_LAMPORTS, 10_000_000n);
  const session = await userSession(d, user, `${d.scratch}/first-call-devnet-journal.json`);
  const quote = await quoteNow(d, market, "up", STAKE_BASE);
  const fill = await session.submitter.submitOrder({ market, side: "up", stakeBase: STAKE_BASE, displayedQuote: quote, wallet: user.address as never }, phases("up"));
  check(fill.status === "confirmed", `wallet-paid IOC Up fill (got ${fill.status}${"diagnosis" in fill ? `: ${fill.diagnosis.technical}` : ""})`);
  const cost = await costOf(fill.booked.txHash);
  d.log({ step: "IOC up fill", signature: fill.booked.txHash, note: `fee payer ${user.address}; ${fill.booked.contractsRaw} raw for ${fill.booked.costBase}; ${cost.computeUnits} CU, ${cost.bytes} B` });

  console.log(`  waiting for the settler to resolve #${w.index} (expiry ${new Date(Number(account.data.expiry) * 1000).toISOString()})`);
  for (;;) {
    const now = await readMarket(w.market);
    if (!now || now.data.state !== 0) break;
    await sleep(POLL_MS);
  }
  const claim = await session.submitter.submitTx({ kind: "redeem", marketId: w.market as never, outcomeIdx: 0, amountRaw: 0n }, phases("claim"));
  check(claim.status === "confirmed", `claim confirmed (got ${claim.status}${"diagnosis" in claim ? `: ${claim.diagnosis.technical}` : ""})`);
  d.log({ step: "claim", signature: claim.txHash, note: "user_redeem, or the settler's redeem_for it reconciled to" });
  saveEvidence(d, { window: w, booked: fill.booked, claim });
}
