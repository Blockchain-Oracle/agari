"use client";

import { useCallback } from "react";
import { booleanCodec, usePersistedState } from "@/lib/persisted";

const FIRST_RUN_KEY = "masayume.tutorialSeen";

export interface FirstRun {
  /** False until localStorage has been read, so the server and first client render agree. */
  open: boolean;
  dismiss: () => void;
}

/**
 * First visit or not — the reference's `yosuku_tutorial_seen` flag (Tutorial.tsx L8, L49–59).
 *
 * `usePersistedState` hydrates after mount, so nothing renders on the server and
 * a returning visitor never sees a frame of the modal. Blocked storage keeps the
 * default, which means the walkthrough reappears next visit rather than being
 * suppressed by a write that never landed — the reference degrades the same way.
 */
export function useFirstRun(): FirstRun {
  const [seen, setSeen, hydrated] = usePersistedState(FIRST_RUN_KEY, false, booleanCodec);
  const dismiss = useCallback(() => setSeen(true), [setSeen]);
  return { open: hydrated && !seen, dismiss };
}
