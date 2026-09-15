"use client";

import type { PrintWhich, ReplayState } from "@agari/markets";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PROOF } from "./copy";

type RefusalCode = keyof typeof PROOF.replayRefused;

/**
 * "Re-verify on devnet": asks the server to post the archived update again as `proof-replay` (POST /api/proof/pyth,
 * idempotent per boundary, quota-limited), then the proof read polls every 3 s until the row settles.
 */
export function ReverifyButton({ marketId, which, state, onStarted }: { marketId: string; which: PrintWhich; state: ReplayState | null; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const posting = state === "posting";
  // An open verified account is its own proof; a closed or failed one can be posted again.
  const disabled = busy || posting || state === "verified";

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/proof/pyth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market: marketId, which }) });
      if (response.ok) {
        onStarted();
        return;
      }
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      const code = (body?.code && body.code in PROOF.replayRefused ? body.code : "failed") as RefusalCode;
      setNote(PROOF.replayRefused[code]);
    } catch {
      setNote(PROOF.replayRefused.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proof-reverify">
      <Button variant="secondary" size="xs" disabled={disabled} aria-busy={busy || posting} onClick={() => void start()}>
        {busy || posting ? PROOF.reverifying : PROOF.reverify}
      </Button>
      {note && <span className="type-caption text-warning">{note}</span>}
    </div>
  );
}
