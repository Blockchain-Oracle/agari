import { ADVICE_COPY } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { STRATEGY_MARKETS } from "@/features/strategies/identity";
import { useDeskWrites } from "@/features/strategies/useDeskWrites";
import { useRefreshStrategies, useStrategies } from "@/features/strategies/useStrategies";
import { FONT } from "~/theme";
import { Catalogue } from "./Catalogue";
import { StickyPage } from "./StickyPage";
import { CapabilityPending, ReadingBoundary } from "./States";
import { CreatorStudio } from "./studio/CreatorStudio";
import { HOUSE_RUNNER } from "./studio/houseRunner";
import { DeskPill, ST, useStrat } from "./ui";

type View3 = "create" | "copy" | "yours";
const ENTRY: readonly (readonly [View3, string])[] = [["create", "Create"], ["copy", "Copy a strategy"], ["yours", "Your strategies"]];

/**
 * `/strategies` — web's features/strategies/StrategiesScreen.tsx and app/strategies/page.tsx: the nameplate, the
 * three workspace buttons, an unfinished-setup notice, then the creator studio or the catalogue (web's
 * CapabilityPending when the registry is not deployed), and ADVICE_COPY.notAdvice under the container.
 * `?view=copy|yours`, `?copy=<wallet>` and `?strategy=<id>` deep-link as web's query does.
 */
export function StrategiesScreen() {
  const { t, color } = useStrat();
  const params = useLocalSearchParams<{ view?: string; copy?: string; strategy?: string }>();
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  const writes = useDeskWrites();
  const [view, setView] = useState<View3>(params.view === "copy" || params.view === "yours" ? params.view : "create");
  useEffect(() => {
    if (params.view === "copy" || params.view === "yours") setView(params.view);
    else if (params.copy) setView("create");
  }, [params.view, params.copy]);
  const payload = reading && isOk(reading) ? reading.value : null;

  return (
    <StickyPage title={STRATEGIES.title} onRefresh={refresh}>
      <View style={styles.container}>
        <View style={[styles.nameplate, { borderBottomColor: t.ink(0.15) }]}>
          <Text style={[ST.meta, styles.mb12, { color: color.accent }]}>AGENTS · SOLANA DEVNET</Text>
          <Text style={[ST.h1, { color: color.ink }]} accessibilityRole="header">
            Give your strategy a life.
          </Text>
        </View>
        <Text style={[ST.textSm, { color: color.inkSecondary }]}>
          Build an AI agent, a momentum or reversion rule, or a strategy that copies one trader's calls; test its thinking, and set the limits before it can trade.
        </Text>
        <View style={styles.entry} accessibilityLabel="Strategy workspace">
          {ENTRY.map(([key, label]) => {
            const on = view === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setView(key)}
                style={[styles.entryButton, on ? { borderColor: t.vermilion, backgroundColor: t.vermilionA(0.07) } : { borderColor: color.hairline }]}
              >
                <Text style={[styles.entryText, { color: color.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {writes.pending && !writes.busy ? (
          <View accessibilityRole="alert" style={[styles.progress, { borderColor: t.vermilion }]}>
            <Text style={[styles.progressStrong, { color: color.ink }]}>Copy setup needs attention.</Text>
            <Text style={[styles.progressP, { color: color.ink }]}>
              Strategy #{writes.pending.strategyId} has an unfinished permission or subscription. Your progress is saved on this phone.
            </Text>
            <DeskPill label="Continue setup →" onPress={() => setView("yours")} style={styles.mt12} />
          </View>
        ) : null}
        <View style={view === "create" ? null : styles.hidden}>
          <CreatorStudio
            writes={writes}
            decimals={payload?.decimals ?? 6}
            symbol={payload?.symbol ?? "tUSDC"}
            asset={STRATEGY_MARKETS}
            houseRunner={HOUSE_RUNNER}
            initialTrader={params.copy ?? null}
            onPublished={() => setView("yours")}
          />
        </View>
        {view !== "create" ? (
          <ReadingBoundary reading={reading} retry={refresh}>
            {(data) =>
              data.deployed ? (
                <Catalogue payload={data} writes={writes} view={view} onCreate={() => setView("create")} requested={params.strategy ?? null} />
              ) : (
                <View style={styles.mt30}>
                  <CapabilityPending eyebrow={STRATEGIES.notDeployed.eyebrow} title={STRATEGIES.notDeployed.title} dependency={STRATEGIES.notDeployed.dependency} body={STRATEGIES.notDeployed.body} />
                </View>
              )
            }
          </ReadingBoundary>
        ) : null}
      </View>
      <Text style={[ST.caption, styles.advice, { color: color.inkMuted }]}>{ADVICE_COPY.notAdvice}</Text>
    </StickyPage>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 28, paddingBottom: 48, paddingHorizontal: 18 },
  nameplate: { marginTop: 28, paddingBottom: 28, borderBottomWidth: 1 },
  mb12: { marginBottom: 12 },
  mt12: { marginTop: 12 },
  mt30: { marginTop: 30 },
  entry: { flexDirection: "row", flexWrap: "wrap", gap: 9.75, marginTop: 28 },
  entryButton: { borderWidth: 1, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 15 },
  entryText: { fontFamily: FONT.dataRegular, fontSize: 11.25, lineHeight: 18, textAlign: "center" },
  progress: { borderWidth: 1, padding: 15, marginTop: 30 },
  progressStrong: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  progressP: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  hidden: { display: "none" },
  advice: { paddingHorizontal: 18, paddingBottom: 40 },
});
