import { z } from "zod";

/**
 * Ops HTTP for `/status` (venue-ops.md §2.3, first-call.md §6): `GET /health` and `GET /session`, fetched once per run and
 * shared by every row that reads them. Schemas keep only what the probes use and pass the rest through, so an additive
 * ops field never breaks the page.
 */
const OPS_TIMEOUT_MS = 5_000;

const tradingSessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number(), earlyClose: z.boolean() });
const pythIndexEntitlementSchema = z.object({ state: z.enum(["entitled", "denied", "unknown"]), status: z.number().nullable(), checkedAtSec: z.number().nullable(), reason: z.string().nullable() });

const sessionBodySchema = z.object({
  nowSec: z.number(),
  status: z.object({ state: z.string(), session: tradingSessionSchema.nullable() }).passthrough().nullable(),
  label: z.string().nullable(),
  calendar: z
    .object({ upcoming: z.array(tradingSessionSchema), recent: z.array(tradingSessionSchema).default([]) })
    .passthrough()
    .nullable(),
  lanes: z.record(z.string(), z.string()),
  sources: z
    .object({
      pythTrialLastCloseSec: z.number().nullable(),
      /** S20 (D-125): per pre-IPO name, whether the key may read Pyth's valuation index, from ops' live store. */
      pythIndex: z.record(z.string(), pythIndexEntitlementSchema).default({}),
    })
    .default({ pythTrialLastCloseSec: null, pythIndex: {} }),
});

const heartbeatSchema = z.object({
  actor: z.string(),
  everyMs: z.number(),
  startedMs: z.number(),
  lastOkMs: z.number().nullable(),
  lastWhy: z.string(),
  failures: z.number(),
  detail: z.record(z.string(), z.unknown()),
});

const healthBodySchema = z.object({ ok: z.boolean(), nowMs: z.number(), actors: z.array(heartbeatSchema) });

export type OpsSession = z.infer<typeof sessionBodySchema>;
export type OpsPythIndexEntitlement = z.infer<typeof pythIndexEntitlementSchema>;
export type OpsHealth = z.infer<typeof healthBodySchema>;
export type OpsHeartbeat = z.infer<typeof heartbeatSchema>;
export type TradingSessionWire = z.infer<typeof tradingSessionSchema>;

export type OpsRead<T> = { ok: true; value: T; latencyMs: number } | { ok: false; why: string; latencyMs: number };

async function readOps<T>(base: string | undefined, path: string, schema: z.ZodType<T>): Promise<OpsRead<T>> {
  const startedMs = Date.now();
  const failed = (why: string): OpsRead<T> => ({ ok: false, why: `ops ${path}: ${why}`.slice(0, 200), latencyMs: Date.now() - startedMs });
  if (!base) return failed("NEXT_PUBLIC_PRICE_FEED_URL is not set");
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { cache: "no-store", signal: AbortSignal.timeout(OPS_TIMEOUT_MS) });
    if (!response.ok) return failed(`answered ${response.status}`);
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) return failed("body did not parse");
    return { ok: true, value: parsed.data, latencyMs: Date.now() - startedMs };
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
}

export const readOpsHealth = (base: string | undefined) => readOps(base, "/health", healthBodySchema);
export const readOpsSession = (base: string | undefined) => readOps(base, "/session", sessionBodySchema);

export function heartbeatOf(health: OpsHealth, actor: string): OpsHeartbeat | null {
  return health.actors.find((beat) => beat.actor === actor) ?? null;
}

/** A counter or reading out of a heartbeat's free-form `detail`. */
export function detailNumber(beat: OpsHeartbeat | null, key: string): number | null {
  const value = beat?.detail[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function detailString(beat: OpsHeartbeat | null, key: string): string | null {
  const value = beat?.detail[key];
  return typeof value === "string" ? value : null;
}
