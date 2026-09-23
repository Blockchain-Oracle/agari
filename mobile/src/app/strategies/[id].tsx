import { useLocalSearchParams } from "expo-router";
import { STRATEGIES } from "@/features/strategies/copy";
import { strategyIdentity } from "@/features/strategies/identity";
import { useDeskWrites } from "@/features/strategies/useDeskWrites";
import { useRefreshStrategies, useStrategies } from "@/features/strategies/useStrategies";
import { EmptyState, ReadingView, Screen } from "~/components/kit";
import { StrategyDetail } from "~/features/strategies/StrategyDetail";

/** One strategy (web's copy drawer on /strategies?strategy=<id>), as its own pushed screen. */
export default function StrategyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  const writes = useDeskWrites();
  const card = reading?.ok ? reading.value.strategies.find((s) => s.strategyId === id) ?? null : null;
  return (
    <Screen title={card ? strategyIdentity(card).name : STRATEGIES.title} onRefresh={refresh}>
      <ReadingView reading={reading} loading="plate" retry={refresh}>
        {(payload) =>
          card ? (
            <StrategyDetail payload={payload} card={card} writes={writes} />
          ) : (
            <EmptyState why={`Strategy #${id} is not in the registry.`} detail={STRATEGIES.archive.noneBody} />
          )
        }
      </ReadingView>
    </Screen>
  );
}
