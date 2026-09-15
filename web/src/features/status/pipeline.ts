import type { Verdict } from "./grade";
import type { StatusPipeline } from "./protocol";

const DETAIL_MAX = 240;

export interface RowReading {
  verdict: Verdict;
  detail: string;
  lagSec?: number | null;
  latencyMs?: number | null;
  optional?: boolean;
  configured?: boolean;
  /** Session-bound and outside regular hours: a reading that is not bad reads "closed (expected)". */
  offHours?: boolean;
  /** Keep the reference's lag ladder instead of the row's own verdict (RPC and spot prices). */
  ladder?: boolean;
}

/** A judged reading → the wire row. Bad is `ok: false`; an off-hours reading that is not bad becomes `expected`. */
export function pipelineRow(id: string, label: string, r: RowReading): StatusPipeline {
  const ok = r.verdict !== "bad";
  const expected = ok && (r.offHours ?? false);
  return {
    id,
    label,
    ok,
    lagSec: expected ? null : (r.lagSec ?? null),
    latencyMs: r.latencyMs ?? null,
    detail: r.detail.slice(0, DETAIL_MAX),
    optional: r.optional ?? false,
    configured: r.configured ?? true,
    expected,
    grade: ok && !expected && !r.ladder ? (r.verdict as "good" | "warn") : null,
  };
}

/** An optional capability not set up on this deployment: the reference's grey "optional" row. */
export function notConfiguredRow(id: string, label: string, detail: string): StatusPipeline {
  return { id, label, ok: false, lagSec: null, latencyMs: null, detail, optional: true, configured: false, expected: false, grade: null };
}

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 200);
