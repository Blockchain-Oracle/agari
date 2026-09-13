import { phase } from "@masayume/core/lifecycle";
import type { MakerVaultState, MakerWindowView } from "@masayume/core/maker";
import { isOk } from "@masayume/core/schemas";
import type { Bytes32, EventMarket, MarketId } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, marketsProvider, parseMarketsEnv, resolveVenueId, type SubmitterSession } from "@masayume/markets";
import { getMakerVaultState, listMakerOpenWindows, readPoolTop } from "@masayume/markets/maker";
import { decideOpen, decideQuote, type Placed } from "./decide";
import { readMakerEnv, type MakerEnv } from "./env";

type Log = (why: string) => void;

interface Maker {
  env: MakerEnv;
  session: SubmitterSession | null;
  venueId: Bytes32;
  placed: Map<MarketId, Placed>;
  log: Log;
}

async function send(maker: Maker, intent: Parameters<SubmitterSession["submitter"]["submitTx"]>[0], why: string): Promise<boolean> {
  if (maker.env.dryRun || !maker.session) {
    maker.log(`DRY ${intent.kind} ${"marketId" in intent ? intent.marketId : ""}: ${why}`);
    return false;
  }
  const outcome = await maker.session.submitter.submitTx(intent);
  if (outcome.status === "confirmed") {
    maker.log(`${intent.kind} ${"marketId" in intent ? intent.marketId : ""}: ${why} · ${outcome.txHash}`);
    return true;
  }
  const args = intent.kind === "maker-quote" ? ` (${intent.bidYesRaw} / ${intent.askYesRaw} × ${intent.quantityRaw}, expires ${intent.expireNs})` : "";
  maker.log(`${intent.kind} ${"marketId" in intent ? intent.marketId : ""} ${outcome.status}${args}: ${why} · ${outcome.diagnosis.technical}`);
  return false;
}

/** Settle what the venue settled, merge what is paired — the exit half, before any new quote. */
async function tendOpen(maker: Maker, views: MakerWindowView[]): Promise<void> {
  for (const view of views) {
    const onchain = await marketsProvider.getOnchain(view.marketId);
    if (!isOk(onchain)) {
      maker.log(`${view.marketId}: on-chain state unreadable: ${onchain.error.technical}`);
      continue;
    }
    const action = decideOpen(view, onchain.value);
    if (action.kind === "hold") continue;
    const sent = await send(maker, { kind: action.kind === "settle" ? "maker-settle" : "maker-merge", marketId: view.marketId }, action.why);
    if (sent && action.kind === "settle") maker.placed.delete(view.marketId);
  }
}

/** The Windows a quote may sit on: the venue's live lanes, filtered to the actor's assets and cadences, soonest first. */
async function candidates(maker: Maker, nowMs: number): Promise<EventMarket[]> {
  const lanes = await marketsProvider.listLiveLanes(maker.venueId);
  if (!isOk(lanes)) {
    maker.log(`lanes unreadable: ${lanes.error.technical}`);
    return [];
  }
  return lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => phase(m, nowMs) === "trading")
    .filter((m) => maker.env.intervals.includes(m.intervalSec))
    .filter((m) => maker.env.assets.length === 0 || maker.env.assets.includes(m.asset.toUpperCase()))
    .sort((a, b) => a.expirySec - b.expirySec);
}

async function quoteWindows(maker: Maker, state: MakerVaultState, views: MakerWindowView[], nowMs: number): Promise<{ quoted: number; skipped: number }> {
  const one = oneUnit(state.decimals);
  const nowSec = Math.floor(nowMs / 1000);
  const open = new Set(state.openWindows);
  const byId = new Map(views.map((v) => [v.marketId, v]));
  let quoted = 0;
  let skipped = 0;
  for (const market of await candidates(maker, nowMs)) {
    if (!open.has(market.marketId) && open.size >= state.params.maxOpenWindows) {
      skipped += 1;
      continue;
    }
    const top = await readPoolTop(market.poolAddress);
    const decision = decideQuote({ market, top, params: state.params, env: maker.env, one, nowSec, view: byId.get(market.marketId) ?? null, placed: maker.placed.get(market.marketId) ?? null });
    if (decision.kind === "skip") {
      skipped += 1;
      continue;
    }
    if (decision.pullFirst) await send(maker, { kind: "maker-pull", marketId: market.marketId }, "clearing the last pair before requoting");
    const intent = { kind: "maker-quote" as const, marketId: market.marketId, bidYesRaw: decision.pair.bidYesRaw, askYesRaw: decision.pair.askYesRaw, quantityRaw: decision.quantityRaw, expireNs: decision.expireNs };
    const sent = await send(maker, intent, decision.why);
    if (sent) {
      maker.placed.set(market.marketId, { ...decision.pair, fairRaw: (decision.pair.bidYesRaw + decision.pair.askYesRaw) / 2n, tickRaw: top.tickRaw, expireNs: decision.expireNs });
      open.add(market.marketId);
      quoted += 1;
    }
  }
  return { quoted, skipped };
}

async function cycle(maker: Maker): Promise<void> {
  const state = await getMakerVaultState();
  if (!isOk(state)) return maker.log(`vault unreadable: ${state.error.technical}`);
  if (!state.value) return maker.log("MarketMakerVault is not deployed on this network; idle");
  const vault = state.value;
  if (vault.paused) return maker.log("the vault is paused; tending open Windows only");
  if (maker.session && vault.maker !== maker.session.address.toLowerCase()) {
    return maker.log(`this key is ${maker.session.address}, the vault names ${vault.maker ?? "no maker"}; not quoting`);
  }
  const views = await listMakerOpenWindows();
  if (!isOk(views)) return maker.log(`open Windows unreadable: ${views.error.technical}`);
  await tendOpen(maker, views.value);
  const nowMs = marketsProvider.nowMs();
  const { quoted, skipped } = await quoteWindows(maker, vault, views.value, nowMs);
  maker.log(`liquid ${vault.liquidBase} deployed ${vault.deployedBase} share ${vault.sharePriceRaw} · ${vault.openWindows.length} open · quoted ${quoted}, skipped ${skipped}${maker.env.dryRun ? " · DRY RUN" : ""}`);
}

/** The Earn vault's maker: one key, one writer, bounded by the vault's own params; dry-run until told otherwise. */
export async function startMarketMaker(log: Log): Promise<void> {
  const env = readMakerEnv();
  const marketsEnv = parseMarketsEnv({ venueId: env.venueId });
  ensureMarkets(marketsEnv);
  // The reads price in collateral units: the token must be loaded once before any reserve read (the first live run found this).
  const collateral = await loadCollateral();
  if (!isOk(collateral)) return log(`collateral unreadable: ${collateral.error.technical}`);
  const venue = await resolveVenueId(marketsEnv.venueId);
  if (!isOk(venue) || !venue.value.venueId) return log("no live venue; the maker is idle");

  let session: SubmitterSession | null = null;
  if (env.privateKey) {
    session = await createSubmitterSession({ env: marketsEnv, authority: "market-maker", signer: { privateKey: env.privateKey }, journal: createMemoryJournal() });
    log(`maker key ${session.address}${env.dryRun ? " (DRY RUN: nothing is sent)" : ""}`);
  } else {
    log("MAKER_PRIVATE_KEY is not set: scanning and reporting only, nothing can be sent");
  }
  const maker: Maker = { env, session, venueId: venue.value.venueId, placed: new Map(), log };

  const tick = async () => {
    try {
      await cycle(maker);
    } catch (error) {
      log(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await tick();
  setInterval(() => void tick(), env.refreshMs);
}
