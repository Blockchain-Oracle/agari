import { decideAgentWindow, missingCredentialHint, resolveModel } from "@masayume/brain";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { decisionSlot, EMPTY_AGENT_RECORD, isSpec, moveBps, type AgentSpec } from "@masayume/core/strategies";
import type { EventMarket } from "@masayume/core/types";
import { formatBaseUnits, msToSec } from "@masayume/core/units";
import { ensureMarkets, marketsProvider, parseMarketsEnv, resolveVenueId } from "@masayume/markets";
import { readAgentContext } from "@masayume/markets/strategies";
import { STRATEGIES } from "./copy";
import type { AgentPreviewRequest, AgentPreviewResponse } from "./protocol";

const DRY = STRATEGIES.studio.agent.dry;
/** Every click is a real model call, so: one per ten seconds per address, sixty an hour in all. */
const MIN_GAP_MS = 10_000;
const PER_HOUR = 60;
const HOUR_MS = 3_600_000;
/** The preview gate needs a daily cap; with an empty record it never trips, so ten trades' worth is plenty. */
const DAILY_MULTIPLE = 10n;

const lastByIp = new Map<string, number>();
let hourHits: number[] = [];

export type PreviewOutcome = { ok: true; body: AgentPreviewResponse } | { ok: false; status: 400 | 429 | 502 | 503; error: string };

/** The limiter, in memory: an address every ten seconds, and a house-wide hourly budget. */
export function previewGate(ip: string, nowMs: number): { ok: true } | { ok: false; error: string } {
  const last = lastByIp.get(ip) ?? 0;
  if (nowMs - last < MIN_GAP_MS) return { ok: false, error: DRY.tooFast };
  hourHits = hourHits.filter((at) => nowMs - at < HOUR_MS);
  if (hourHits.length >= PER_HOUR) return { ok: false, error: DRY.busy };
  lastByIp.set(ip, nowMs);
  hourHits.push(nowMs);
  return { ok: true };
}

/** The nearest decidable Window on the draft's cadences — else the soonest with a print, read outside its slot and labelled so. */
function pickWindow(markets: EventMarket[], cadences: number[], nowMs: number): { market: EventMarket; inSlot: boolean } | null {
  const trading = markets.filter((m) => cadences.includes(m.intervalSec) && phase(m, nowMs) === "trading");
  const inSlot = trading.filter((m) => decisionSlot(m, nowMs).open).sort((a, b) => a.intervalSec - b.intervalSec)[0];
  if (inSlot) return { market: inSlot, inSlot: true };
  const soonest = [...trading].sort((a, b) => a.expirySec - b.expirySec)[0];
  return soonest ? { market: soonest, inSlot: false } : null;
}

/**
 * The studio's dry read: the same `decideAgentWindow` the runner calls, on a live Window, with an
 * empty record — one real model call, nothing sent, nothing stored. It answers the not-configured
 * state by naming the missing variable, exactly as the runner's heartbeat would.
 */
export async function dryReadAgent(request: AgentPreviewRequest, nowMs: number): Promise<PreviewOutcome> {
  const brain = resolveModel();
  if (!brain) return { ok: false, status: 503, error: DRY.notConfigured(missingCredentialHint()) };
  const spec: AgentSpec = { preset: "agent", persona: request.persona.trim(), posture: request.posture, cadences: [...new Set(request.cadences)].sort((a, b) => a - b) };
  if (!isSpec(spec)) return { ok: false, status: 400, error: DRY.badRequest };

  const marketsEnv = parseMarketsEnv({ venueId: process.env.NEXT_PUBLIC_VENUE_ID });
  ensureMarkets(marketsEnv);
  const venue = await resolveVenueId(marketsEnv.venueId);
  if (!isOk(venue) || !venue.value.venueId) return { ok: false, status: 502, error: DRY.unreadable };
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) return { ok: false, status: 502, error: DRY.unreadable };
  const picked = pickWindow(lanes.value.lanes.flatMap((lane) => lane.markets), spec.cadences, nowMs);
  if (!picked) return { ok: false, status: 503, error: DRY.noWindow };

  const stakeBase = BigInt(request.stakeBase);
  const context = await readAgentContext(picked.market, stakeBase, nowMs);
  if (!isOk(context)) return { ok: false, status: 502, error: DRY.unreadable };
  const envelope = { maxStakePerTradeBase: stakeBase, maxDailySpendBase: stakeBase * DAILY_MULTIPLE, maxOpenPositions: 2, maxPriceRaw: 0n };
  const result = await decideAgentWindow({ spec, context: context.value, record: EMPTY_AGENT_RECORD, envelope, nowSec: msToSec(nowMs), model: brain.model });
  const { read, decision } = result;
  return {
    ok: true,
    body: {
      market: { marketId: picked.market.marketId, asset: picked.market.asset, intervalSec: picked.market.intervalSec, elapsedSec: context.value.elapsedSec, leftSec: context.value.leftSec, inSlot: picked.inSlot },
      read: {
        openingText: formatBaseUnits(context.value.openingRaw, context.value.feedDecimals, { maxDp: 2, minDp: 2 }),
        moveBps: moveBps(context.value.openingRaw, context.value.emaRaw),
        upCents: context.value.upCents,
        downCents: context.value.downCents,
      },
      verdict: read.ok ? read.verdict : null,
      failure: read.ok ? null : `${read.failure}: ${read.detail}`,
      gate: { side: decision.side, reason: decision.reason },
      model: read.ok ? read.modelId : `${brain.providerName}/${brain.modelId}`,
      promptHash: result.promptHash,
    },
  };
}
