import { AGENT_CADENCES_SEC, AGENT_PERSONA_MAX_CHARS, type RunnerHealthKind } from "@masayume/core/strategies";
import { z } from "zod";

/** Wire shape of `/api/strategies` — base units travel as decimal strings, never floats. */
const capsSchema = z.object({ maxStakePerTradeBase: z.string(), maxDailySpendBase: z.string(), maxOpenPositions: z.number(), maxPriceRaw: z.string() });

/** One Window an agent read, as the card and the drawer show it; the outcome is the Window's own settlement. */
export const decisionWireSchema = z.object({
  marketId: z.string(),
  decidedAtMs: z.number(),
  verdictSide: z.enum(["up", "down", "hold", "none"]),
  confidence: z.number().nullable(),
  why: z.string(),
  gate: z.enum(["trade", "held", "failed"]),
  gateReason: z.string(),
  side: z.enum(["up", "down"]).nullable(),
  filled: z.number(),
  model: z.string(),
  /** The Window's cadence, read off the market; null when the Window could not be read. */
  intervalSec: z.number().nullable(),
  asset: z.string().nullable().optional(),
  outcome: z.enum(["won", "lost", "void", "open"]).nullable(),
});

/** Null for a momentum/reversion spec; for an agent, the model that last answered and its last Windows. */
export const agentWireSchema = z.object({ model: z.string().nullable(), decisions: z.array(decisionWireSchema).max(8) });

export const strategyWireSchema = z.object({
  strategyId: z.string(),
  creator: z.string(),
  runner: z.string(),
  specHash: z.string(),
  metadata: z.string(),
  envelope: capsSchema,
  feeBase: z.string(),
  active: z.boolean(),
  createdAtSec: z.number(),
  subscribers: z.number(),
  revision: z.number(),
  record: z.object({
    fills: z.number(),
    settled: z.number(),
    wins: z.number(),
    losses: z.number(),
    voids: z.number(),
    netBase: z.string(),
    stakedBase: z.string(),
    curve: z.array(z.object({ atSec: z.number(), cumBase: z.string() })),
    lastActiveSec: z.number(),
    distinctSubscribers: z.number(),
    /** Median cost of a fill so far, base units — the join floor reads off it. */
    typicalCostBase: z.string(),
  }),
  playbook: z.string().nullable(),
  health: z.object({ kind: z.enum(["never-started", "alive", "stale", "unknown"]), lastTickMs: z.number().nullable(), intervalMs: z.number().nullable(), why: z.string().nullable() }),
  agent: agentWireSchema.nullable(),
});

export const fillWireSchema = z.object({
  txHash: z.string(),
  strategyId: z.string(),
  owner: z.string(),
  marketId: z.string(),
  side: z.enum(["up", "down"]),
  cashDeltaBase: z.string(),
  tokenDeltaRaw: z.string(),
  atSec: z.number(),
  settled: z.boolean(),
  payoutBase: z.string().nullable(),
});

export const strategiesPayloadSchema = z.object({
  deployed: z.boolean(),
  strategies: z.array(strategyWireSchema),
  fills: z.array(fillWireSchema),
  /** Which off-chain stores answered; false says "not connected", never "empty". */
  stores: z.object({ fills: z.boolean(), heartbeats: z.boolean(), decisions: z.boolean() }),
  decimals: z.number(),
  symbol: z.string(),
  asset: z.string(),
  computedAtMs: z.number(),
});

export type StrategyWire = z.infer<typeof strategyWireSchema>;
export type DecisionWire = z.infer<typeof decisionWireSchema>;
export type FillWire = z.infer<typeof fillWireSchema>;
export type StrategiesPayload = z.infer<typeof strategiesPayloadSchema>;
export type HealthKind = RunnerHealthKind;

export const healthPayloadSchema = z.object({
  reachable: z.boolean(),
  strategies: z.record(z.string(), z.object({ kind: z.enum(["never-started", "alive", "stale", "unknown"]), lastTickMs: z.number().nullable(), intervalMs: z.number().nullable(), why: z.string().nullable(), recent: z.array(z.object({ tickAtMs: z.number(), why: z.string() })) })),
  computedAtMs: z.number(),
});
export type HealthPayload = z.infer<typeof healthPayloadSchema>;

/** The creator signs this exact text to publish a plain-text playbook; the route re-derives it. */
export function playbookMessage(strategyId: string, creator: string, issuedAtMs: number, body: string): string {
  return ["Masayume playbook", `Strategy: ${strategyId}`, `Creator: ${creator.toLowerCase()}`, `Issued: ${issuedAtMs}`, "", body].join("\n");
}

export const playbookRequestSchema = z.object({
  strategyId: z.string().regex(/^\d+$/),
  creator: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  issuedAtMs: z.number().int(),
  body: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/** The studio's dry read: the draft's brief, posture and cadences, and the per-trade stake the books are quoted at. */
export const agentPreviewRequestSchema = z.object({
  persona: z.string().trim().min(1).max(AGENT_PERSONA_MAX_CHARS),
  posture: z.enum(["guarded", "balanced", "active"]),
  cadences: z
    .array(z.number().int().refine((c) => AGENT_CADENCES_SEC.includes(c)))
    .min(1)
    .max(AGENT_CADENCES_SEC.length),
  /** Base units as a decimal string; the studio's "most per trade". */
  stakeBase: z.string().regex(/^\d+$/),
});
export type AgentPreviewRequest = z.infer<typeof agentPreviewRequestSchema>;

export const agentPreviewResponseSchema = z.object({
  market: z.object({ marketId: z.string(), asset: z.string(), intervalSec: z.number(), elapsedSec: z.number(), leftSec: z.number(), inSlot: z.boolean() }),
  /** What the Window looked like when the model read it — the print and the move as text, both books in cents. */
  read: z.object({ openingText: z.string(), moveBps: z.number(), upCents: z.number().nullable(), downCents: z.number().nullable() }),
  verdict: z.object({ side: z.enum(["up", "down", "hold"]), confidence: z.number(), why: z.string() }).nullable(),
  failure: z.string().nullable(),
  gate: z.object({ side: z.enum(["up", "down"]).nullable(), reason: z.string() }),
  model: z.string(),
  promptHash: z.string(),
});
export type AgentPreviewResponse = z.infer<typeof agentPreviewResponseSchema>;
