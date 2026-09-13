import { isOk } from "@masayume/core/schemas";
import { parseStrategyMetadata, type StrategyRecord } from "@masayume/core/strategies";
import type { Bytes32 } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";
import { interruptStrategyDecisions, isDbConfigured, listAttemptedStrategyIds, markDecisionExecution, recordHeartbeat } from "@masayume/db";
import { createMemoryJournal, createSubmitterSession, ensureMarkets, marketsProvider, parseMarketsEnv, resolveVenueId, type SubmitterSession } from "@masayume/markets";
import { getStrategy, listLiveSubscribers, listStrategies, resolveRegistryDeployment } from "@masayume/markets/strategies";
import { agentBootLine, createAgentState, scanVenueWithAgent, warmAgentState, type AgentState } from "./agent";
import { scanVenue, type Scan } from "./decide";
import { readRunnerEnv, type RunnerEnv } from "./env";
import { executeForSubscriber } from "./execute";
import { reconcileRunnerAttempts, serialCycle, settleStrategyPositions } from "./lifecycle";

type Log = (why: string) => void;

interface Runner {
  env: RunnerEnv;
  session: SubmitterSession | null;
  venueId: Bytes32;
  agent: AgentState;
  log: Log;
  unresolved: Set<string>;
}

/** Durability only (AD-7): the log line is the truth, the row is what the surface reads later. */
async function heartbeat(runner: Runner, strategyId: bigint, why: string, scanned: number, closestBps: number | null): Promise<void> {
  runner.log(`#${strategyId}: ${why}`);
  const stored = await recordHeartbeat({
    runner: runner.session?.address ?? "unconfigured",
    strategyId: strategyId.toString(),
    intervalMs: runner.env.intervalMs,
    why,
    scanned,
    closestBps,
    dryRun: runner.env.dryRun,
  }).catch((error: unknown) => {
    runner.log(`heartbeat not stored: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  });
  if (!stored && isDbConfigured()) runner.log("heartbeat not stored: the database refused the row");
}

/** The house model or the agent, by the spec's preset; the execution loop below never knows which. */
function scan(runner: Runner, strategy: StrategyRecord, spec: NonNullable<ReturnType<typeof parseStrategyMetadata>>["spec"], nowMs: number): Promise<Scan> {
  if (spec.preset !== "agent") return scanVenue(runner.venueId, spec, nowMs);
  return scanVenueWithAgent({ env: runner.env, venueId: runner.venueId, runnerKey: runner.session?.address ?? "unconfigured", agent: runner.agent, log: runner.log, onReading: (why) => heartbeat(runner, strategy.strategyId, why, 0, null) }, strategy, spec, nowMs);
}

async function cycle(runner: Runner, strategyId: bigint, nowMs: number): Promise<void> {
  const reading = await getStrategy(strategyId);
  if (!isOk(reading) || reading.stale || !reading.value) return heartbeat(runner, strategyId, `strategy unreadable: ${isOk(reading) ? reading.stale ? "stale registry state; holding" : "not on this registry" : reading.error.technical}`, 0, null);
  const strategy: StrategyRecord = reading.value;
  if (!isDbConfigured()) return heartbeat(runner, strategyId, "strategy execution and risk stores unavailable; holding", 0, null);
  if (runner.unresolved.size > 0) return heartbeat(runner, strategyId, "confirmation unknown for this runner's previous attempt; holding all new submissions and not resending", 0, null);
  if (runner.session) await settleStrategyPositions(runner.session, strategyId, runner.env.dryRun, runner.log);
  if (!strategy.active) return heartbeat(runner, strategyId, "strategy deactivated by its creator; idle", 0, null);
  if (runner.session && strategy.runner !== runner.session.address.toLowerCase()) {
    return heartbeat(runner, strategyId, `this key is ${runner.session.address}, the strategy names ${strategy.runner}; not trading it`, 0, null);
  }
  const meta = parseStrategyMetadata(strategy.metadata);
  if (!meta) return heartbeat(runner, strategyId, "metadata carries no readable spec; idle", 0, null);
  const isAgent = meta.spec.preset === "agent";
  const subscribers = await listLiveSubscribers(strategyId);
  if (!isOk(subscribers) || subscribers.stale) return heartbeat(runner, strategyId, `subscriptions unreadable: ${isOk(subscribers) ? "stale consent state" : subscribers.error.technical}; holding`, 0, null);
  const live = subscribers.value;
  if (live.length === 0) return heartbeat(runner, strategyId, "published; waiting for a funded live subscriber", 0, null);
  const scanned = await scan(runner, strategy, meta.spec, nowMs);
  if (scanned.candidates.length === 0 || live.length === 0) {
    return heartbeat(runner, strategyId, `${scanned.why}; ${live.length} live subscriber${live.length === 1 ? "" : "s"}`, scanned.scanned, scanned.closestBps);
  }
  if (!runner.session) return heartbeat(runner, strategyId, `${scanned.why}; no runner key configured, so nothing sent`, scanned.scanned, scanned.closestBps);

  let filled = 0;
  let skipped = 0;
  for (const { market, decision } of scanned.candidates) {
    let filledHere = 0;
    let skippedHere = 0;
    for (const sub of live) {
      const result = await executeForSubscriber({ session: runner.session, sub, market, decision, nowMs, dryRun: runner.env.dryRun });
      if (result.status === "filled") {
        filledHere += 1;
        const { fill } = result;
        runner.log(`#${strategyId}: filled ${fill.side} on ${market.asset}/${market.intervalSec}s for ${fill.owner} — ${fill.txHash}`);
      } else {
        skippedHere += 1;
        runner.log(`#${strategyId}: ${sub.subscriber} ${result.status}${"reason" in result ? ` — ${result.reason}` : ` — would stake ${result.stakeBase}`}`);
        if (result.status === "unknown") {
          runner.unresolved.add(strategyId.toString());
          return heartbeat(runner, strategyId, `confirmation unknown: ${result.reason}; holding new entries`, scanned.scanned, scanned.closestBps);
        }
      }
    }
    filled += filledHere;
    skipped += skippedHere;
    if (isAgent) await markDecisionExecution(strategyId.toString(), market.marketId, filledHere, skippedHere, runner.env.dryRun);
  }
  await heartbeat(runner, strategyId, `${scanned.why}; ${filled} filled, ${skipped} skipped${runner.env.dryRun ? " (dry run)" : ""}`, scanned.scanned, scanned.closestBps);
}

