import { isOk } from "@agari/core/schemas";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, marketsProvider, type SubmitterSession } from "@agari/markets";
import { getLeverageMark, getLeverageReserveState, listLeverageOpenPositions } from "@agari/markets/leverage";
import { decidePosition } from "./decide";
import { readKeeperEnv, type KeeperEnv } from "./env";
import { runActor } from "../../runtime/actor";
import { opsMarketsEnv } from "../../runtime/markets-env";

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

/** One pass over every live position. Returns the line the actor loop logs and the heartbeat carries. */
async function cycle(keeper: Keeper): Promise<string> {
  const state = await getLeverageReserveState();
  if (!isOk(state)) throw new Error(`reserve unreadable: ${state.error.technical}`);
  if (!state.value) return "the leverage reserve is not deployed on this network; idle";
  const open = await listLeverageOpenPositions();
  if (!isOk(open)) throw new Error(`open positions unreadable: ${open.error.technical}`);
  let settled = 0;
  let knocked = 0;
  const held: string[] = [];
  for (const position of open.value) {
    const onchain = await marketsProvider.getOnchain(position.marketId);
    if (!isOk(onchain)) {
      held.push(`#${position.positionId} on-chain state unreadable`);
      continue;
    }
    const mark = await getLeverageMark(position.positionId);
    // A mark kept from an earlier read is not a mark: a knock-out decided on it could sell a position that has recovered.
    const action = decidePosition(position, onchain.value, isOk(mark) && !mark.stale ? mark.value : null);
    if (action.kind === "hold") {
      held.push(`#${position.positionId} ${action.why}`);
      continue;
    }
    await send(keeper, { kind: action.kind === "settle" ? "leverage-settle" : "leverage-knock-out", positionId: action.positionId, marketId: action.marketId }, action.why);
    if (action.kind === "settle") settled += 1;
    else knocked += 1;
  }
  const holding = held.length > 0 ? ` · ${held.join("; ")}` : "";
  return `liquid ${state.value.liquidBase} outstanding ${state.value.outstandingBase} · ${open.value.length} live · settled ${settled}, knocked out ${knocked}${holding}`;
}

/**
 * The leverage reserve's keeper: one key, one writer, cranking what the program already lets anyone crank.
 *
 * It runs on the venue actors' own loop (`runActor`): one pass at a time, so a slow pass can never overlap the next
 * and send the same knock-out twice (the first live run did, and the chain refused the repeat as `NotLive`), with
 * backoff on failure and a heartbeat in `/health`. Dry run until told otherwise.
 */
export async function startLeverageKeeper(log: Log): Promise<void> {
  const env = readKeeperEnv();
  const marketsEnv = opsMarketsEnv(env.venueId);
  ensureMarkets(marketsEnv);
  // The reads price in collateral units: the token must be loaded once before any reserve read (the first live run found this).
  const collateral = await loadCollateral();
  if (!isOk(collateral)) return log(`collateral unreadable: ${collateral.error.technical}`);

  let session: SubmitterSession | null = null;
  if (env.privateKey) {
    session = await createSubmitterSession({ env: marketsEnv, authority: "leverage-keeper", signer: { secretKey: env.privateKey }, journal: createMemoryJournal() });
    log(`keeper key ${session.address}`);
  } else {
    log("LEVERAGE_KEEPER_PRIVATE_KEY is not set: scanning and reporting only, nothing can be sent");
  }
  const keeper: Keeper = { env, session, log };
  runActor({ name: "leverage-keeper", log, dryRun: env.dryRun || !session, everyMs: env.refreshMs, pass: async () => ({ why: await cycle(keeper) }) });
}
