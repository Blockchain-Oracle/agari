import { ADVICE_COPY } from "@agari/core/copy";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { STRATEGY_MARKETS } from "@/features/strategies/identity";
import { useDeskWrites } from "@/features/strategies/useDeskWrites";
import { useRefreshStrategies, useStrategies } from "@/features/strategies/useStrategies";
import { Button, Card, EmptyState, Hero, ReadingView, Screen, Segmented } from "~/components/kit";
import { Catalogue, openStrategy } from "~/features/strategies/Catalogue";
import { CreatorStudio } from "~/features/strategies/studio/CreatorStudio";
import { HOUSE_RUNNER } from "~/features/strategies/studio/houseRunner";
import { TYPE, useTheme } from "~/theme";

type View3 = "create" | "copy" | "yours";

/** `/strategies` — web's features/strategies/StrategiesScreen.tsx: create an agent, copy a strategy, manage yours. */
export default function StrategiesScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ view?: string; copy?: string; strategy?: string }>();
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  const writes = useDeskWrites();
  const [view, setView] = useState<View3>(params.view === "copy" || params.view === "yours" ? params.view : "create");
  useEffect(() => {
    if (params.strategy) openStrategy({ strategyId: params.strategy });
  }, [params.strategy]);
  const payload = reading?.ok ? reading.value : null;

  return (
    <Screen title={STRATEGIES.title} onRefresh={refresh}>
      <Hero kicker="Agents · Solana devnet" title="Give your strategy a life." lead="Build an AI agent, a momentum or reversion rule, or a strategy that copies one trader's calls; test its thinking, and set the limits before it can trade." />
      <Segmented
        label="Strategy workspace"
        options={[
          { value: "create", label: "Create" },
          { value: "copy", label: "Copy" },
          { value: "yours", label: "Yours" },
        ]}
        value={view}
        onChange={setView}
      />
      {writes.pending && !writes.busy ? (
        <Card tone="accent">
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Copy setup needs attention.</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            Strategy #{writes.pending.strategyId} has an unfinished permission or subscription. Your progress is saved on this phone.
          </Text>
          <Button label="Continue setup" trailing="→" size="sm" onPress={() => openStrategy({ strategyId: writes.pending!.strategyId })} />
        </Card>
      ) : null}
      {view === "create" ? (
        <CreatorStudio
          writes={writes}
          decimals={payload?.decimals ?? 6}
          symbol={payload?.symbol ?? "tUSDC"}
          asset={STRATEGY_MARKETS}
          houseRunner={HOUSE_RUNNER}
          initialTrader={params.copy ?? null}
          onPublished={() => setView("yours")}
        />
      ) : (
        <ReadingView reading={reading} loading="list" retry={refresh}>
          {(data) =>
            data.deployed ? (
              <Catalogue payload={data} writes={writes} view={view} onCreate={() => setView("create")} />
            ) : (
              <EmptyState why={STRATEGIES.notDeployed.title} detail={STRATEGIES.notDeployed.body} />
            )
          }
        </ReadingView>
      )}
      <View style={styles.foot}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{ADVICE_COPY.notAdvice}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { paddingTop: 8 },
});
