import type { Reading } from "@agari/core/schemas";
import { useEffect, useState } from "react";
import { lagTone, type LagTone, type StatusPayload } from "@/features/status/protocol";

/** How many checks the strip keeps: 24 × 30 s is the last twelve minutes on screen. */
const KEEP = 24;

export interface Check {
  atMs: number;
  overall: StatusPayload["overall"];
  /** Each pipeline's tone at that check, by id. */
  tones: Readonly<Record<string, LagTone>>;
}

/**
 * The probes this screen has actually seen since it opened — one entry per answer from `/api/status` (web polls it
 * every 30 s). Nothing is back-filled: the strip starts with one bar and grows while you watch.
 */
export function useCheckHistory(reading: Reading<StatusPayload> | null): readonly Check[] {
  const [checks, setChecks] = useState<readonly Check[]>([]);
  const payload = reading?.ok ? reading.value : null;
  useEffect(() => {
    if (!payload) return;
    setChecks((prior) => {
      if (prior.at(-1)?.atMs === payload.checkedAtMs) return prior;
      const tones = Object.fromEntries(payload.pipelines.map((pipeline) => [pipeline.id, lagTone(pipeline)]));
      return [...prior, { atMs: payload.checkedAtMs, overall: payload.overall, tones }].slice(-KEEP);
    });
  }, [payload]);
  return checks;
}
