import { isSettled, type MarketPhase } from "@agari/core/lifecycle";
import { neededMove } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { laneAssetLabel, priceSourceLine } from "@/features/markets/lanes/lane-view";
import { windowSourceLabel } from "@/features/markets/price-source/source-label";
import { HERO, HERO_HEAD } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button, Row, Rows } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { NATIVE_MARKETS } from "../copy";
import { SourceLine } from "../parts/SourceLine";

interface Props {
  market: EventMarket;
  openingRaw: bigint | null;
  currentRaw: bigint | null;
  phase: MarketPhase | null;
}

/**
 * The rule and the price source, spelled out (web's HeroMarket DistanceReadout + PriceSourceNote + SourceLine): the
 * question, the line, each boundary in the reader's zone, what each side still needs, and which signed price decides.
 */
export function WindowRules({ market, openingRaw, currentRaw, phase }: Props) {
  const { color } = useTheme();
  const when = useWhen();
  const asset = laneAssetLabel(market.asset, market.lane);
  const nowSec = marketsProvider.nowMs() / 1000;
  const settled = phase !== null && (isSettled(phase) || phase === "voided");
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.body, { color: color.ink }]}>{HERO.question(asset)}</Text>
      <Rows>
        <Row label={NATIVE_MARKETS.rule.line} value={openingRaw === null ? HERO.pendingPrint : assetPriceLine(asset, openingRaw)} tone={openingRaw === null ? "muted" : "accent"} />
        <Row label={market.tradingStartSec > nowSec ? NATIVE_MARKETS.rule.opensFuture : NATIVE_MARKETS.rule.opens} value={when(market.tradingStartSec)} />
        {market.lockAtSec !== market.expirySec ? <Row label={NATIVE_MARKETS.rule.lastEntry} value={when(market.lockAtSec)} /> : null}
        <Row label={NATIVE_MARKETS.rule.settles} value={when(market.expirySec, { seconds: market.lane === "gap" })} />
      </Rows>
      <SideNeeds asset={asset} openingRaw={openingRaw} currentRaw={currentRaw} />
      <View style={styles.source}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{NATIVE_MARKETS.rule.source}</Text>
        <SourceLine label={windowSourceLabel(market)} tone="secondary" />
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{priceSourceLine(market)}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{HERO_HEAD.settlesOnItsOwn}.</Text>
      </View>
      {settled ? (
        <Button
          label={NATIVE_MARKETS.rule.proof}
          variant="outline"
          icon={{ ios: "checkmark.seal", android: "verified" }}
          onPress={() => router.push({ pathname: "/proof/[id]", params: { id: market.marketId } })}
        />
      ) : null}
    </View>
  );
}

/** web's DistanceReadout: what each side still needs, in the asset's unit; pending wording until the print exists. */
function SideNeeds({ asset, openingRaw, currentRaw }: { asset: string; openingRaw: bigint | null; currentRaw: bigint | null }) {
  const { color } = useTheme();
  if (openingRaw === null) return <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{HERO.pendingDistance}</Text>;
  if (currentRaw === null) return <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{HERO.noLivePrice}</Text>;
  const move = neededMove(currentRaw, openingRaw);
  const line = (word: string, needsRaw: bigint, sign: "+" | "−") =>
    needsRaw === 0n ? HERO.leading(word) : `${HERO.needs.before} ${sign}${assetPriceLine(asset, needsRaw, openingRaw)} ${HERO.needs.after(word)}`;
  return (
    <View style={styles.needs}>
      <Text style={[TYPE.bodyStrong, { color: move.upNeedsRaw === 0n ? color.profit : color.inkSecondary }]}>{line("UP", move.upNeedsRaw, "+")}</Text>
      <Text style={[TYPE.bodyStrong, { color: move.downNeedsRaw === 0n ? color.loss : color.inkSecondary }]}>{line("DOWN", move.downNeedsRaw, "−")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  needs: { gap: 2 },
  source: { gap: 6 },
});
