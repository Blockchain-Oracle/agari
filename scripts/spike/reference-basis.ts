import { runSpike, short, type Client } from "./lib/boot";
import { bullets, heading, table } from "./lib/markdown";
import { FEED_SCALE, deltaBps, fmtBps, fmtScaled, inferOracleScale, median, mode, pct, rescale } from "./lib/math";
import { cadenceLabel, loadSettledRounds, type SettledRound } from "./lib/rounds";

const ROUNDS_PER_CADENCE = 8;
const FEED_WINDOW_SEC = 60;
const EXACT_MATCH_TOLERANCE = 1n;
const ESCALATE_BPS = 5;
const ESCALATE_SHARE = 0.1;

type Tick = Awaited<ReturnType<Client["fetchPriceHistory"]>>[number];
type Basis = "spot" | "ema";

interface BoundaryRead {
  ticks: Tick[];
  atOrBefore: Tick | null;
}

interface BoundaryAnalysis {
  spotBps: number | null;
  emaBps: number | null;
  exact: { basis: Basis; offsetSec: number } | null;
}

async function readBoundary(client: Client, asset: string, boundarySec: number): Promise<BoundaryRead> {
  const ticks = await client.fetchPriceHistory(asset, {
    from: boundarySec - FEED_WINDOW_SEC,
    to: boundarySec + FEED_WINDOW_SEC,
    limit: 500,
  });
  const atOrBefore = ticks.filter((t) => t.blockTimestamp <= boundarySec).sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0] ?? null;
  return { ticks, atOrBefore };
}

function rawOf(tick: Tick, basis: Basis): bigint {
  return BigInt(basis === "spot" ? tick.raw.price : tick.raw.ema);
}

function closestExact(read: BoundaryRead, boundarySec: number, oracleRaw: bigint, scale: number): BoundaryAnalysis["exact"] {
  const hits: { basis: Basis; offsetSec: number }[] = [];
  for (const tick of read.ticks) {
    for (const basis of ["spot", "ema"] as const) {
      const diff = rescale(rawOf(tick, basis), FEED_SCALE, scale) - oracleRaw;
      if (diff <= EXACT_MATCH_TOLERANCE && diff >= -EXACT_MATCH_TOLERANCE) hits.push({ basis, offsetSec: tick.blockTimestamp - boundarySec });
    }
  }
  return hits.sort((a, b) => Math.abs(a.offsetSec) - Math.abs(b.offsetSec))[0] ?? null;
}

function analyze(read: BoundaryRead, boundarySec: number, oracleRaw: bigint, scale: number): BoundaryAnalysis {
  const oracle18 = rescale(oracleRaw, scale, FEED_SCALE);
  const tick = read.atOrBefore;
  return {
    spotBps: tick ? deltaBps(rawOf(tick, "spot"), oracle18) : null,
    emaBps: tick ? deltaBps(rawOf(tick, "ema"), oracle18) : null,
    exact: closestExact(read, boundarySec, oracleRaw, scale),
  };
}

function exactLabel(exact: BoundaryAnalysis["exact"]): string {
  return exact ? `${exact.basis}@${exact.offsetSec >= 0 ? "+" : ""}${exact.offsetSec}s` : "none";
}

function lastProbability(round: SettledRound): number | null {
  const { lastPrice, quoteDecimals } = round.market;
  return lastPrice ? Number(lastPrice) / 10 ** quoteDecimals : null;
}

interface RoundReport {
  round: SettledRound;
  open: BoundaryAnalysis;
  close: BoundaryAnalysis;
  openingPricesAgree: boolean;
  wentUp: boolean;
  winnerUp: boolean;
  lastProb: number | null;
}