/**
 * The house runner (Story 6.5): a single writer over one key, trading each live subscriber's own
 * grant, whether the spec is the oracle-follow model or an agent whose calls a language model
 * makes and a fixed gate rules on. Idle cycles emit heartbeats — never liveness theater.
 */
export async function startStrategyRunner(log: Log): Promise<void> {
  const env = readRunnerEnv();
  // With no STRATEGY_IDS the runner takes the registry's word: every active strategy that names its key.
  // A creator who launches on the house runner from the studio is then run without anyone editing a
  // secret (the owner, 2026-09-04) — the registry already says whose key each strategy is bound to.
  if (env.strategyIds.length === 0 && !env.privateKey) return log("not configured: no STRATEGY_IDS and no RUNNER_PRIVATE_KEY to discover them by; idle");
  if (!resolveRegistryDeployment()) return log("StrategyRegistry is not deployed on this network; idle");
  const marketsEnv = parseMarketsEnv({ venueId: env.venueId });
  ensureMarkets(marketsEnv);
  const venue = await resolveVenueId(marketsEnv.venueId);
  if (!isOk(venue) || !venue.value.venueId) return log(`no venue to scan: ${isOk(venue) ? "none live" : venue.error.technical}; idle`);

  let session: SubmitterSession | null = null;
  if (env.privateKey) {
    session = await createSubmitterSession({ env: marketsEnv, authority: "strategy-runner", signer: { privateKey: env.privateKey }, journal: createMemoryJournal() });
    log(`runner key ${session.address}${env.dryRun ? " (dry run: nothing is sent)" : ""}`);
  } else {
    log("RUNNER_PRIVATE_KEY is not set: scanning and reporting only, nothing can be sent");
  }
  if (!isDbConfigured()) log("DATABASE_URL is not set: execution and risk memory unavailable; new trades held");

  const agent = createAgentState();
  log(agentBootLine(agent));
  if (agent.brain) {
    const warmed = await warmAgentState(agent, msToSec(Date.now()));
    log(`agent memory: ${warmed} Windows already read; budget ${env.agentMaxCallsPerHour} calls/h, ${env.agentTimeoutMs} ms per read`);
  }

  const runner: Runner = { env, session, venueId: venue.value.venueId, agent, log, unresolved: new Set() };
  const discover = env.strategyIds.length === 0;
  if (discover) log(`no STRATEGY_IDS: running every active strategy on the registry that names ${session!.address}`);
  let lastDiscovered = "";
  const strategiesToRun = async (): Promise<bigint[]> => {
    if (!discover) return env.strategyIds;
    const listed = await listStrategies();
    if (!isOk(listed) || listed.stale || !listed.value) {
      log(`registry unreadable: ${isOk(listed) ? listed.stale ? "stale state" : "no strategies" : listed.error.technical}; nothing to run this cycle`);
      return [];
    }
    const historical = await listAttemptedStrategyIds(session!.address);
    const mine = [...new Set([...listed.value.filter((s) => s.runner === session!.address.toLowerCase()).map((s) => s.strategyId), ...historical.map(BigInt)])];
    const summary = mine.map((id) => `#${id}`).join(", ") || "none";
    if (summary !== lastDiscovered) {
      lastDiscovered = summary;
      log(`strategies naming this key: ${summary}`);
    }
    return mine;
  };
  const bootAtMs = Date.now();
  let recoveredReads = false;
  const tick = serialCycle(async () => {
    const clock = await marketsProvider.syncClock();
    if (!isOk(clock) || clock.stale) throw new Error("chain clock unavailable; holding");
    if (session && isDbConfigured()) {
      if (!recoveredReads) {
        await interruptStrategyDecisions(session.address, bootAtMs);
        // Interrupted provider calls still consume the sliding-hour budget after restart.
        if (agent.brain) await warmAgentState(agent, msToSec(Date.now()));
        recoveredReads = true;
      }
      runner.unresolved = await reconcileRunnerAttempts(session, log);
    }
    for (const id of await strategiesToRun()) {
      await cycle(runner, id, marketsProvider.nowMs()).catch(async (error: unknown) => {
        // Refresh reservations before another strategy can consume a potentially reserved nonce.
        if (session) runner.unresolved = await reconcileRunnerAttempts(session, log);
        await heartbeat(runner, id, `holding: ${error instanceof Error ? error.message : String(error)}`, 0, null);
      });
    }
  }, (error) => log(`runner unavailable; holding: ${error instanceof Error ? error.message : String(error)}`));
  await tick();
  setInterval(() => void tick(), env.intervalMs);
}
