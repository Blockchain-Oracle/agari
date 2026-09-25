import { etDateOf, formatCadence, formatEtClock } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { useMarket, useResolution } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { PROOF } from "@/features/proof/copy";
import { useMarketProof } from "@/features/proof/useMarketProof";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { Holding } from "./Frame";
import { PrintReceipt } from "./PrintReceipt";
import { ProofTable } from "./ProofTable";
import { ReverifyButton } from "./ReverifyButton";

const index = (n: number) => String(n).padStart(2, "0");

/**
 * `/proof/[id]` — web's ProofScreen.tsx: Masayume's `/status` frame (numbered header, holding states, the table) over
 * the Window's prints, then one cream receipt per print under its own numbered header, Pyth's with "Re-verify on
 * devnet" beside the title.
 */
export function ProofScreen({ marketId }: { marketId: MarketId }) {
  const { color } = useTheme();
  const { reading, refresh } = useMarketProof(marketId);
  const market = useMarket(marketId);
  const resolution = useResolution(marketId);
  const window = market && isOk(market) ? market.value : null;
  const singleSource = resolution && isOk(resolution) ? resolution.value.singleSource : false;
  const desc = window ? PROOF.window(window.asset, formatCadence(window.intervalSec), `${formatEtClock(window.expirySec)} ET · ${etDateOf(window.expirySec)}`) : undefined;

  return (
    <ExplorePage title={PROOF.title} onRefresh={refresh} style={styles.page}>
      <SectionHeader index={PROOF.section.index} title={PROOF.section.title} desc={desc} />
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{PROOF.intro}</Text>

      {reading === null ? <Holding kind="loading" text={PROOF.loading} /> : null}
      {reading !== null && !reading.ok ? <Holding kind="alert" text={PROOF.unreachable} /> : null}
      {reading?.ok && reading.value.length === 0 ? <Holding kind="plain" text={PROOF.none} /> : null}

      {reading?.ok && reading.value.length > 0 ? (
        <View style={styles.report}>
          <ProofTable prints={reading.value} singleSource={singleSource} />
          <View style={styles.prints}>
            {reading.value.map((print, i) => (
              <View key={print.which} style={styles.print}>
                <SectionHeader
                  index={index(i + 1)}
                  title={PROOF.which[print.which]}
                  aside={
                    print.source === "pyth" ? (
                      <ReverifyButton marketId={marketId} which={print.which} state={print.replay?.state ?? null} onStarted={refresh} />
                    ) : (
                      <View style={styles.headFloor} />
                    )
                  }
                />
                <PrintReceipt print={print} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  // .status-page: 28 px under the header, 48 px over the dock's floor.
  page: { paddingTop: 28, paddingBottom: 48 + CHROME.dockClearance },
  intro: { marginTop: 12, fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  report: { marginTop: 24, gap: 24 },
  prints: { gap: 32 },
  print: { gap: 16 },
  // `.proof-print > header > div { min-height: 2rem }`: headers with and without the button sit alike.
  headFloor: { minHeight: 32 },
});
