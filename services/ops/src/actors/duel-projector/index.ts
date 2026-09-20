import { isOk } from "@agari/core/schemas";
import { isDbConfigured, readCursor, writeCursor } from "@agari/db";
import { arenaHeadBlock, listArenaEvents, resolveArenaDeployment } from "@agari/markets/games";
import { ensureMarkets } from "@agari/markets";
import type { RoomContext } from "../game-room/handlers";
import { applyEvent, type ApplyDeps } from "./apply";
import { createMatchCache } from "./facts";
import { runActor } from "../../runtime/actor";
import { opsMarketsEnv } from "../../runtime/markets-env";

type Log = (why: string) => void;

/**
 * The duel projector: the arena's log, turned into rows and into what a room says.
 *
 * It is the half of "a process restart reconstructs an active match" that the room cannot do alone. The
 * room rebuilds one match on demand from state; this rebuilds *every* match's history from the log, from
 * a cursor, so a restarted process catches up on everything it missed instead of only on what someone
 * happens to reconnect to.
 *
 * Three properties make a restart safe. The cursor is a high-water mark rather than a promise, so
 * re-reading blocks is expected. Every row it writes is keyed by something the chain decided — a match
 * id, a pick's coordinates — so re-writing one changes nothing. And the single increment in the system,
 * a rating, is gated on an insert the chain's own key makes unrepeatable.
 *
 * Without a database it still runs: the projection is skipped, the rooms are still fed, and the cursor
 * lives in memory. That is the honest degradation — a live match works, its history does not persist.
 */

const POLL_MS = Number(process.env.GAME_PROJECTOR_POLL_MS ?? 6_000);
/** Public RPCs refuse a wide `eth_getLogs`; catching up is many small windows rather than one large one. */
const SPAN = BigInt(process.env.GAME_PROJECTOR_SPAN ?? 800);
/**
 * How many spans one cycle may walk. Somnia's blocks are sub-second, so a first run can be tens of
 * thousands of blocks behind — one span per poll would take a quarter of an hour to reach the present.
 * The cap is what keeps a long catch-up from starving the rest of the process for that whole time.
 */
const SPANS_PER_CYCLE = Number(process.env.GAME_PROJECTOR_SPANS ?? 25);

export async function startDuelProjector(log: Log, room: RoomContext | null): Promise<void> {
  const env = opsMarketsEnv();
  ensureMarkets(env);
  const deployment = await resolveArenaDeployment(env);
  if (!deployment) return log("GameArena is not deployed on this network; nothing to project");

  const name = `duel:${deployment.chainId}:${deployment.gameArena}`;
  const deps: ApplyDeps = { room, cache: createMatchCache(), chainId: deployment.chainId, arena: deployment.gameArena, log };

  const stored = await readCursor(name);
  // No cursor means a first run: start at the deployment's own block, so the projection is complete
  // rather than "everything since this process happened to start". `GAME_PROJECTOR_FROM` overrides
  // both, for a spike that wants one match rather than the whole history.
  const forced = process.env.GAME_PROJECTOR_FROM ? BigInt(process.env.GAME_PROJECTOR_FROM) : null;
  let cursor = forced ?? stored ?? deployment.fromBlock;
  log(`projecting ${deployment.gameArena} from block ${cursor}${isDbConfigured() ? "" : " · no DATABASE_URL, rooms only"}${room ? "" : " · no room, rows only"}`);

  async function cycle(): Promise<string> {
    const head = await arenaHeadBlock();
    if (!isOk(head)) throw new Error(`head unreadable: ${head.error.technical}`);
    if (head.value <= cursor) return `caught up at slot ${cursor}`;

    let seen = 0;
    let spans = 0;
    for (; spans < SPANS_PER_CYCLE && cursor < head.value; spans += 1) {
      const from = cursor + 1n;
      const to = head.value < from + SPAN ? head.value : from + SPAN;
      const events = await listArenaEvents(from, to);
      // The cursor stays where it is: a span that could not be read is read again, never skipped.
      if (!isOk(events)) throw new Error(`slots ${from}–${to} unreadable: ${events.error.technical}`);

      for (const entry of events.value) {
        try {
          await applyEvent(deps, entry);
        } catch (error) {
          // One bad event must not stall the cursor forever, and must not be silent either.
          log(`${entry.event.kind} at ${entry.blockNumber}#${entry.logIndex} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      cursor = to;
      await writeCursor(name, to);
      seen += events.value.length;
      if (events.value.length > 0) log(`slots ${from}–${to}: ${events.value.length} event(s) · ${events.value.map((e) => e.event.kind).join(", ")}`);
    }
    return `projected to slot ${cursor}${seen > 0 ? `, ${seen} event(s) over ${spans} span(s)` : ""}`;
  }

  // One pass at a time (`runActor`): a catch-up that walks many spans must never overlap the next poll and
  // project the same events twice. Backoff on failure, and a heartbeat in `/health` either way.
  runActor({ name: "duel-projector", log, dryRun: false, everyMs: POLL_MS, pass: async () => ({ why: await cycle() }) });
}
