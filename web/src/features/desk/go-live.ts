import { z } from "zod";

/**
 * Go live's stage machine (plan §5.4 step 04, §5.5): four owner steps on Solana mainnet, each resumable. The stage
 * is written to this browser BEFORE each confirmation, so a closed tab or a wallet that took a minute to answer
 * never starts a step twice: on return the flow reads the chain first (does the desk exist? are the names allowed?)
 * and only then asks for a signature.
 */
export const LIVE_STAGES = ["open-pending", "allow-pending", "mandate-pending", "deposit-pending"] as const;
export type LiveStage = (typeof LIVE_STAGES)[number];

export const liveProgressSchema = z.object({
  owner: z.string(),
  stage: z.enum(LIVE_STAGES),
  operator: z.string(),
  mode: z.enum(["ask_first", "on_its_own"]),
  openTx: z.string().nullable(),
  allowTx: z.string().nullable(),
  address: z.string().nullable(),
  startedAtSec: z.number().int(),
});
export type LiveProgress = z.infer<typeof liveProgressSchema>;

/** Base58 is case-sensitive: the key keeps the owner exactly as written (D-010). Cluster 101 = mainnet. */
export const liveProgressKey = (owner: string): string => `agari.desk.go-live:101:${owner}`;

export function parseLiveProgress(raw: string | null): LiveProgress | null {
  try {
    const result = liveProgressSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function loadLiveProgress(owner: string): LiveProgress | null {
  try {
    return parseLiveProgress(window.localStorage.getItem(liveProgressKey(owner)));
  } catch {
    return null;
  }
}

export function saveLiveProgress(owner: string, progress: LiveProgress | null): void {
  try {
    if (progress) window.localStorage.setItem(liveProgressKey(owner), JSON.stringify(progress));
    else window.localStorage.removeItem(liveProgressKey(owner));
  } catch {
    // storage unavailable: the flow still runs in this session
  }
}

export const nextStage = (stage: LiveStage): LiveStage | null => LIVE_STAGES[LIVE_STAGES.indexOf(stage) + 1] ?? null;

/**
 * Where to resume from what the chain and the index say: a desk that already exists skips opening; one whose names
 * are all allowed skips allowing; a row that is already live skips the link. The saved stage never moves backwards.
 */
export function resumeStage(saved: LiveStage | null, facts: { deskExists: boolean; namesAllowed: boolean; rowIsLive: boolean }): LiveStage {
  const fromChain: LiveStage = facts.rowIsLive ? "deposit-pending" : facts.deskExists && facts.namesAllowed ? "mandate-pending" : facts.deskExists ? "allow-pending" : "open-pending";
  if (!saved) return fromChain;
  return LIVE_STAGES.indexOf(fromChain) > LIVE_STAGES.indexOf(saved) ? fromChain : saved;
}
