import { neededMove } from "@agari/core/market";
import { StyleSheet, Text, View } from "react-native";
import { assetPairUnit, assetPriceLine } from "@/features/markets/hero/units";
import { HERO, HERO_HEAD } from "@/lib/copy";
import { TYPE, useTheme } from "~/theme";

interface Props {
  /** The lane's asset label ("TSLA", "TSLAx" on the token lane, "AILABS"). */
  asset: string;
  /** The ask before the line: "TSLA holds above" by default, "TSLA opens Mon above" on a Gap. */
  ask?: string;
  openingRaw: bigint | null;
  currentRaw: bigint | null;
}

/**
 * web's HeroQuestion: the line the Window settles against, and how far the live price sits from it, said once, about
 * UP. Whether UP is winning comes from core `neededMove`, never a comparison written here.
 */
export function WindowQuestion({ asset, ask, openingRaw, currentRaw }: Props) {
  const { color } = useTheme();
  let distance: { text: string; tone: string } = { text: HERO.pendingDistance, tone: color.inkMuted };
  if (openingRaw !== null && currentRaw === null) {
    distance = { text: HERO.noLivePrice, tone: color.inkMuted };
  }
  if (openingRaw !== null && currentRaw !== null) {
    const move = neededMove(currentRaw, openingRaw);
    const winning = move.upNeedsRaw === 0n;
    distance = winning
      ? { text: `${assetPriceLine(asset, currentRaw - openingRaw, openingRaw)} ${HERO_HEAD.aboveLine}`, tone: color.profit }
      : { text: `${HERO_HEAD.needs} +${assetPriceLine(asset, move.upNeedsRaw, openingRaw)} ${HERO_HEAD.needsForUp}`, tone: color.loss };
  }
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
        {openingRaw === null ? (
          HERO_HEAD.pair(asset, assetPairUnit(asset))
        ) : (
          <>
            {ask ?? HERO_HEAD.holdsAbove(asset)} <Text style={{ color: color.accent }}>{assetPriceLine(asset, openingRaw)}</Text>?
          </>
        )}
      </Text>
      <Text style={[TYPE.bodyStrong, { color: distance.tone }]}>{distance.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: 6 } });
