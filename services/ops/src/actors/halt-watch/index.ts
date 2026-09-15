/**
 * halt-watch (session-lanes.md §3.1, D-057): Pyth confidence and staleness, RedStone staleness, the xStocks issuer flag
 * and token-quote failures → the process's halt board. It is the board's only writer and never signs: the roller
 * lists nothing for a halted asset, the maker pulls, the ticket shows `halted`, and an open Window voids by itself.
 *
 * Stock lanes are watched in regular hours only (after a short boot grace, so a source not yet read isn't a halt);
 * the token lane always. A change needs two observations in a row (the issuer flag one), so one late tick or one failed
 * read never flips a lane. `HALT_WATCH_FIXTURE=<json>` injects raw observations for a proof run (`fixture.ts`).
 */
import { HALT_ASSETS, haltLabel, primarySourceAt, TICKER_SYMBOLS, XSTOCK_SYMBOLS } from "@agari/core/market";
import { runActor, type PassResult, type VenueDeps } from "../../runtime";
import { loadRelaySources } from "../price-relay/sources";
import { emptyHaltState, observeHalts, stepHalts, type Observations } from "./decide";
import { applyFixture, loadHaltFixture } from "./fixture";
import { quoteFailureStreak } from "./quote-failures";
import { emptySignals, followSpot, ISSUER_READ_MS, loadSourceVersions, readIssuer, readPyth, readRedstone, REDSTONE_OWN_READ_MS } from "./signals";

const PASS_MS = 5_000;
/** Seconds after boot before an unread stock source can halt: the spot feed's first RedStone read lands within ≈ 5 s. */
const BOOT_GRACE_SEC = 20;
const IN_HOURS = new Set(["regular", "early-close", "halted"]);

const hhmmss = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19);

export async function startHaltWatch(deps: VenueDeps): Promise<{ stop: () => void }> {
  const sources = loadRelaySources();
  const versions = loadSourceVersions();
  const pythKey = process.env.PYTH_API_KEY || undefined;
  const fixture = loadHaltFixture(process.env.HALT_WATCH_FIXTURE);
  const startedSec = Math.floor(Date.now() / 1000);
  const book = emptySignals();
  const state = emptyHaltState();
  const unfollow = deps.spot ? followSpot(book, deps.spot) : null;
  let redstoneReadMs = 0;
  let issuerReadMs = 0;
  if (fixture) deps.log(`FIXTURE ${fixture.name}: injected observations replace live ones for the assets it names`);

  const pass = async (): Promise<PassResult> => {
    const calendarNote = await deps.sessions.refresh();
    const nowSec = Math.floor(Date.now() / 1000);
    const status = deps.sessions.status(nowSec);
    const inHours = fixture?.session === "regular" || (status !== null && IN_HOURS.has(status.state));
    const watchingStocks = inHours && nowSec - startedSec >= BOOT_GRACE_SEC;

    book.problems = [];
    const reads: Promise<void>[] = [];
    if (inHours) {
      reads.push(readPyth(book, sources.pythFeeds, pythKey));
      if (!deps.spot && Date.now() - redstoneReadMs >= REDSTONE_OWN_READ_MS) {
        redstoneReadMs = Date.now();
        reads.push(readRedstone(book, sources));
      }
    }
    if (Date.now() - issuerReadMs >= ISSUER_READ_MS) {
      issuerReadMs = Date.now();
      reads.push(readIssuer(book));
    }
    await Promise.all(reads);

    const observations: Observations = {
      nowSec,
      inRegularHours: watchingStocks,
      primary: Object.fromEntries(TICKER_SYMBOLS.map((s) => [s, primarySourceAt(versions[s] ?? [], nowSec)])),
      pyth: { ...book.pyth },
      redstoneNewestSec: { ...book.redstoneNewestSec },
      issuer: { ...book.issuer },
      quoteFailures: Object.fromEntries(XSTOCK_SYMBOLS.map((x) => [x, quoteFailureStreak(x)])),
    };
    if (fixture) applyFixture(observations, fixture);
    const observed = observeHalts(observations);
    const confirmed = stepHalts(state, observed, observations.inRegularHours);
    for (const [asset, reason] of confirmed) {
      if (reason) deps.halts.set(asset, reason, nowSec);
      else deps.halts.clear(asset);
    }

    const board = deps.halts.board();
    const halted = HALT_ASSETS.flatMap((a) => (board[a] ? [`${a} ${board[a]!.reason} since ${hhmmss(board[a]!.sinceSec)}Z`] : []));
    const session = status?.state ?? "no calendar";
    const stocks = watchingStocks ? "stocks watched" : inHours ? "stocks: boot grace" : `stocks idle (${session})`;
    const issuerRead = XSTOCK_SYMBOLS.filter((x) => book.issuer[x] !== undefined).length;
    const problems = [...new Set(book.problems)];
    const why = [
      halted.length ? `halted: ${halted.join(", ")}` : "no halts",
      stocks,
      `issuer flags ${issuerRead}/${XSTOCK_SYMBOLS.length}`,
      ...(fixture ? [`FIXTURE ${fixture.name}`] : []),
      ...(calendarNote === "calendar fresh" ? [] : [calendarNote]),
      ...problems,
    ].join(" · ");
    const ages = (times: Partial<Record<string, number>>) => Object.fromEntries(Object.entries(times).map(([k, t]) => [k, nowSec - (t ?? nowSec)]));
    return {
      why,
      detail: {
        halts: board,
        labels: Object.fromEntries(Object.entries(board).map(([a, e]) => [a, haltLabel(e!.reason)])),
        session,
        watchingStocks,
        observed: Object.fromEntries(Object.entries(observed).filter(([, r]) => r !== null)),
        pending: Object.fromEntries([...state.streaks].filter(([, s]) => s !== null)),
        pythAgeSec: ages(Object.fromEntries(Object.entries(observations.pyth).map(([s, t]) => [s, t!.publishTimeSec]))),
        pythConfBps: Object.fromEntries(Object.entries(observations.pyth).map(([s, t]) => [s, t!.price > 0n ? Number((t!.conf * 10_000n) / t!.price) : null])),
        redstoneAgeSec: ages(observations.redstoneNewestSec),
        issuer: observations.issuer,
        quoteFailures: observations.quoteFailures,
        redstoneFrom: deps.spot ? "spot feed" : "own read",
        fixture: fixture?.name ?? null,
        problems,
      },
    };
  };

  const actor = runActor({ name: "halt-watch", log: deps.log, dryRun: false, everyMs: PASS_MS, pass });
  return {
    stop: () => {
      unfollow?.();
      actor.stop();
    },
  };
}
