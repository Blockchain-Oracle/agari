import { rankAgents, type AgentRow, type StrategyRecord } from "@agari/core/strategies";
import type { Address, Hex } from "@agari/core/types";
import type { StrategiesPayload } from "@/features/strategies/protocol";

type Wire = StrategiesPayload["strategies"][number];

/** web's AgentsScreen toRecord: the wire's decimal strings back into the registry record core ranks. */
function toRecord(w: Wire): StrategyRecord {
  return {
    strategyId: BigInt(w.strategyId),
    creator: w.creator as Address,
    runner: w.runner as Address,
    specHash: w.specHash as Hex,
    metadata: w.metadata,
    envelope: {
      maxStakePerTradeBase: BigInt(w.envelope.maxStakePerTradeBase),
      maxDailySpendBase: BigInt(w.envelope.maxDailySpendBase),
      maxOpenPositions: w.envelope.maxOpenPositions,
      maxPriceRaw: BigInt(w.envelope.maxPriceRaw),
    },
    feeBase: BigInt(w.feeBase),
    active: w.active,
    createdAtSec: w.createdAtSec,
    subscribers: w.subscribers,
    revision: w.revision,
  };
}

/** The runners ranked on entrusted capital and executed copy-trades, never win rate (core rankAgents). */
export function rankRunners(strategies: readonly Wire[]): AgentRow[] {
  const byId = new Map(strategies.map((s) => [s.strategyId, s]));
  return rankAgents(strategies.map(toRecord), (id) => {
    const w = byId.get(id.toString());
    if (!w) return null;
    return {
      ...w.record,
      netBase: BigInt(w.record.netBase),
      stakedBase: BigInt(w.record.stakedBase),
      curve: w.record.curve.map((p) => ({ atSec: p.atSec, cumBase: BigInt(p.cumBase) })),
    };
  });
}
