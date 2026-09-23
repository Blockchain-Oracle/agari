import { etDateOf, formatCadence, formatEtClock } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { useMarket, useResolution } from "@agari/markets/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PROOF } from "@/features/proof/copy";
import { useMarketProof } from "@/features/proof/useMarketProof";
import { Button, EmptyState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";
import { PrintReceipt } from "./PrintReceipt";
import { ProofTable } from "./ProofTable";
import { ReverifyButton } from "./ReverifyButton";

const index = (n: number) => String(n).padStart(2, "0");

/**
 * `/proof/[id]` — web's ProofScreen (features/proof/ProofScreen.tsx): the Window's prints at a glance with the
 * cross-check, then one cream receipt per print (source, boundary, record tx, archived bytes, the source's own proof),
 * with Pyth's "Re-verify on devnet" above its receipt.
 */
export function ProofScreen({ marketId }: { marketId: MarketId }) {
  const { color } = useTheme();
  const { reading, refresh } = useMarketProof(marketId);
  const market = useMarket(marketId);
  const resolution = useResolution(marketId);
  const window = market && isOk(market) ? market.value : null;
  const singleSource = resolution && isOk(resolution) ? resolution.value.singleSource : false;
  const asset = window?.asset ?? (reading?.ok ? (reading.value[0]?.symbol ?? null) : null);
  const desc = window ? PROOF.window(window.asset, formatCadence(window.intervalSec), `${formatEtClock(window.expirySec)} ET · ${etDateOf(window.expirySec)}`) : undefined;

  return (
    <Screen title={PROOF.title} onRefresh={refresh}>
      <View style={styles.head}>
        {asset ? <AssetDisc asset={asset} size={40} /> : null}
        <View style={styles.headText}>
          <SectionHeader index={PROOF.section.index} title={PROOF.section.title} desc={desc} />
        </View>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{PROOF.intro}</Text>

      {reading === null ? <LoadingState shape="plate" label={PROOF.loading} /> : null}
      {reading !== null && !reading.ok ? <EmptyState why={PROOF.unreachable} action={{ label: "Try again", onPress: refresh }} /> : null}
      {reading?.ok && reading.value.length === 0 ? <EmptyState why={PROOF.none} /> : null}
      {reading?.ok && reading.value.length > 0 ? (
        <>
          <ProofTable prints={reading.value} singleSource={singleSource} />
          {reading.value.map((print, i) => (
            <View key={`${print.which}:${print.recordSignature}`} style={styles.print}>
              <SectionHeader index={index(i + 1)} title={PROOF.which[print.which]} />
              {print.source === "pyth" ? <ReverifyButton marketId={marketId} which={print.which} state={print.replay?.state ?? null} onStarted={refresh} /> : null}
              <PrintReceipt print={print} />
            </View>
          ))}
        </>
      ) : null}

      <View style={[styles.foot, { borderTopColor: color.hairline }]}>
        <Text style={[styles.kicker, { color: color.inkMuted }]}>WINDOW ADDRESS</Text>
        <Text selectable style={[TYPE.data, styles.id, { color: color.inkSecondary }]}>
          {marketId}
        </Text>
        <View style={styles.actions}>
          <Button label="Window account on Explorer" variant="outline" size="sm" icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("address", marketId))} />
          <Button label="Open this Window" variant="ghost" size="sm" onPress={() => router.push({ pathname: "/markets/[id]", params: { id: marketId } })} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headText: { flex: 1 },
  print: { gap: 10 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 8 },
  kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.5 },
  id: { fontSize: 12 },
  actions: { gap: 8 },
});
