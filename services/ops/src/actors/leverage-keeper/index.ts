import { isOk } from "@masayume/core/schemas";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, marketsProvider, parseMarketsEnv, type SubmitterSession } from "@masayume/markets";
import { getLeverageMark, getLeverageReserveState, listLeverageOpenPositions } from "@masayume/markets/leverage";
import { decidePosition } from "./decide";
import { readKeeperEnv, type KeeperEnv } from "./env";

type Log = (why: string) => void;

interface Keeper {
  env: KeeperEnv;
  session: SubmitterSession | null;
  log: Log;
}

async function send(keeper: Keeper, intent: Parameters<SubmitterSession["submitter"]["submitTx"]>[0], why: string): Promise<void> {
  const label = `${intent.kind} ${"positionId" in intent ? `#${intent.positionId}` : ""}`;
  if (keeper.env.dryRun || !keeper.session) return keeper.log(`DRY ${label}: ${why}`);
  const outcome = await keeper.session.submitter.submitTx(intent);
  if (outcome.status === "confirmed") return keeper.log(`${label}: ${why} · ${outcome.txHash}`);
  keeper.log(`${label} ${outcome.status}: ${outcome.diagnosis.technical}`);
}

async function cycle(keeper: Keeper): Promise<void> {
  const state = await getLeverageReserveState();
  if (!isOk(state)) return keeper.log(`reserve unreadable: ${state.error.technical}`);
  if (!state.value) return keeper.log("LeverageReserve is not deployed on this network; idle");
  const open = await listLeverageOpenPositions();
  if (!isOk(open)) return keeper.log(`open positions unreadable: ${open.error.technical}`);
  let settled = 0;
  let knocked = 0;
  for (const position of open.value) {
    const onchain = await marketsProvider.getOnchain(position.marketId);
    if (!isOk(onchain)) {
      keeper.log(`#${position.positionId}: on-chain state unreadable: ${onchain.error.technical}`);
      continue;
    }
    const mark = await getLeverageMark(position.positionId);
    const action = decidePosition(position, onchain.value, isOk(mark) ? mark.value : null);
    if (action.kind === "hold") continue;
    await send(keeper, { kind: action.kind === "settle" ? "leverage-settle" : "leverage-knock-out", positionId: action.positionId, marketId: action.marketId }, action.why);
    if (action.kind === "settle") settled += 1;
    else knocked += 1;
  }
  keeper.log(`liquid ${state.value.liquidBase} outstanding ${state.value.outstandingBase} · ${open.value.length} live · settled ${settled}, knocked out ${knocked}${keeper.env.dryRun ? " · DRY RUN" : ""}`);
}

/** The leverage reserve's keeper: one key, one writer, cranking what the contract already allows anyone to crank; dry-run until told otherwise. */
export async function startLeverageKeeper(log: Log): Promise<void> {
  const env = readKeeperEnv();
  const marketsEnv = parseMarketsEnv({ venueId: env.venueId });
  ensureMarkets(marketsEnv);
  // The reads price in collateral units: the token must be loaded once before any reserve read (the first live run found this).
  const collateral = await loadCollateral();
  if (!isOk(collateral)) return log(`collateral unreadable: ${collateral.error.technical}`);

  let session: SubmitterSession | null = null;
  if (env.privateKey) {
    session = await createSubmitterSession({ env: marketsEnv, authority: "leverage-keeper", signer: { privateKey: env.privateKey }, journal: createMemoryJournal() });
    log(`keeper key ${session.address}${env.dryRun ? " (DRY RUN: nothing is sent)" : ""}`);
  } else {
    log("LEVERAGE_KEEPER_PRIVATE_KEY is not set: scanning and reporting only, nothing can be sent");
  }
  const keeper: Keeper = { env, session, log };

  const tick = async () => {
    try {
      await cycle(keeper);
    } catch (error) {
      log(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await tick();
  setInterval(() => void tick(), env.refreshMs);
}
