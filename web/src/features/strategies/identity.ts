import { parseStrategyMetadata } from "@agari/core/strategies";
import { codenameFromAddress } from "./names";

/** Public identity travels with the registry metadata, so a runner change cannot rename an agent. */
export function strategyIdentity(card: { strategyId: string; runner: string; metadata: string }): { name: string; seed: string } {
  const meta = parseStrategyMetadata(card.metadata);
  let seed = `agari-strategy:${card.strategyId}`;
  try {
    const raw: unknown = JSON.parse(card.metadata);
    if (raw && typeof raw === "object" && "portraitSeed" in raw && typeof raw.portraitSeed === "string" && raw.portraitSeed.length > 0 && raw.portraitSeed.length <= 128) seed = raw.portraitSeed;
  } catch { /* Legacy metadata keeps its deterministic fallback. */ }
  return { name: meta?.name.trim().slice(0, 64) || codenameFromAddress(seed), seed };
}

export const STRATEGY_MARKETS = "every live lane, 24/7 included";