function summarize(reports: RoundReport[], scale: number): string {
  const n = reports.length;
  const count = (pick: (r: RoundReport) => boolean) => reports.filter(pick).length;
  const absDeltas = (basis: Basis) =>
    reports.flatMap((r) => [r.open, r.close]).map((b) => (basis === "spot" ? b.spotBps : b.emaBps)).filter((v): v is number => v !== null).map(Math.abs);
  const exactCount = (basis: Basis) => reports.flatMap((r) => [r.open, r.close]).filter((b) => b.exact?.basis === basis).length;
  const spotExact = exactCount("spot");
  const emaExact = exactCount("ema");
  const spotMedian = median(absDeltas("spot"));
  const emaMedian = median(absDeltas("ema"));
  const basis: Basis = spotExact !== emaExact ? (spotExact > emaExact ? "spot" : "ema") : (spotMedian ?? Infinity) <= (emaMedian ?? Infinity) ? "spot" : "ema";
  const offBasis = count((r) => [r.open, r.close].some((b) => Math.abs((basis === "spot" ? b.spotBps : b.emaBps) ?? 0) > ESCALATE_BPS));
  const lags = reports.map((r) => (r.round.resolvedAtSec ?? NaN) - r.round.expirySec).filter((v) => Number.isFinite(v));
  const bookAgrees = count((r) => r.lastProb !== null && r.lastProb >= 0.5 === r.winnerUp);
  const withBook = count((r) => r.lastProb !== null);
  const meanEdge = withBook ? reports.filter((r) => r.lastProb !== null).reduce((s, r) => s + Math.abs((r.lastProb as number) - 0.5), 0) / withBook : null;

  const lines = [
    `rounds analysed: ${n} (${[...new Set(reports.map((r) => cadenceLabel(r.round.market)))].join(", ")})`,
    `getOpeningPrices == openingAnswer.numericValue: ${count((r) => r.openingPricesAgree)}/${n}`,
    `exact feed match at a boundary — spot: ${spotExact}/${2 * n}, ema: ${emaExact}/${2 * n}`,
    `median |Δ| at the tick at-or-before the boundary — spot: ${spotMedian?.toFixed(2) ?? "—"} bps, ema: ${emaMedian?.toFixed(2) ?? "—"} bps`,
    `max |Δ| — spot: ${Math.max(...absDeltas("spot"), 0).toFixed(2)} bps, ema: ${Math.max(...absDeltas("ema"), 0).toFixed(2)} bps`,
    `winner == (closing ≥ opening): ${count((r) => r.wentUp === r.winnerUp)}/${n}`,
    `median resolve lag after expiry: ${median(lags)?.toFixed(0) ?? "—"} s`,
    `book vs outcome — last traded P(up) on the winning side: ${bookAgrees}/${withBook}; mean |P(up) − 0.5| = ${meanEdge?.toFixed(3) ?? "—"}`,
  ];
  const decisions = [
    `PRICE_BASIS = ${basis}`,
    `ORACLE_PRICE_SCALE = ${scale}`,
    offBasis / n > ESCALATE_SHARE
      ? `ESCALATE: chronic disagreement — ${offBasis}/${n} rounds off by > ${ESCALATE_BPS} bps on the ${basis} basis (FR-23 demo risk)`
      : `no escalation: ${offBasis}/${n} rounds off by > ${ESCALATE_BPS} bps on the ${basis} basis (${pct(offBasis, n)} ≤ ${ESCALATE_SHARE * 100}%)`,
  ];
  return `${heading(2, "Summary")}${bullets(lines)}\n${heading(2, "Decision")}${bullets(decisions)}`;
}

await runSpike(async ({ client, env }) => {
  const rounds = await loadSettledRounds(client, env.venueId, ROUNDS_PER_CADENCE);
  if (rounds.length === 0) throw new Error(`no settled up/down rounds with both oracle answers on venue ${env.venueId}`);

  const openingPrices = await client.getOpeningPrices(rounds.map((r) => r.market.marketId));
  const reads = await Promise.all(
    rounds.map(async (round) => ({
      open: await readBoundary(client, round.market.asset, round.tradingStartSec),
      close: await readBoundary(client, round.market.asset, round.expirySec),
    })),
  );
  const scaleVotes = rounds.flatMap((round, i) => {
    const tick = reads[i]?.open.atOrBefore;
    return tick ? [inferOracleScale(round.openingRaw, BigInt(tick.raw.price))] : [];
  });
  const scale = mode(scaleVotes) ?? FEED_SCALE;

  const reports: RoundReport[] = rounds.map((round, i) => {
    const read = reads[i] as (typeof reads)[number];
    return {
      round,
      open: analyze(read.open, round.tradingStartSec, round.openingRaw, scale),
      close: analyze(read.close, round.expirySec, round.closingRaw, scale),
      openingPricesAgree: openingPrices[round.market.marketId.toLowerCase()] === round.openingRaw.toString(),
      wentUp: round.closingRaw >= round.openingRaw,
      winnerUp: round.market.winningOutcome === 0,
      lastProb: lastProbability(round),
    };
  });

  console.log(heading(1, `Reference basis — venue ${short(env.venueId)} — ${new Date().toISOString()}`));
  console.log(
    table(
      ["market", "asset", "cadence", "open (oracle)", "Δspot", "Δema", "exact", "close (oracle)", "Δspot", "Δema", "exact", "winner", "sign ok", "last P(up)", "lag s"],
      reports.map(({ round, open, close, wentUp, winnerUp, lastProb }) => [
        short(round.market.marketId),
        round.market.asset,
        cadenceLabel(round.market),
        fmtScaled(round.openingRaw, scale),
        fmtBps(open.spotBps),
        fmtBps(open.emaBps),
        exactLabel(open.exact),
        fmtScaled(round.closingRaw, scale),
        fmtBps(close.spotBps),
        fmtBps(close.emaBps),
        exactLabel(close.exact),
        winnerUp ? "UP" : "DOWN",
        wentUp === winnerUp,
        lastProb?.toFixed(2) ?? null,
        round.resolvedAtSec === null ? null : round.resolvedAtSec - round.expirySec,
      ]),
    ),
  );
  console.log(summarize(reports, scale));
});
