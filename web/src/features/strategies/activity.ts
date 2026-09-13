import { deriveRunnerHealth, type RunnerHealth } from "@masayume/core/strategies";
import { dailyHeadroomBase, type VaultGrant } from "@masayume/core/vault";
import type { CopyState } from "./lifecycle";

export interface StrategyActivity {
  label: string;
  detail: string;
  heartbeat: string;
  positions: string | null;
}

/** Permission is wallet-specific; a runner report covers the whole strategy. Never infer a
 * subscriber's fill from its aggregate counts, or an active operation from an old report. */
export function strategyActivityOf({ state, grant, health, nowMs }: {
  state: CopyState;
  /** Only the grant matching this subscription, from the current vault read. */
  grant: VaultGrant | null;
  /** Null when the heartbeat reading is stale, unreachable, or absent. */
  health: RunnerHealth | null;
  nowMs: number;
}): StrategyActivity {
  const current = health && health.kind !== "stale" && health.kind !== "unknown"
    ? deriveRunnerHealth({ ...health, nowMs, reachable: true }) : health;
  const heartbeat = !current || current.kind === "unknown" ? "Runner status unavailable"
    : current.kind === "never-started" ? "Waiting for the runner’s first check"
    : current.kind === "stale" ? "Runner heartbeat is late" : "Runner connected";
  const positions = state !== "checking" && grant && grant.openPositions > 0
    ? `${grant.openPositions} position${grant.openPositions === 1 ? " remains" : "s remain"} open. Settlement is separate from permission to make new trades.` : null;
  const result = (label: string, detail: string): StrategyActivity => ({ label, detail, heartbeat, positions });

  if (state === "checking") return result("Unavailable", "Your current permission has not been verified yet.");
  if (state === "not-copying") return result("Waiting for permission", "Fund a permission and subscribe before this strategy can trade for you.");
  if (state === "inactive") return result("Paused", "The creator has deactivated this strategy. It cannot make new entries.");
  if (state === "paused") return result("Paused", "Future copies are paused. Existing positions still need settlement.");
  if (state === "expired") return result("Expired", "This permission has expired. Review a new permission to resume future copies.");
  if (state === "replaced" || state === "runner-changed") return result("Waiting for permission", "This subscription no longer has a matching permission for the current runner.");
  if (state === "unfunded") return result("Budget exhausted", "No unspent budget remains in this permission. Existing positions settle separately.");

  const why = current?.kind === "alive" ? current.why ?? "" : "";
  if (/^confirmation unknown\b/.test(why)) return result("Held", "The runner reports an unconfirmed transaction. New submissions are held, and that transaction will not be resent.");
  if (grant && grant.caps.maxOpenPositions > 0 && grant.openPositions >= grant.caps.maxOpenPositions) {
    return result("Awaiting settlement", `Your ${grant.caps.maxOpenPositions}-position limit is reached. A position must settle before a new one can open.`);
  }
  if (grant && dailyHeadroomBase(grant, Math.floor(nowMs / 1000)) === 0n) return result("Held", "Your daily spending limit is used. It resets at 00:00 UTC.");
  if (!current || current.kind === "unknown" || current.kind === "stale") return result("Unavailable", "Your permission remains recorded, but the runner’s current operation cannot be verified.");
  if (current.kind === "never-started") return result("Waiting for the first check", "Permission is in place. This runner has not reported a scan yet.");

  // These are narrow recognizers for reports emitted by the current runner, not an API enum.
  // Unknown wording stays unknown, and the full timestamped report remains visible below.
  if (/^reading .+; awaiting the model's verdict$/.test(why)) return result("Reading a Window", "The runner last reported an AI read in progress. A verdict alone does not confirm a trade.");
  if (/^(?:lanes|strategy|subscriptions) unreadable:|^strategy execution and risk stores unavailable|^agent brain not configured|^metadata carries no readable spec/.test(why) || why.endsWith("no runner key configured, so nothing sent")) {
    return result("Unavailable", "The runner reports a missing dependency or unreadable data. See its report below.");
  }
  if (/^holding:|^risk memory unavailable/.test(why)) return result("Held", "The runner reports a hold. See its reason below before expecting another entry.");
  if (why === "published; waiting for a funded live subscriber") return result("Waiting for the next check", "The runner has not yet reported a funded live subscriber. Its next scan must pick up your permission.");
  const counts = why.match(/; (\d+) filled, (\d+) skipped( \(dry run\))?$/);
  if (counts?.[3]) return result("Dry run", "The runner is simulating this strategy. It is not sending trades.");
  if (counts && Number(counts[1]) > 0) return result("Filled in last scan", `The runner reports ${counts[1]} confirmed fill${counts[1] === "1" ? "" : "s"} across this strategy’s subscribers. Check Recent copy-trades for wallet receipts.`);
  if (counts && Number(counts[2]) > 0) return result("Held in last scan", "The last scan found signals but confirmed no new fills. Its aggregate report does not give each subscriber’s skip reason.");
  if (/^read \d+ of \d+ agent Windows/.test(why) && /\bheld\b/.test(why) && !/\bbets (?:up|down)\b/.test(why)) return result("Held in last read", "The last model scan held at least one Window. Other Windows may still be waiting for their decision slot.");
  if (/^scanned \d+ markets|^read \d+ of \d+ agent Windows|^no trading Windows/.test(why)) return result("Watching", "The runner checked eligible Windows. Each new entry still needs fresh data, a signal, and passing risk checks.");
  return result("Operation unavailable", "The runner is connected, but this report does not identify a known operating state.");
}
