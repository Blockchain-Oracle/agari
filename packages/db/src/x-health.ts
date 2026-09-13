import { z } from "zod";
import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import { xRelayStateGet, xRelayStateSet } from "./x";

export type XHealthStage = "polling" | "execution" | "delivery";
const stageSchema = z.object({
  state: z.enum(["ok", "idle", "error", "disabled"]),
  checkedAtMs: z.number().int().nonnegative(),
  succeededAtMs: z.number().int().nonnegative().nullable(),
  imagesEnabled: z.boolean().optional(),
});
export type XStageHealth = z.infer<typeof stageSchema>;
export interface XRelayHealth {
  polling: XStageHealth | null;
  execution: XStageHealth | null;
  delivery: XStageHealth | null;
  unresolvedExecutions: number;
  deliveryNeedsInspection: number;
  lastImageReplyAtMs: number | null;
}

function readStage(value: string | null): XStageHealth | null {
  try { const parsed = stageSchema.safeParse(JSON.parse(value ?? "null")); return parsed.success ? parsed.data : null; }
  catch { return null; }
}

/** Only bounded operational facts are public; provider exceptions and account credentials never enter health. */
export async function xSetStageHealth(stage: XHealthStage, state: XStageHealth["state"], imagesEnabled?: boolean): Promise<void> {
  const key = `health.${stage}`;
  const previous = readStage(await xRelayStateGet(key));
  const now = Date.now();
  await xRelayStateSet(key, JSON.stringify({ state, checkedAtMs: now,
    succeededAtMs: state === "ok" ? now : previous?.succeededAtMs ?? null,
    ...(imagesEnabled !== undefined ? { imagesEnabled } : {}),
  } satisfies XStageHealth));
}

export async function xGetRelayHealth(): Promise<XRelayHealth | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [stages, [totals]] = await Promise.all([
    db<{ key: string; value: string }[]>`SELECT key, value FROM x_relay_state WHERE key IN ('health.polling', 'health.execution', 'health.delivery')`,
    db<{ unresolved: string; inspection: string; image_at: Date | null }[]>`
      SELECT (SELECT count(*) FROM x_receipts r
        WHERE (r.status = 'unknown' OR (r.status = 'submitted' AND r.updated_at < now() - interval '5 minutes'))
          AND NOT EXISTS (SELECT 1 FROM x_reply_delivery d WHERE d.reply_id = r.mention_id)) AS unresolved,
        (SELECT count(*) FROM x_reply_delivery
          WHERE (state IN ('unknown','failed') OR (state = 'posting' AND updated_at < now() - interval '5 minutes'))
            AND error_code IS DISTINCT FROM 'relay-reply-suppressed') AS inspection,
        (SELECT max(updated_at) FROM x_reply_delivery WHERE state = 'sent' AND media_id IS NOT NULL) AS image_at
    `,
  ]);
  const stage = (name: XHealthStage) => readStage(stages.find(s => s.key === `health.${name}`)?.value ?? null);
  return { polling: stage("polling"), execution: stage("execution"), delivery: stage("delivery"),
    unresolvedExecutions: Number(totals?.unresolved ?? 0), deliveryNeedsInspection: Number(totals?.inspection ?? 0),
    lastImageReplyAtMs: totals?.image_at?.getTime() ?? null };
}
