import { z } from "zod";

/**
 * What `/api/status` answers with — shared by the route and the screen so the two
 * cannot drift. Every figure is measured at read time; nothing here is cached.
 */
export const OVERALL_STATES = ["healthy", "degraded", "unreachable"] as const;
export type OverallState = (typeof OVERALL_STATES)[number];

export const statusPipelineSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** The probe answered, and answered fresh — a held-over last-good reading is not "ok" here. */
  ok: z.boolean(),
  /** Seconds behind the wall clock, where the dependency has a clock of its own to lag by. */
  lagSec: z.number().nullable(),
  latencyMs: z.number().nullable(),
  detail: z.string(),
  /** A capability the product runs without (the social store, Sensei) — never degrades the overall figure. */
  optional: z.boolean(),
  /** False when an optional capability is simply not set up on this deployment, which is not a failure. */
  configured: z.boolean(),
});

export const statusPayloadSchema = z.object({
  checkedAtMs: z.number(),
  overall: z.enum(OVERALL_STATES),
  maxLagSec: z.number().nullable(),
  maxLagPipeline: z.string().nullable(),
  /** The chain head at read time — the reference's "checkpoint". */
  blockNumber: z.number().nullable(),
  pipelines: z.array(statusPipelineSchema),
});

export type StatusPipeline = z.infer<typeof statusPipelineSchema>;
export type StatusPayload = z.infer<typeof statusPayloadSchema>;

/** The reference's own threshold: under two minutes of lag is healthy (`app/status/page.tsx` L32). */
export const HEALTHY_LAG_SEC = 120;
/** The reference's row ladder: green under a minute, amber under five (L96–100). */
export const LAG_WARN_SEC = 60;
export const LAG_BAD_SEC = 300;

export type LagTone = "good" | "warn" | "bad" | "off";

export function lagTone(pipeline: StatusPipeline): LagTone {
  if (!pipeline.ok) return pipeline.optional && !pipeline.configured ? "off" : "bad";
  if (pipeline.lagSec === null) return "good";
  if (pipeline.lagSec < LAG_WARN_SEC) return "good";
  if (pipeline.lagSec < LAG_BAD_SEC) return "warn";
  return "bad";
}
